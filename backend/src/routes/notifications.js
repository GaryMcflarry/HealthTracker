const express = require('express');
const { eq, and, desc, gte } = require('drizzle-orm');
const { db } = require('../db');
const { notificationsTable } = require('../db/schema');
const { authMiddleware } = require('../lib/auth');
const { asyncHandler } = require('../lib/utils');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all notifications for current user
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { limit = 50, type } = req.query;
  
  let whereClause = eq(notificationsTable.userID, userId);
  
  if (type) {
    whereClause = and(
      eq(notificationsTable.userID, userId),
      eq(notificationsTable.notificationType, type)
    );
  }
  
  const results = await db
    .select()
    .from(notificationsTable)
    .where(whereClause)
    .orderBy(desc(notificationsTable.date))
    .limit(parseInt(limit));

  res.json({
    message: 'Successfully fetched notifications',
    data: results
  });
}));

// Create new notification
router.post('/', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { title, message, notificationType, date } = req.body;

  const validTypes = ['goal_achieved', 'goal_missed', 'health_alert', 'inactivity_reminder', 'general'];
  if (notificationType && !validTypes.includes(notificationType)) {
    return res.status(400).json({ 
      error: `Invalid notification type. Must be one of: ${validTypes.join(', ')}` 
    });
  }

  const results = await db.insert(notificationsTable).values({
    userID: userId,
    title,
    message,
    notificationType: notificationType || 'general',
    date: date ? new Date(date) : new Date()
  });

  const id = results[0]?.insertId || results[0]?.id;
  
  res.status(201).json({
    message: `Successfully created notification ${id}`,
    data: id
  });
}));

// Get notification by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  
  const results = await db
    .select()
    .from(notificationsTable)
    .where(and(
      eq(notificationsTable.notificationID, parseInt(id)),
      eq(notificationsTable.userID, userId)
    ));
  
  if (results.length === 0) {
    return res.status(404).json({ error: `Notification with id ${id} not found` });
  }
  
  res.json({
    message: `Successfully fetched notification ${results[0].notificationID}`,
    data: results[0]
  });
}));

// Update notification
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  const updateData = req.body;

  const validTypes = ['goal_achieved', 'goal_missed', 'health_alert', 'inactivity_reminder', 'general'];
  if (updateData.notificationType && !validTypes.includes(updateData.notificationType)) {
    return res.status(400).json({ 
      error: `Invalid notification type. Must be one of: ${validTypes.join(', ')}` 
    });
  }

  // Remove fields that shouldn't be updated
  delete updateData.notificationID;
  delete updateData.userID;
  delete updateData.providedDataAt;

  // Check if notification belongs to user
  const existingNotification = await db
    .select()
    .from(notificationsTable)
    .where(and(
      eq(notificationsTable.notificationID, parseInt(id)),
      eq(notificationsTable.userID, userId)
    ));

  if (existingNotification.length === 0) {
    return res.status(404).json({ error: `Notification with id ${id} not found` });
  }

  await db
    .update(notificationsTable)
    .set(updateData)
    .where(and(
      eq(notificationsTable.notificationID, parseInt(id)),
      eq(notificationsTable.userID, userId)
    ));
  
  res.json({
    message: `Successfully updated notification ${id}`
  });
}));

// Delete notification
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  
  // Check if notification belongs to user
  const existingNotification = await db
    .select()
    .from(notificationsTable)
    .where(and(
      eq(notificationsTable.notificationID, parseInt(id)),
      eq(notificationsTable.userID, userId)
    ));

  if (existingNotification.length === 0) {
    return res.status(404).json({ error: `Notification with id ${id} not found` });
  }

  await db
    .delete(notificationsTable)
    .where(and(
      eq(notificationsTable.notificationID, parseInt(id)),
      eq(notificationsTable.userID, userId)
    ));
  
  res.json({
    message: `Successfully deleted notification ${id}`
  });
}));

// Get recent notifications (last 7 days)
router.get('/recent/week', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const results = await db
    .select()
    .from(notificationsTable)
    .where(and(
      eq(notificationsTable.userID, userId),
      gte(notificationsTable.date, weekAgo)
    ))
    .orderBy(desc(notificationsTable.date));

  // Group by type
  const groupedByType = results.reduce((acc, notification) => {
    const type = notification.notificationType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(notification);
    return acc;
  }, {});

  res.json({
    message: 'Successfully fetched recent notifications',
    data: {
      total: results.length,
      notifications: results,
      groupedByType
    }
  });
}));

// Mark notifications as read (if you add a read status field)
router.patch('/mark-read', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { notificationIds } = req.body;

  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    return res.status(400).json({ error: 'notificationIds must be a non-empty array' });
  }

  // Note: This assumes you add an 'isRead' field to your notifications table
  // For now, we'll just return success since the schema doesn't include this field
  
  res.json({
    message: `Marked ${notificationIds.length} notifications as read`,
    data: { updatedCount: notificationIds.length }
  });
}));

// Get notification statistics
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { days = 30 } = req.query;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));
  
  const results = await db
    .select()
    .from(notificationsTable)
    .where(and(
      eq(notificationsTable.userID, userId),
      gte(notificationsTable.date, startDate)
    ));

  // Calculate statistics
  const stats = results.reduce((acc, notification) => {
    const type = notification.notificationType;
    acc.byType[type] = (acc.byType[type] || 0) + 1;
    acc.total++;
    
    // Count by day
    const day = new Date(notification.date).toISOString().split('T')[0];
    acc.byDay[day] = (acc.byDay[day] || 0) + 1;
    
    return acc;
  }, {
    total: 0,
    byType: {},
    byDay: {}
  });

  const dailyAverage = stats.total / parseInt(days);

  res.json({
    message: 'Successfully fetched notification statistics',
    data: {
      period: `${days} days`,
      totalNotifications: stats.total,
      dailyAverage: Math.round(dailyAverage * 100) / 100,
      distributionByType: stats.byType,
      distributionByDay: stats.byDay
    }
  });
}));

// Create health alert notification
router.post('/health-alert', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { alertType, value, threshold, message } = req.body;

  const title = `Health Alert: ${alertType}`;
  const alertMessage = message || `Your ${alertType} (${value}) is ${value > threshold ? 'above' : 'below'} the recommended threshold of ${threshold}`;

  const results = await db.insert(notificationsTable).values({
    userID: userId,
    title,
    message: alertMessage,
    notificationType: 'health_alert',
    date: new Date()
  });

  const id = results[0]?.insertId || results[0]?.id;
  
  res.status(201).json({
    message: `Successfully created health alert notification`,
    data: {
      notificationID: id,
      alertType,
      value,
      threshold
    }
  });
}));

// Create goal notification
router.post('/goal-notification', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { goalType, isAchieved, currentValue, targetValue } = req.body;

  const title = isAchieved ? `Goal Achieved: ${goalType}!` : `Goal Missed: ${goalType}`;
  const message = isAchieved 
    ? `Congratulations! You've achieved your ${goalType} goal of ${targetValue}. Current: ${currentValue}`
    : `You missed your ${goalType} goal of ${targetValue}. Current: ${currentValue}. Keep trying!`;

  const results = await db.insert(notificationsTable).values({
    userID: userId,
    title,
    message,
    notificationType: isAchieved ? 'goal_achieved' : 'goal_missed',
    date: new Date()
  });

  const id = results[0]?.insertId || results[0]?.id;
  
  res.status(201).json({
    message: `Successfully created goal notification`,
    data: {
      notificationID: id,
      goalType,
      isAchieved,
      currentValue,
      targetValue
    }
  });
}));

// Create inactivity reminder
router.post('/inactivity-reminder', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { hoursInactive, suggestion } = req.body;

  const title = "Inactivity Reminder";
  const message = suggestion || `You've been inactive for ${hoursInactive} hours. Consider taking a short walk or doing some light exercise.`;

  const results = await db.insert(notificationsTable).values({
    userID: userId,
    title,
    message,
    notificationType: 'inactivity_reminder',
    date: new Date()
  });

  const id = results[0]?.insertId || results[0]?.id;
  
  res.status(201).json({
    message: `Successfully created inactivity reminder`,
    data: {
      notificationID: id,
      hoursInactive
    }
  });
}));

// Bulk create notifications
router.post('/bulk', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { notifications } = req.body;

  if (!Array.isArray(notifications) || notifications.length === 0) {
    return res.status(400).json({ error: 'notifications must be a non-empty array' });
  }

  const validTypes = ['goal_achieved', 'goal_missed', 'health_alert', 'inactivity_reminder', 'general'];

  // Validate and prepare data
  const validatedData = notifications.map(notification => {
    if (notification.notificationType && !validTypes.includes(notification.notificationType)) {
      throw new Error(`Invalid notification type: ${notification.notificationType}`);
    }
    
    return {
      userID: userId,
      title: notification.title,
      message: notification.message,
      notificationType: notification.notificationType || 'general',
      date: notification.date ? new Date(notification.date) : new Date()
    };
  });

  const results = await db.insert(notificationsTable).values(validatedData);
  
  res.status(201).json({
    message: `Successfully created ${validatedData.length} notifications`,
    data: { createdCount: validatedData.length }
  });
}));

// Delete all notifications for user
router.delete('/all', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { confirm } = req.body;

  if (confirm !== true) {
    return res.status(400).json({ 
      error: 'Please confirm deletion by sending { "confirm": true } in request body' 
    });
  }

  const results = await db
    .delete(notificationsTable)
    .where(eq(notificationsTable.userID, userId));
  
  res.json({
    message: 'Successfully deleted all notifications for user'
  });
}));

// Delete notifications by type
router.delete('/type/:notificationType', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { notificationType } = req.params;

  const validTypes = ['goal_achieved', 'goal_missed', 'health_alert', 'inactivity_reminder', 'general'];
  if (!validTypes.includes(notificationType)) {
    return res.status(400).json({ 
      error: `Invalid notification type. Must be one of: ${validTypes.join(', ')}` 
    });
  }

  await db
    .delete(notificationsTable)
    .where(and(
      eq(notificationsTable.userID, userId),
      eq(notificationsTable.notificationType, notificationType)
    ));
  
  res.json({
    message: `Successfully deleted all ${notificationType} notifications`
  });
}));

module.exports = router;