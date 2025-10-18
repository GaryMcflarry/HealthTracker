const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { eq, and, gte, isNotNull } = require('drizzle-orm');
const { db } = require('../db');
const { usersTable, notificationsTable, goalsTable } = require('../db/schema');

const transporter = nodemailer.createTransporter({
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

const alertCooldowns = new Map();
const COOLDOWN_MINUTES = 60;

router.post('/check-health-alerts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { healthData } = req.body;
    
    if (!healthData || typeof healthData !== 'object') {
      return res.status(400).json({ error: 'Invalid health data provided' });
    }
    
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
    
    const [userGoals, notificationSettings] = await Promise.all([
      getUserGoals(userId),
      getNotificationSettings()
    ]);
    
    const alerts = await checkHealthAlerts(healthData, userGoals, notificationSettings, userId);
    
    if (alerts.length > 0) {
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
    res.status(500).json({
      success: false,
      error: 'Failed to process health alerts',
      details: error.message
    });
  }
});

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

async function getNotificationSettings() {
  const notifications = await db.select().from(notificationsTable);
    
  const settings = {
    steps: { notifications: [] },
    calories: { notifications: [] },
    heart_rate: { notifications: [] }
  };
  
  notifications.forEach(notif => {
    const type = notif.notification_type;
    const notificationData = {
      id: notif.id,
      title: notif.title,
      message: notif.message,
      high_amount: notif.high_amount,
      low_amount: notif.low_amount,
      icon: notif.icon,
      type: type
    };
    
    if (type.includes('steps')) {
      settings.steps.notifications.push(notificationData);
      if (notif.high_amount) settings.steps.high = notif.high_amount;
      if (notif.low_amount) settings.steps.low = notif.low_amount;
    } else if (type.includes('calories')) {
      settings.calories.notifications.push(notificationData);
      if (notif.high_amount) settings.calories.high = notif.high_amount;
      if (notif.low_amount) settings.calories.low = notif.low_amount;
    } else if (type.includes('heart_rate')) {
      settings.heart_rate.notifications.push(notificationData);
      if (notif.high_amount) settings.heart_rate.high = notif.high_amount;
      if (notif.low_amount) settings.heart_rate.low = notif.low_amount;
    }
  });
  
  return settings;
}

async function checkHealthAlerts(healthData, userGoals, notificationSettings, userId) {
  const alerts = [];
  
  if (healthData.steps !== undefined && healthData.steps !== null) {
    const stepsAlerts = await checkStepsAlerts(healthData.steps, userGoals.steps, notificationSettings.steps, userId);
    alerts.push(...stepsAlerts);
  }
  
  if (healthData.calories !== undefined && healthData.calories !== null) {
    const calorieAlerts = await checkCalorieAlerts(healthData.calories, userGoals.calories, notificationSettings.calories, userId);
    alerts.push(...calorieAlerts);
  }
  
  if (healthData.heartRate !== undefined && healthData.heartRate !== null) {
    const heartRateAlerts = await checkHeartRateAlerts(healthData.heartRate, userGoals.heart_rate, notificationSettings.heart_rate, userId);
    alerts.push(...heartRateAlerts);
  }
  
  if (healthData.sleepHours !== undefined && healthData.sleepHours !== null && userGoals.sleep) {
    const sleepAlerts = await checkSleepAlerts(healthData.sleepHours, userGoals.sleep, userId);
    alerts.push(...sleepAlerts);
  }
  
  return alerts;
}

async function checkStepsAlerts(currentSteps, stepsGoal, stepsNotifications, userId) {
  const alerts = [];
  const cooldownKey = `steps_${userId}`;
  
  if (isInCooldown(cooldownKey)) {
    return alerts;
  }
  
  if (stepsGoal && currentSteps >= stepsGoal.target) {
    const percentage = Math.round((currentSteps / stepsGoal.target) * 100);
    alerts.push({
      type: 'steps_goal_achieved',
      title: 'Steps Goal Achieved!',
      message: `Congratulations! You've reached ${percentage}% of your daily step goal with ${currentSteps.toLocaleString()} steps. Target: ${stepsGoal.target.toLocaleString()} steps.`,
      category: 'achievement',
      priority: 'high',
      data: { current: currentSteps, goal: stepsGoal.target, percentage },
      icon: stepsGoal.icon
    });
    setCooldown(cooldownKey);
  }
  
  stepsNotifications.notifications.forEach(notification => {
    if (notification.high_amount && currentSteps >= notification.high_amount) {
      alerts.push({
        type: 'steps_high_threshold',
        title: notification.title || 'High Step Count Alert!',
        message: notification.message.replace('{current}', currentSteps.toLocaleString()).replace('{threshold}', notification.high_amount.toLocaleString()),
        category: 'health_alert',
        priority: 'medium',
        data: { current: currentSteps, threshold: notification.high_amount },
        icon: notification.icon,
      });
    }
    
    if (notification.low_amount && currentSteps <= notification.low_amount) {
      alerts.push({
        type: 'steps_low_threshold',
        title: notification.title || 'Low Step Count Alert',
        message: notification.message.replace('{current}', currentSteps.toLocaleString()).replace('{threshold}', notification.low_amount.toLocaleString()),
        category: 'encouragement',
        priority: 'medium',
        data: { current: currentSteps, threshold: notification.low_amount },
        icon: notification.icon
      });
    }
  });
  
  return alerts;
}

async function checkCalorieAlerts(currentCalories, caloriesGoal, caloriesNotifications, userId) {
  const alerts = [];
  const cooldownKey = `calories_${userId}`;
  
  if (isInCooldown(cooldownKey)) {
    return alerts;
  }
  
  if (caloriesGoal && currentCalories >= caloriesGoal.target) {
    const percentage = Math.round((currentCalories / caloriesGoal.target) * 100);
    alerts.push({
      type: 'calories_goal_achieved',
      title: 'Calorie Goal Achieved!',
      message: `Amazing! You've burned ${currentCalories.toLocaleString()} calories today, reaching ${percentage}% of your ${caloriesGoal.target.toLocaleString()} calorie target.`,
      category: 'achievement',
      priority: 'high',
      data: { current: currentCalories, goal: caloriesGoal.target, percentage },
      icon: caloriesGoal.icon
    });
    setCooldown(cooldownKey);
  }
  
  caloriesNotifications.notifications.forEach(notification => {
    if (notification.high_amount && currentCalories >= notification.high_amount) {
      alerts.push({
        type: 'calories_high_threshold',
        title: notification.title || 'High Calorie Burn Alert!',
        message: notification.message.replace('{current}', currentCalories.toLocaleString()).replace('{threshold}', notification.high_amount.toLocaleString()),
        category: 'health_alert',
        priority: 'medium',
        data: { current: currentCalories, threshold: notification.high_amount },
        icon: notification.icon
      });
    }
    
    if (notification.low_amount && currentCalories <= notification.low_amount) {
      alerts.push({
        type: 'calories_low_threshold',
        title: notification.title || 'Low Calorie Burn Alert',
        message: notification.message.replace('{current}', currentCalories.toLocaleString()).replace('{threshold}', notification.low_amount.toLocaleString()),
        category: 'encouragement',
        priority: 'medium',
        data: { current: currentCalories, threshold: notification.low_amount },
        icon: notification.icon
      });
    }
  });
  
  return alerts;
}

async function checkHeartRateAlerts(currentHeartRate, heartRateGoal, heartRateNotifications, userId) {
  const alerts = [];
  const cooldownKey = `heart_rate_${userId}`;
  
  if (isInCooldown(cooldownKey)) {
    return alerts;
  }
  
  heartRateNotifications.notifications.forEach(notification => {
    if (notification.high_amount && currentHeartRate >= notification.high_amount) {
      alerts.push({
        type: 'heart_rate_high_threshold',
        title: notification.title || 'High Heart Rate Alert!',
        message: notification.message.replace('{current}', currentHeartRate).replace('{threshold}', notification.high_amount),
        category: 'health_concern',
        priority: 'high',
        data: { current: currentHeartRate, threshold: notification.high_amount },
        icon: notification.icon
      });
      setCooldown(cooldownKey);
    }
    
    if (notification.low_amount && currentHeartRate <= notification.low_amount) {
      alerts.push({
        type: 'heart_rate_low_threshold',
        title: notification.title || 'Low Heart Rate Alert',
        message: notification.message.replace('{current}', currentHeartRate).replace('{threshold}', notification.low_amount),
        category: 'health_concern',
        priority: 'high',
        data: { current: currentHeartRate, threshold: notification.low_amount },
        icon: notification.icon
      });
      setCooldown(cooldownKey);
    }
  });
  
  return alerts;
}

async function checkSleepAlerts(currentSleep, sleepGoal, userId) {
  const alerts = [];
  const cooldownKey = `sleep_${userId}`;
  
  if (isInCooldown(cooldownKey)) {
    return alerts;
  }
  
  if (currentSleep >= sleepGoal.target) {
    alerts.push({
      type: 'sleep_goal_achieved',
      title: 'Sleep Goal Achieved!',
      message: `Well rested! You got ${currentSleep} hours of sleep, meeting your ${sleepGoal.target}-hour target. Quality sleep is essential for health and recovery.`,
      category: 'achievement',
      priority: 'medium',
      data: { current: currentSleep, goal: sleepGoal.target },
      icon: sleepGoal.icon
    });
    setCooldown(cooldownKey);
  }
  
  return alerts;
}

async function sendHealthAlerts(userData, alerts) {
  let sent = 0;
  let failed = 0;
  
  try {
    const emailContent = generateEmailHTML(userData, alerts);
    
    const mailOptions = {
      from: 'Health Tracker <garymcflarry0807@gmail.com>',
      to: userData.email,
      subject: `Health Alert: ${alerts[0].title} - Health Tracker`,
      html: emailContent
    };
    
    await transporter.sendMail(mailOptions);
    sent++;
    
  } catch (error) {
    failed++;
  }
  
  return { sent, failed };
}

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
    
    let icon = '📊';
    if (alert.icon) {
      if (alert.icon.includes('shoe')) {
        icon = '👟';
      } else if (alert.icon.includes('flame')) {
        icon = '🔥';
      } else if (alert.icon.includes('moon')) {
        icon = '🌙';
      } else if (alert.icon.includes('heart')) {
        icon = '❤️';
      } else {
        icon = alert.icon.length <= 4 ? alert.icon : '📊';
      }
    }
    
    alertsHTML += `
      <div style="margin: 20px 0; padding: 25px; background-color: #ffffff; border-left: 5px solid ${categoryColor}; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
        <div style="margin-bottom: 15px;">
          <h3 style="margin: 0; color: ${categoryColor}; font-size: 20px; font-weight: bold;">
            <span style="font-size: 24px; margin-right: 10px;">${icon}</span>${alert.title}
          </h3>
        </div>
        <p style="margin: 0; color: #333; line-height: 1.6; font-size: 16px;">${alert.message}</p>
        ${alert.data ? `
          <div style="margin-top: 15px; padding: 12px; background-color: #f8f9fa; border-radius: 8px; font-size: 14px; color: #666;">
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
    <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f0f2f5;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
                <td>
                    <div style="max-width: 600px; margin: 0 auto; background-color: white;">
                        <div style="background-color: #343a40; color: white; padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; font-size: 32px; font-weight: bold;">Health Tracker</h1>
                            <p style="margin: 15px 0 0 0; font-size: 18px;">${title}</p>
                        </div>
                        
                        <div style="padding: 40px 30px; background-color: #f8f9fa;">
                            <p style="font-size: 20px; color: #333; margin: 0 0 25px 0; font-weight: 500;">Hi ${userName},</p>
                            
                            ${alertsHTML}
                            
                            <div style="margin: 40px 0; padding: 30px; background-color: #007bff; border-radius: 15px; text-align: center;">
                                <p style="margin: 0 0 20px 0; color: white; font-weight: bold; font-size: 20px;">
                                    Keep tracking your health journey!
                                </p>
                                <a href="http://localhost:3000/dashboard" 
                                   style="display: inline-block; background-color: white; color: #007bff; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
                                    View Full Dashboard →
                                </a>
                            </div>
                        </div>
                        
                        <div style="background-color: #343a40; padding: 25px 30px; color: white; text-align: center;">
                            <p style="margin: 0; font-size: 14px; line-height: 1.6;">
                                This is an automated health notification from Health Tracker.
                            </p>
                        </div>
                    </div>
                </td>
            </tr>
        </table>
    </body>
    </html>
  `;
}

function isInCooldown(key) {
  const cooldown = alertCooldowns.get(key);
  if (!cooldown) return false;
  
  const timePassed = Date.now() - cooldown;
  const cooldownExpired = true;
  
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