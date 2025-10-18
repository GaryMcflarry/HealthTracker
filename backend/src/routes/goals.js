const express = require('express');
const { eq, and } = require('drizzle-orm');
const { db } = require('../db');
const { goalsTable } = require('../db/schema');
const { asyncHandler, calculateProgress } = require('../lib/utils');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required as query parameter' });
  }
  
  const userIdNum = parseInt(userId);
  if (isNaN(userIdNum) || userIdNum <= 0) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  
  const results = await db
    .select({
      id: goalsTable.id,
      goalType: goalsTable.goal_type,
      targetValue: goalsTable.target_value,
      icon: goalsTable.icon
    })
    .from(goalsTable)
    .where(eq(goalsTable.user_id, userIdNum));

  res.json({
    message: 'Successfully fetched user goals',
    data: results
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { goalType, targetValue, icon } = req.body;

  if (!goalType || targetValue === undefined) {
    return res.status(400).json({ error: 'Goal type and target value are required' });
  }

  const validGoalTypes = ['steps', 'calories', 'sleep', 'heart_rate'];
  if (!validGoalTypes.includes(goalType)) {
    return res.status(400).json({ error: 'Goal type must be one of: steps, calories, sleep, heart_rate' });
  }

  const targetValueNum = parseFloat(targetValue);
  if (isNaN(targetValueNum) || targetValueNum <= 0) {
    return res.status(400).json({ error: 'Target value must be a positive number' });
  }

  const existingGoal = await db
    .select()
    .from(goalsTable)
    .where(and(
      eq(goalsTable.user_id, userId),
      eq(goalsTable.goal_type, goalType)
    ));

  if (existingGoal.length > 0) {
    return res.status(400).json({ error: `Goal already exists for ${goalType}. Use PUT to update.` });
  }

  const results = await db.insert(goalsTable).values({
    user_id: userId,
    goal_type: goalType,
    target_value: targetValueNum,
    icon: icon
  });

  const id = results[0]?.insertId || results[0]?.id;
  
  res.status(201).json({
    message: `Successfully created goal ${id}`,
    data: { goalId: id }
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required as query parameter' });
  }
  
  const goalIdToFind = parseInt(id);
  const userIdNum = parseInt(userId);
  
  if (isNaN(goalIdToFind) || goalIdToFind <= 0) {
    return res.status(400).json({ error: 'Invalid goal ID format' });
  }
  
  if (isNaN(userIdNum) || userIdNum <= 0) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  
  const results = await db
    .select({
      id: goalsTable.id,
      goalType: goalsTable.goal_type,
      targetValue: goalsTable.target_value,
      icon: goalsTable.icon
    })
    .from(goalsTable)
    .where(and(
      eq(goalsTable.id, goalIdToFind),
      eq(goalsTable.user_id, userIdNum)
    ));
  
  if (results.length === 0) {
    return res.status(404).json({ error: `Goal with id ${id} not found` });
  }

  const goal = results[0];
  
  res.json({
    message: `Successfully fetched goal ${goal.id}`,
    data: goal
  });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId, goalType, targetValue, icon } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required in request body' });
  }
  
  const goalIdToUpdate = parseInt(id);
  const userIdNum = parseInt(userId);
  
  if (isNaN(goalIdToUpdate) || goalIdToUpdate <= 0) {
    return res.status(400).json({ error: 'Invalid goal ID format' });
  }
  
  if (isNaN(userIdNum) || userIdNum <= 0) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  const existingGoal = await db
    .select()
    .from(goalsTable)
    .where(and(
      eq(goalsTable.id, goalIdToUpdate),
      eq(goalsTable.user_id, userIdNum)
    ));

  if (existingGoal.length === 0) {
    return res.status(404).json({ error: `Goal with id ${id} not found` });
  }

  const updateData = {};

  if (goalType !== undefined) {
    const validGoalTypes = ['steps', 'calories', 'sleep', 'heart_rate'];
    if (!validGoalTypes.includes(goalType)) {
      return res.status(400).json({ error: 'Goal type must be one of: steps, calories, sleep, heart_rate' });
    }
    updateData.goal_type = goalType;
  }

  if (targetValue !== undefined) {
    const targetValueNum = parseFloat(targetValue);
    if (isNaN(targetValueNum) || targetValueNum <= 0) {
      return res.status(400).json({ error: 'Target value must be a positive number' });
    }
    updateData.target_value = targetValueNum;
  }

  if (icon !== undefined) {
    if (typeof icon !== 'string') {
      return res.status(400).json({ error: 'Icon must be a string' });
    }
    updateData.icon = icon;
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided for update' });
  }

  await db
    .update(goalsTable)
    .set(updateData)
    .where(and(
      eq(goalsTable.id, goalIdToUpdate),
      eq(goalsTable.user_id, userIdNum)
    ));
  
  const updatedGoal = await db
    .select({
      id: goalsTable.id,
      goalType: goalsTable.goal_type,
      targetValue: goalsTable.target_value,
      icon: goalsTable.icon
    })
    .from(goalsTable)
    .where(eq(goalsTable.id, goalIdToUpdate));
  
  res.json({
    message: `Successfully updated goal`,
    data: updatedGoal[0]
  });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required in request body' });
  }
  
  const goalIdToDelete = parseInt(id);
  const userIdNum = parseInt(userId);
  
  if (isNaN(goalIdToDelete) || goalIdToDelete <= 0) {
    return res.status(400).json({ error: 'Invalid goal ID format' });
  }
  
  if (isNaN(userIdNum) || userIdNum <= 0) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  
  const existingGoal = await db
    .select()
    .from(goalsTable)
    .where(and(
      eq(goalsTable.id, goalIdToDelete),
      eq(goalsTable.user_id, userIdNum)
    ));

  if (existingGoal.length === 0) {
    return res.status(404).json({ error: `Goal with id ${id} not found` });
  }

  await db
    .delete(goalsTable)
    .where(and(
      eq(goalsTable.id, goalIdToDelete),
      eq(goalsTable.user_id, userIdNum)
    ));
  
  res.json({
    message: `Successfully deleted goal ${id}`
  });
}));

router.get('/type/:goalType', asyncHandler(async (req, res) => {
  const { goalType } = req.params;
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required as query parameter' });
  }
  
  const userIdNum = parseInt(userId);
  if (isNaN(userIdNum) || userIdNum <= 0) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  
  const validGoalTypes = ['steps', 'calories', 'sleep', 'heart_rate'];
  if (!validGoalTypes.includes(goalType)) {
    return res.status(400).json({ error: 'Invalid goal type' });
  }
  
  const results = await db
    .select({
      id: goalsTable.id,
      goalType: goalsTable.goal_type,
      targetValue: goalsTable.target_value,
      icon: goalsTable.icon
    })
    .from(goalsTable)
    .where(and(
      eq(goalsTable.user_id, userIdNum),
      eq(goalsTable.goal_type, goalType)
    ));

  res.json({
    message: `Successfully fetched ${goalType} goals`,
    data: results
  });
}));

router.get('/stats/summary', asyncHandler(async (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required as query parameter' });
  }
  
  const userIdNum = parseInt(userId);
  if (isNaN(userIdNum) || userIdNum <= 0) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }
  
  const results = await db
    .select({
      goalType: goalsTable.goal_type,
      targetValue: goalsTable.target_value
    })
    .from(goalsTable)
    .where(eq(goalsTable.user_id, userIdNum));

  const stats = results.reduce((acc, goal) => {
    acc.total++;
    acc.byType[goal.goalType] = (acc.byType[goal.goalType] || 0) + 1;
    return acc;
  }, {
    total: 0,
    byType: {}
  });

  res.json({
    message: 'Successfully fetched goal statistics',
    data: {
      totalGoals: stats.total,
      goalsByType: stats.byType
    }
  });
}));

router.post('/bulk', asyncHandler(async (req, res) => {
  const { userId, goals } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const userIdNum = parseInt(userId);
  if (isNaN(userIdNum) || userIdNum <= 0) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  if (!Array.isArray(goals) || goals.length === 0) {
    return res.status(400).json({ error: 'goals must be a non-empty array' });
  }

  for (const goal of goals) {
    if (!goal.goalType || goal.targetValue === undefined) {
      return res.status(400).json({ error: 'Each goal must have goalType and targetValue' });
    }
    
    const validGoalTypes = ['steps', 'calories', 'sleep', 'heart_rate'];
    if (!validGoalTypes.includes(goal.goalType)) {
      return res.status(400).json({ error: 'Invalid goal type: ' + goal.goalType });
    }
    
    if (isNaN(parseFloat(goal.targetValue)) || parseFloat(goal.targetValue) <= 0) {
      return res.status(400).json({ error: 'Target value must be a positive number' });
    }
  }

  const existingGoals = await db
    .select()
    .from(goalsTable)
    .where(eq(goalsTable.user_id, userIdNum));

  let createdCount = 0;
  let updatedCount = 0;

  for (const goal of goals) {
    const existingGoal = existingGoals.find(g => g.goal_type === goal.goalType);
    
    if (existingGoal) {
      await db
        .update(goalsTable)
        .set({
          target_value: parseFloat(goal.targetValue),
          icon: goal.icon || existingGoal.icon
        })
        .where(eq(goalsTable.id, existingGoal.id));
      updatedCount++;
    } else {
      await db.insert(goalsTable).values({
        user_id: userIdNum,
        goal_type: goal.goalType,
        target_value: parseFloat(goal.targetValue),
        icon: goal.icon
      });
      createdCount++;
    }
  }
  
  res.status(201).json({
    message: `Successfully processed ${goals.length} goals`,
    data: { 
      createdCount,
      updatedCount,
      totalProcessed: createdCount + updatedCount
    }
  });
}));

module.exports = router;