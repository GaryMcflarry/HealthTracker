const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { eq, and, gte, isNotNull } = require('drizzle-orm');
const { db } = require('../db');
const { usersTable, notificationsTable, goalsTable } = require('../db/schema');

// Email configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'garymcflarry0807@gmail.com',
    pass: 'zcqc czth mvfc cbht'
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Rate limiting to prevent spam
const alertCooldowns = new Map();
const COOLDOWN_MINUTES = 60;

// Main health alert checking endpoint
router.post('/check-health-alerts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { healthData } = req.body;
    
    console.log(`🔍 Health alert check for user ${userId}:`, healthData);
    
    // Validate input
    if (!healthData || typeof healthData !== 'object') {
      return res.status(400).json({ error: 'Invalid health data provided' });
    }
    
    // Get user data
    const user = await db.select().from(usersTable)
      .where(eq(usersTable.id, parseInt(userId)))
      .limit(1);
      
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = user[0];
    if (!userData.email) {
      return res.status(400).json({ error: 'No email configured for alerts' });
    }
    
    // Get user goals and notification settings
    const [userGoals, notificationSettings] = await Promise.all([
      getUserGoals(userId),
      getNotificationSettings(userId)
    ]);
    
    console.log(`📊 Goals loaded:`, userGoals);
    console.log(`🔔 Notification settings:`, notificationSettings);
    
    // Check for alerts based on goals and notification thresholds
    const alerts = await checkHealthAlerts(healthData, userGoals, notificationSettings, userId);
    
    console.log(`⚠️ Alerts generated: ${alerts.length}`);
    
    if (alerts.length > 0) {
      // Send notifications
      const emailResults = await sendHealthAlerts(userData, alerts);
      res.json({
        success: true,
        message: 'Health alerts processed successfully',
        alertsTriggered: alerts.length,
        emailsSent: emailResults.sent,
        emailsFailed: emailResults.failed,
        alerts: alerts.map(a => ({
          type: a.type,
          title: a.title,
          category: a.category,
          priority: a.priority
        }))
      });
    } else {
      res.json({
        success: true,
        message: 'Health data checked - no alerts triggered',
        alertsTriggered: 0,
        healthDataProcessed: Object.keys(healthData)
      });
    }
    
  } catch (error) {
    console.error('❌ Health alert processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process health alerts',
      details: error.message
    });
  }
});

// Get user goals from database
async function getUserGoals(userId) {
  const goals = await db.select().from(goalsTable)
    .where(eq(goalsTable.user_id, parseInt(userId)));
    
  const goalsMap = {};
  goals.forEach(goal => {
    goalsMap[goal.goal_type] = {
      target: parseFloat(goal.target_value),
      timePeriod: goal.time_period,
      icon: goal.icon
    };
  });
  
  return goalsMap;
}

// Get notification settings from database
async function getNotificationSettings(userId) {
  const notifications = await db.select().from(notificationsTable);
  // Note: No user_id filter since your schema doesn't have user_id field
    
  const settings = {
    steps: {},
    calories: {},
    heart_rate: {}
  };
  
  notifications.forEach(notif => {
    const type = notif.notification_type;
    
    // Use your actual schema field names
    if (type.includes('steps')) {
      if (notif.high_amount) settings.steps.high = notif.high_amount;
      if (notif.low_amount) settings.steps.low = notif.low_amount;
    } else if (type.includes('calories')) {
      if (notif.high_amount) settings.calories.high = notif.high_amount;
      if (notif.low_amount) settings.calories.low = notif.low_amount;
    } else if (type.includes('heart_rate')) {
      if (notif.high_amount) settings.heart_rate.high = notif.high_amount;
      if (notif.low_amount) settings.heart_rate.low = notif.low_amount;
    }
  });
  
  return settings;
}
// Main alert checking logic
async function checkHealthAlerts(healthData, userGoals, notificationSettings, userId) {
  const alerts = [];
  
  // Check steps alerts
  if (healthData.steps !== undefined && healthData.steps !== null) {
    const stepsAlerts = await checkStepsAlerts(healthData.steps, userGoals.steps, notificationSettings.steps, userId);
    alerts.push(...stepsAlerts);
  }
  
  // Check calories alerts
  if (healthData.calories !== undefined && healthData.calories !== null) {
    const calorieAlerts = await checkCalorieAlerts(healthData.calories, userGoals.calories, notificationSettings.calories, userId);
    alerts.push(...calorieAlerts);
  }
  
  // Check heart rate alerts
  if (healthData.heartRate !== undefined && healthData.heartRate !== null) {
    const heartRateAlerts = await checkHeartRateAlerts(healthData.heartRate, userGoals.heart_rate, notificationSettings.heart_rate, userId);
    alerts.push(...heartRateAlerts);
  }
  
  // Check sleep alerts (if you have sleep goals)
  if (healthData.sleepHours !== undefined && healthData.sleepHours !== null && userGoals.sleep) {
    const sleepAlerts = await checkSleepAlerts(healthData.sleepHours, userGoals.sleep, userId);
    alerts.push(...sleepAlerts);
  }
  
  return alerts;
}

// Steps alert checking
async function checkStepsAlerts(currentSteps, stepsGoal, stepsNotifications, userId) {
  const alerts = [];
  const cooldownKey = `steps_${userId}`;
  
  if (isInCooldown(cooldownKey)) {
    return alerts;
  }
  
  // Goal achievement alert
  if (stepsGoal && currentSteps >= stepsGoal.target) {
    const percentage = Math.round((currentSteps / stepsGoal.target) * 100);
    alerts.push({
      type: 'steps_goal_achieved',
      title: 'Steps Goal Achieved! 🎯',
      message: `Congratulations! You've reached ${percentage}% of your daily step goal with ${currentSteps.toLocaleString()} steps. Target: ${stepsGoal.target.toLocaleString()} steps.`,
      category: 'achievement',
      priority: 'high',
      data: { current: currentSteps, goal: stepsGoal.target, percentage },
      icon: stepsGoal.icon || '👟'
    });
    setCooldown(cooldownKey);
  }
  
  // High threshold alert
  if (stepsNotifications.high && currentSteps >= stepsNotifications.high) {
    alerts.push({
      type: 'steps_high_threshold',
      title: 'High Step Count Alert! ⚡',
      message: `Wow! You've taken ${currentSteps.toLocaleString()} steps today, which is above your high threshold of ${stepsNotifications.high.toLocaleString()}. Great job staying active!`,
      category: 'health_alert',
      priority: 'medium',
      data: { current: currentSteps, threshold: stepsNotifications.high },
      icon: '⚡'
    });
  }
  
  // Low threshold alert
  if (stepsNotifications.low && currentSteps <= stepsNotifications.low) {
    alerts.push({
      type: 'steps_low_threshold',
      title: 'Low Step Count Alert 📉',
      message: `You've only taken ${currentSteps.toLocaleString()} steps today, which is below your target of ${stepsNotifications.low.toLocaleString()}. Consider taking a short walk!`,
      category: 'encouragement',
      priority: 'medium',
      data: { current: currentSteps, threshold: stepsNotifications.low },
      icon: '📉'
    });
  }
  
  return alerts;
}

// Calorie alert checking
async function checkCalorieAlerts(currentCalories, caloriesGoal, caloriesNotifications, userId) {
  const alerts = [];
  const cooldownKey = `calories_${userId}`;
  
  if (isInCooldown(cooldownKey)) {
    return alerts;
  }
  
  // Goal achievement alert
  if (caloriesGoal && currentCalories >= caloriesGoal.target) {
    const percentage = Math.round((currentCalories / caloriesGoal.target) * 100);
    alerts.push({
      type: 'calories_goal_achieved',
      title: 'Calorie Goal Achieved! 🔥',
      message: `Amazing! You've burned ${currentCalories.toLocaleString()} calories today, reaching ${percentage}% of your ${caloriesGoal.target.toLocaleString()} calorie target.`,
      category: 'achievement',
      priority: 'high',
      data: { current: currentCalories, goal: caloriesGoal.target, percentage },
      icon: caloriesGoal.icon || '🔥'
    });
    setCooldown(cooldownKey);
  }
  
  // High threshold alert
  if (caloriesNotifications.high && currentCalories >= caloriesNotifications.high) {
    alerts.push({
      type: 'calories_high_threshold',
      title: 'High Calorie Burn Alert! 💪',
      message: `Excellent work! You've burned ${currentCalories.toLocaleString()} calories, which is above your high threshold of ${caloriesNotifications.high.toLocaleString()}.`,
      category: 'health_alert',
      priority: 'medium',
      data: { current: currentCalories, threshold: caloriesNotifications.high },
      icon: '💪'
    });
  }
  
  // Low threshold alert
  if (caloriesNotifications.low && currentCalories <= caloriesNotifications.low) {
    alerts.push({
      type: 'calories_low_threshold',
      title: 'Low Calorie Burn Alert 📊',
      message: `You've burned ${currentCalories.toLocaleString()} calories today, which is below your target of ${caloriesNotifications.low.toLocaleString()}. Consider increasing your activity!`,
      category: 'encouragement',
      priority: 'medium',
      data: { current: currentCalories, threshold: caloriesNotifications.low },
      icon: '📊'
    });
  }
  
  return alerts;
}

// Heart rate alert checking
async function checkHeartRateAlerts(currentHeartRate, heartRateGoal, heartRateNotifications, userId) {
  const alerts = [];
  const cooldownKey = `heart_rate_${userId}`;
  
  if (isInCooldown(cooldownKey)) {
    return alerts;
  }
  
  // High threshold alert (potentially concerning)
  if (heartRateNotifications.high && currentHeartRate >= heartRateNotifications.high) {
    alerts.push({
      type: 'heart_rate_high_threshold',
      title: 'High Heart Rate Alert! ❤️‍🔥',
      message: `Your heart rate is ${currentHeartRate} BPM, which is above your high threshold of ${heartRateNotifications.high} BPM. Please ensure you're not overexerting yourself.`,
      category: 'health_concern',
      priority: 'high',
      data: { current: currentHeartRate, threshold: heartRateNotifications.high },
      icon: '❤️‍🔥'
    });
    setCooldown(cooldownKey);
  }
  
  // Low threshold alert (potentially concerning)
  if (heartRateNotifications.low && currentHeartRate <= heartRateNotifications.low) {
    alerts.push({
      type: 'heart_rate_low_threshold',
      title: 'Low Heart Rate Alert 💙',
      message: `Your heart rate is ${currentHeartRate} BPM, which is below your low threshold of ${heartRateNotifications.low} BPM. If you're not resting, you might want to check with a healthcare provider.`,
      category: 'health_concern',
      priority: 'high',
      data: { current: currentHeartRate, threshold: heartRateNotifications.low },
      icon: '💙'
    });
    setCooldown(cooldownKey);
  }
  
  return alerts;
}

// Sleep alert checking (basic implementation)
async function checkSleepAlerts(currentSleep, sleepGoal, userId) {
  const alerts = [];
  const cooldownKey = `sleep_${userId}`;
  
  if (isInCooldown(cooldownKey)) {
    return alerts;
  }
  
  if (currentSleep >= sleepGoal.target) {
    alerts.push({
      type: 'sleep_goal_achieved',
      title: 'Sleep Goal Achieved! 😴',
      message: `Well rested! You got ${currentSleep} hours of sleep, meeting your ${sleepGoal.target}-hour target. Quality sleep is essential for health and recovery.`,
      category: 'achievement',
      priority: 'medium',
      data: { current: currentSleep, goal: sleepGoal.target },
      icon: sleepGoal.icon || '😴'
    });
    setCooldown(cooldownKey);
  }
  
  return alerts;
}


// Send email alerts
async function sendHealthAlerts(userData, alerts) {
  let sent = 0;
  let failed = 0;
  
  try {
    const emailContent = generateEmailHTML(userData, alerts);
    
    const mailOptions = {
      from: 'FitTracker Health <garymcflarry0807@gmail.com>',
      to: userData.email,
      subject: `Health Alert: ${alerts[0].title} - FitTracker`,
      html: emailContent
    };
    
    await transporter.sendMail(mailOptions);
    sent++;
    console.log(`✅ Health alert email sent to ${userData.email}`);
    
  } catch (error) {
    failed++;
    console.error(`❌ Failed to send email to ${userData.email}:`, error);
  }
  
  return { sent, failed };
}

// Enhanced email template
function generateEmailHTML(userData, alerts) {
  const userName = userData.first_name || 'User';
  const title = alerts.length === 1 ? alerts[0].title : `${alerts.length} Health Alerts`;
  
  let alertsHTML = '';
  alerts.forEach(alert => {
    const categoryColors = {
      achievement: '#4CAF50',
      health_concern: '#FF5722',
      health_alert: '#FF9800',
      encouragement: '#2196F3'
    };
    const categoryColor = categoryColors[alert.category] || '#666';
    
    alertsHTML += `
      <div style="margin: 20px 0; padding: 20px; background-color: #f9f9f9; border-left: 5px solid ${categoryColor}; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h3 style="margin: 0 0 12px 0; color: ${categoryColor}; font-size: 18px;">
          ${alert.icon} ${alert.title}
        </h3>
        <p style="margin: 0; color: #333; line-height: 1.6; font-size: 16px;">${alert.message}</p>
        ${alert.data ? `
          <div style="margin-top: 12px; padding: 10px; background-color: #f0f0f0; border-radius: 4px; font-size: 14px; color: #666;">
            <strong>Details:</strong> Current: ${alert.data.current} | ${alert.data.goal ? `Goal: ${alert.data.goal}` : alert.data.threshold ? `Threshold: ${alert.data.threshold}` : ''}
          </div>
        ` : ''}
      </div>
    `;
  });
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center;">
                <h1 style="margin: 0; font-size: 28px; font-weight: bold;">🏃‍♂️ FitTracker Health</h1>
                <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">${title}</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
                <p style="font-size: 18px; color: #333; margin: 0 0 20px 0;">Hi ${userName},</p>
                
                ${alertsHTML}
                
                <!-- Call to Action -->
                <div style="margin: 40px 0; padding: 25px; background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); border-radius: 10px; text-align: center;">
                    <p style="margin: 0 0 15px 0; color: #1976d2; font-weight: bold; font-size: 18px;">
                        Keep tracking your health journey! 💪
                    </p>
                    <a href="http://localhost:3000/dashboard" 
                       style="display: inline-block; background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                        View Full Dashboard →
                    </a>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8f9fa; padding: 20px 30px; border-top: 1px solid #dee2e6; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: #6c757d; line-height: 1.4;">
                    This is an automated health notification from FitTracker.<br>
                    To adjust your notification preferences, visit your dashboard settings.<br>
                    <a href="mailto:garymcflarry0807@gmail.com" style="color: #1976d2;">Contact Support</a>
                </p>
            </div>
        </div>
    </body>
    </html>
  `;
}

// Cooldown management functions
function isInCooldown(key) {
  const cooldown = alertCooldowns.get(key);
  if (!cooldown) return false;
  
  const timePassed = Date.now() - cooldown;
  const cooldownExpired = true;
  // const cooldownExpired = timePassed > (COOLDOWN_MINUTES * 60 * 1000);
  
  if (cooldownExpired) {
    alertCooldowns.delete(key);
    return false;
  }
  
  return true;
}

function setCooldown(key) {
  alertCooldowns.set(key, Date.now());
}


module.exports = router;