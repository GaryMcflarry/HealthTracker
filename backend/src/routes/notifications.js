const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { eq, and, gte } = require('drizzle-orm');
const { db } = require('../db');
const { usersTable, notificationsTable } = require('../db/schema');

// Email setup
const transporter = nodemailer.createTransporter({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'garymcflarry0807@gmail.com',
    pass: 'zcqc czth mvfc cbht'
  }
});

// Thresholds
const THRESHOLDS = {
  steps: { high: 15000, low: 1000 },
  heart_rate: { high: 100, low: 45 },
  calories: { high: 3500, low: 500 }
};

// Main endpoint
router.post('/check-health-alerts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { healthData } = req.body;
    
    const user = await db.select().from(usersTable).where(eq(usersTable.id, parseInt(userId))).limit(1);
    if (user.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const userData = user[0];
    if (!userData.email) return res.status(400).json({ error: 'No email configured' });
    
    const alerts = checkAlerts(healthData);
    const emailResults = await sendEmails(userData, alerts);
    
    res.json({
      message: 'Health alerts checked',
      alertsTriggered: alerts.length,
      emailsSent: emailResults.sent,
      alerts: alerts
    });
    
  } catch (error) {
    console.error('Health alert error:', error);
    res.status(500).json({ error: 'Failed to check health alerts' });
  }
});

function checkAlerts(healthData) {
  const alerts = [];
  
  // Check steps
  if (healthData.steps > THRESHOLDS.steps.high) {
    alerts.push({
      type: 'steps_high',
      title: 'Outstanding Step Count!',
      message: `Amazing! You've walked ${healthData.steps.toLocaleString()} steps today!`,
      category: 'achievement'
    });
  } else if (healthData.steps < THRESHOLDS.steps.low && healthData.steps > 0) {
    alerts.push({
      type: 'steps_low',
      title: 'Low Activity Reminder',
      message: `You've only taken ${healthData.steps} steps today. Try to move more!`,
      category: 'inactivity'
    });
  }
  
  // Check heart rate
  if (healthData.heartRate > THRESHOLDS.heart_rate.high) {
    alerts.push({
      type: 'heart_rate_high',
      title: 'Elevated Heart Rate',
      message: `Your heart rate is ${healthData.heartRate} BPM. Consider resting.`,
      category: 'health_concern'
    });
  }
  
  // Check calories
  if (healthData.calories > THRESHOLDS.calories.high) {
    alerts.push({
      type: 'calories_high',
      title: 'High Calorie Burn',
      message: `You've burned ${healthData.calories} calories today. Make sure to refuel!`,
      category: 'health_concern'
    });
  }
  
  return alerts;
}

async function sendEmails(userData, alerts) {
  let sent = 0;
  
  for (const alert of alerts) {
    try {
      await transporter.sendMail({
        from: 'Health Tracker <garymcflarry0807@gmail.com>',
        to: userData.email,
        subject: `Health Alert: ${alert.title}`,
        html: `
          <h2>${alert.title}</h2>
          <p>Hi ${userData.first_name || 'User'},</p>
          <p>${alert.message}</p>
          <p>Stay healthy!</p>
        `
      });
      
      // Store notification
      await db.insert(notificationsTable).values({
        user_id: userData.id,
        title: alert.title,
        message: alert.message,
        notification_type: alert.type,
        created_at: new Date()
      });
      
      sent++;
      console.log(`✅ Email sent: ${alert.type}`);
    } catch (error) {
      console.error(`❌ Email failed: ${alert.type}`, error);
    }
  }
  
  return { sent };
}

// Test endpoint
router.post('/test/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await db.select().from(usersTable).where(eq(usersTable.id, parseInt(userId))).limit(1);
    
    if (user.length === 0) return res.status(404).json({ error: 'User not found' });
    if (!user[0].email) return res.status(400).json({ error: 'No email configured' });
    
    await transporter.sendMail({
      from: 'Health Tracker <garymcflarry0807@gmail.com>',
      to: user[0].email,
      subject: 'Test Health Alert',
      html: '<h2>Test Alert</h2><p>Your health notifications are working!</p>'
    });
    
    res.json({ message: 'Test email sent successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

module.exports = router;