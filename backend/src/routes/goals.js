const express = require('express');
const { eq, and } = require('drizzle-orm');
const { db } = require('../db');
const { goalsTable } = require('../db/schema');
const { authMiddleware } = require('../lib/auth');
const { asyncHandler, calculateProgress } = require('../lib/utils');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all goals for current user
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  
  const results = await db
    .select()
    .from(goalsTable)
    .where(eq(goalsTable.user_id, userId));
  
  // Calculate progress for each goal
  const goalsWithProgress = results.map(goal => ({
    ...goal,
    progressPercentage: calculateProgress(goal.current_value, goal.target_value)
  }));

  res.json({
    message: 'Successfully fetched user goals',
    data: goalsWithProgress
  });
}));

// Create new goal
router.post('/', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { goalType, targetValue, icon } = req.body;

  const results = await db.insert(goalsTable).values({
    user_id: userId,
    goal_type: goalType,
    target_value: parseFloat(targetValue),
    current_value: 0,
    icon,
    is_completed: false
  });

  const id = results[0]?.insertId || results[0]?.id;
  
  res.status(201).json({
    message: `Successfully created goal ${id}`,
    data: id
  });
}));

// Get goal by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  
  const results = await db
    .select()
    .from(goalsTable)
    .where(and(
      eq(goalsTable.id, parseInt(id)),
      eq(goalsTable.user_id, userId)
    ));
  
  if (results.length === 0) {
    return res.status(404).json({ error: `Goal with id ${id} not found` });
  }

  const goal = results[0];
  const goalWithProgress = {
    ...goal,
    progressPercentage: calculateProgress(goal.current_value, goal.target_value)
  };
  
  res.json({
    message: `Successfully fetched goal ${goal.goalID}`,
    data: goalWithProgress
  });
}));

// Update goal
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  const updateData = req.body;

  // Remove fields that shouldn't be updated directly
  delete updateData.goalID;
  delete updateData.userID;
  delete updateData.createdAt;

  // Check if goal belongs to user
  const existingGoal = await db
    .select()
    .from(goalsTable)
    .where(and(
      eq(goalsTable.id, parseInt(id)),
      eq(goalsTable.user_id, userId)
    ));

  if (existingGoal.length === 0) {
    return res.status(404).json({ error: `Goal with id ${id} not found` });
  }

  await db
    .update(goalsTable)
    .set(updateData)
    .where(and(
      eq(goalsTable.id, parseInt(id)),
      eq(goalsTable.user_id, userId)
    ));
  
  res.json({
    message: `Successfully updated goal ${id}`
  });
}));

// Update goal progress
router.patch('/:id/progress', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  const { currentValue } = req.body;

  // Check if goal belongs to user
  const existingGoal = await db
    .select()
    .from(goalsTable)
    .where(and(
      eq(goalsTable.id, parseInt(id)),
      eq(goalsTable.user_id, userId)
    ));

  if (existingGoal.length === 0) {
    return res.status(404).json({ error: `Goal with id ${id} not found` });
  }

  const goal = existingGoal[0];
  const newCurrentValue = parseFloat(currentValue);
  const isCompleted = newCurrentValue >= goal.target_value;

  await db
    .update(goalsTable)
    .set({ 
      current_value: newCurrentValue,
      is_completed: isCompleted 
    })
    .where(and(
      eq(goalsTable.id, parseInt(id)),
      eq(goalsTable.user_id, userId)
    ));

  const progressPercentage = calculateProgress(newCurrentValue, goal.target_value);
  
  res.json({
    message: `Successfully updated goal progress`,
    data: {
      currentValue: newCurrentValue,
      targetValue: goal.target_value,
      progressPercentage,
      isCompleted
    }
  });
}));

// Delete goal
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  
  // Check if goal belongs to user
  const existingGoal = await db
    .select()
    .from(goalsTable)
    .where(and(
      eq(goalsTable.id, parseInt(id)),
      eq(goalsTable.user_id, userId)
    ));

  if (existingGoal.length === 0) {
    return res.status(404).json({ error: `Goal with id ${id} not found` });
  }

  await db
    .delete(goalsTable)
    .where(and(
      eq(goalsTable.id, parseInt(id)),
      eq(goalsTable.user_id, userId)
    ));
  
  res.json({
    message: `Successfully deleted goal ${id}`
  });
}));

// Get goals by type
router.get('/type/:goalType', asyncHandler(async (req, res) => {
  const { goalType } = req.params;
  const userId = req.user.userID;
  
  const results = await db
    .select()
    .from(goalsTable)
    .where(and(
      eq(goalsTable.user_id, userId),
      eq(goalsTable.goal_type, goalType)
    ));
  
  const goalsWithProgress = results.map(goal => ({
    ...goal,
    progressPercentage: calculateProgress(goal.current_value, goal.target_value)
  }));

  res.json({
    message: `Successfully fetched ${goalType} goals`,
    data: goalsWithProgress
  });
}));

// Get goal statistics
router.get('/stats/summary', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  
  const results = await db
    .select()
    .from(goalsTable)
    .where(eq(goalsTable.user_id, userId));

  const stats = results.reduce((acc, goal) => {
    acc.total++;
    
    if (goal.is_completed) {
      acc.completed++;
    }
    
    const progress = calculateProgress(goal.current_value, goal.target_value);
    if (progress >= 75) {
      acc.nearCompletion++;
    }
    
    // Count by type
    acc.byType[goal.goal_type] = (acc.byType[goal.goal_type] || 0) + 1;
    
    // Count by timeframe
    acc.byTimeFrame[goal.time_frame] = (acc.byTimeFrame[goal.time_frame] || 0) + 1;
    
    return acc;
  }, {
    total: 0,
    completed: 0,
    nearCompletion: 0,
    byType: {},
    byTimeFrame: {}
  });

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  res.json({
    message: 'Successfully fetched goal statistics',
    data: {
      totalGoals: stats.total,
      completedGoals: stats.completed,
      goalsNearCompletion: stats.nearCompletion,
      completionRate: `${completionRate}%`,
      goalsByType: stats.byType,
      goalsByTimeFrame: stats.byTimeFrame
    }
  });
}));

// Mark goal as completed
router.patch('/:id/complete', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;

  // Check if goal belongs to user
  const existingGoal = await db
    .select()
    .from(goalsTable)
    .where(and(
      eq(goalsTable.goalID, parseInt(id)),
      eq(goalsTable.userID, userId)
    ));

  if (existingGoal.length === 0) {
    return res.status(404).json({ error: `Goal with id ${id} not found` });
  }

  const goal = existingGoal[0];

  await db
    .update(goalsTable)
    .set({ 
      isCompleted: true,
      currentValue: goal.targetValue // Set current to target when manually completed
    })
    .where(and(
      eq(goalsTable.goalID, parseInt(id)),
      eq(goalsTable.userID, userId)
    ));

  // Create notification for goal completion
  const { notificationsTable } = require('../db/schema');
  await db.insert(notificationsTable).values({
    userID: userId,
    title: `Goal Completed: ${goal.goalType}!`,
    message: `Congratulations! You've achieved your ${goal.goalType} goal of ${goal.targetValue}.`,
    notificationType: 'goal_achieved',
    date: new Date()
  }).catch(err => console.log('Notification creation failed:', err.message));
  
  res.json({
    message: `Successfully marked goal as completed`,
    data: {
      goalID: parseInt(id),
      goalType: goal.goalType,
      targetValue: goal.targetValue,
      isCompleted: true,
      progressPercentage: 100
    }
  });
}));

// Reset goal progress
router.patch('/:id/reset', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;

  // Check if goal belongs to user
  const existingGoal = await db
    .select()
    .from(goalsTable)
    .where(and(
      eq(goalsTable.goalID, parseInt(id)),
      eq(goalsTable.userID, userId)
    ));

  if (existingGoal.length === 0) {
    return res.status(404).json({ error: `Goal with id ${id} not found` });
  }

  await db
    .update(goalsTable)
    .set({ 
      currentValue: 0,
      isCompleted: false
    })
    .where(and(
      eq(goalsTable.goalID, parseInt(id)),
      eq(goalsTable.userID, userId)
    ));
  
  res.json({
    message: `Successfully reset goal progress`,
    data: {
      goalID: parseInt(id),
      currentValue: 0,
      isCompleted: false,
      progressPercentage: 0
    }
  });
}));

// Bulk create goals
router.post('/bulk', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { goals } = req.body;

  if (!Array.isArray(goals) || goals.length === 0) {
    return res.status(400).json({ error: 'goals must be a non-empty array' });
  }

  // Validate and prepare data
  const validatedGoals = goals.map(goal => ({
    userID: userId,
    goalType: goal.goalType,
    targetValue: parseFloat(goal.targetValue),
    currentValue: goal.currentValue ? parseFloat(goal.currentValue) : 0,
    timeFrame: goal.timeFrame,
    icon: goal.icon,
    isCompleted: false
  }));

  const results = await db.insert(goalsTable).values(validatedGoals);
  
  res.status(201).json({
    message: `Successfully created ${validatedGoals.length} goals`,
    data: { createdCount: validatedGoals.length }
  });
}));

// Update multiple goals progress (useful for automated updates from wearable data)
router.patch('/bulk/progress', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { progressUpdates } = req.body;

  if (!Array.isArray(progressUpdates) || progressUpdates.length === 0) {
    return res.status(400).json({ error: 'progressUpdates must be a non-empty array' });
  }

  const updatedGoals = [];

  for (const update of progressUpdates) {
    const { goalType, currentValue } = update;
    
    // Find goals of this type for the user
    const goals = await db
      .select()
      .from(goalsTable)
      .where(and(
        eq(goalsTable.userID, userId),
        eq(goalsTable.goalType, goalType),
        eq(goalsTable.isCompleted, false)
      ));

    for (const goal of goals) {
      const newCurrentValue = parseFloat(currentValue);
      const isCompleted = newCurrentValue >= goal.targetValue;

      await db
        .update(goalsTable)
        .set({ 
          currentValue: newCurrentValue,
          isCompleted
        })
        .where(eq(goalsTable.goalID, goal.goalID));

      updatedGoals.push({
        goalID: goal.goalID,
        goalType: goal.goalType,
        currentValue: newCurrentValue,
        targetValue: goal.targetValue,
        progressPercentage: calculateProgress(newCurrentValue, goal.targetValue),
        isCompleted
      });

      // Create notification if goal was just completed
      if (isCompleted && !goal.isCompleted) {
        const { notificationsTable } = require('../db/schema');
        await db.insert(notificationsTable).values({
          userID: userId,
          title: `Goal Achieved: ${goal.goalType}!`,
          message: `Congratulations! You've achieved your ${goal.goalType} goal of ${goal.targetValue}.`,
          notificationType: 'goal_achieved',
          date: new Date()
        }).catch(err => console.log('Notification creation failed:', err.message));
      }
    }
  }

  res.json({
    message: `Successfully updated progress for ${updatedGoals.length} goals`,
    data: updatedGoals
  });
}));

module.exports = router;