const express = require('express');
const { eq, and, gte, lte, desc } = require('drizzle-orm');
const { db } = require('../db');
const { caloriesDataTable } = require('../db/schema');
const { authMiddleware } = require('../lib/auth');
const { asyncHandler, getDateRange, validateHealthData } = require('../lib/utils');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all calories data for current user
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { period = 'daily', limit = 100 } = req.query;
  
  const { startDate, endDate } = getDateRange(period);
  
  const results = await db
    .select()
    .from(caloriesDataTable)
    .where(and(
      eq(caloriesDataTable.userID, userId),
      gte(caloriesDataTable.date, startDate),
      lte(caloriesDataTable.date, endDate)
    ))
    .orderBy(desc(caloriesDataTable.date))
    .limit(parseInt(limit));

  res.json({
    message: 'Successfully fetched calories data',
    data: results
  });
}));

// Create new calories data entry
router.post('/', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { date, hour, calories } = req.body;

  // Validate calories data
  if (!validateHealthData('calories', calories)) {
    return res.status(400).json({ error: 'Invalid calories count. Must be between 0 and 10,000' });
  }

  const results = await db.insert(caloriesDataTable).values({
    userID: userId,
    date: new Date(date),
    hour: hour ? new Date(hour) : null,
    calories: parseInt(calories)
  });

  const id = results[0]?.insertId || results[0]?.id;
  
  res.status(201).json({
    message: `Successfully created calories data entry ${id}`,
    data: id
  });
}));

// Get calories data by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  
  const results = await db
    .select()
    .from(caloriesDataTable)
    .where(and(
      eq(caloriesDataTable.calorieID, parseInt(id)),
      eq(caloriesDataTable.userID, userId)
    ));
  
  if (results.length === 0) {
    return res.status(404).json({ error: `Calories data with id ${id} not found` });
  }
  
  res.json({
    message: `Successfully fetched calories data ${results[0].calorieID}`,
    data: results[0]
  });
}));

// Update calories data
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  const updateData = req.body;

  // Validate calories data if provided
  if (updateData.calories && !validateHealthData('calories', updateData.calories)) {
    return res.status(400).json({ error: 'Invalid calories count. Must be between 0 and 10,000' });
  }

  // Remove fields that shouldn't be updated
  delete updateData.calorieID;
  delete updateData.userID;
  delete updateData.providedDataAt;

  // Check if calories data belongs to user
  const existingData = await db
    .select()
    .from(caloriesDataTable)
    .where(and(
      eq(caloriesDataTable.calorieID, parseInt(id)),
      eq(caloriesDataTable.userID, userId)
    ));

  if (existingData.length === 0) {
    return res.status(404).json({ error: `Calories data with id ${id} not found` });
  }

  await db
    .update(caloriesDataTable)
    .set(updateData)
    .where(and(
      eq(caloriesDataTable.calorieID, parseInt(id)),
      eq(caloriesDataTable.userID, userId)
    ));
  
  res.json({
    message: `Successfully updated calories data ${id}`
  });
}));

// Delete calories data
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  
  // Check if calories data belongs to user
  const existingData = await db
    .select()
    .from(caloriesDataTable)
    .where(and(
      eq(caloriesDataTable.calorieID, parseInt(id)),
      eq(caloriesDataTable.userID, userId)
    ));

  if (existingData.length === 0) {
    return res.status(404).json({ error: `Calories data with id ${id} not found` });
  }

  await db
    .delete(caloriesDataTable)
    .where(and(
      eq(caloriesDataTable.calorieID, parseInt(id)),
      eq(caloriesDataTable.userID, userId)
    ));
  
  res.json({
    message: `Successfully deleted calories data ${id}`
  });
}));

// Get daily calories summary
router.get('/summary/daily', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { date } = req.query;
  
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const results = await db
    .select()
    .from(caloriesDataTable)
    .where(and(
      eq(caloriesDataTable.userID, userId),
      gte(caloriesDataTable.date, startOfDay),
      lte(caloriesDataTable.date, endOfDay)
    ));

  const totalCalories = results.reduce((sum, entry) => sum + (entry.calories || 0), 0);
  
  // Group by hour for hourly breakdown
  const hourlyBreakdown = results.reduce((acc, entry) => {
    if (entry.hour) {
      const hour = new Date(entry.hour).getHours();
      acc[hour] = (acc[hour] || 0) + entry.calories;
    }
    return acc;
  }, {});
  
  res.json({
    message: 'Successfully fetched daily calories summary',
    data: {
      date: targetDate.toISOString().split('T')[0],
      totalCalories,
      entries: results.length,
      hourlyBreakdown,
      hourlyData: results
    }
  });
}));

// Get weekly calories summary
router.get('/summary/weekly', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { startDate } = req.query;
  
  const weekStart = startDate ? new Date(startDate) : new Date();
  if (!startDate) {
    // Get start of current week (Sunday)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  }
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const results = await db
    .select()
    .from(caloriesDataTable)
    .where(and(
      eq(caloriesDataTable.userID, userId),
      gte(caloriesDataTable.date, weekStart),
      lte(caloriesDataTable.date, weekEnd)
    ))
    .orderBy(caloriesDataTable.date);

  const totalCalories = results.reduce((sum, entry) => sum + (entry.calories || 0), 0);
  const dailyAverage = results.length > 0 ? totalCalories / 7 : 0; // Average over 7 days
  
  // Group by day for daily breakdown
  const dailyBreakdown = results.reduce((acc, entry) => {
    const day = new Date(entry.date).toISOString().split('T')[0];
    acc[day] = (acc[day] || 0) + entry.calories;
    return acc;
  }, {});
  
  res.json({
    message: 'Successfully fetched weekly calories summary',
    data: {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      totalCalories,
      dailyAverage: Math.round(dailyAverage),
      entries: results.length,
      dailyBreakdown,
      dailyData: results
    }
  });
}));

// Get calories burned vs goals comparison
router.get('/vs-goals', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { period = 'daily' } = req.query;
  
  const { startDate, endDate } = getDateRange(period);
  
  // Get calories data
  const caloriesResults = await db
    .select()
    .from(caloriesDataTable)
    .where(and(
      eq(caloriesDataTable.userID, userId),
      gte(caloriesDataTable.date, startDate),
      lte(caloriesDataTable.date, endDate)
    ));

  // Get calories goals
  const { goalsTable } = require('../db/schema');
  const goalsResults = await db
    .select()
    .from(goalsTable)
    .where(and(
      eq(goalsTable.userID, userId),
      eq(goalsTable.goalType, 'calories')
    ));

  const totalCaloriesBurned = caloriesResults.reduce((sum, entry) => sum + entry.calories, 0);
  const caloriesGoal = goalsResults.length > 0 ? goalsResults[0].targetValue : 0;
  const progress = caloriesGoal > 0 ? Math.round((totalCaloriesBurned / caloriesGoal) * 100) : 0;

  res.json({
    message: 'Successfully compared calories vs goals',
    data: {
      period,
      totalCaloriesBurned,
      caloriesGoal,
      progress,
      difference: totalCaloriesBurned - caloriesGoal,
      isGoalMet: totalCaloriesBurned >= caloriesGoal
    }
  });
}));

// Get calories trends
router.get('/trends/:period', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { period } = req.params; // 'weekly' or 'monthly'
  
  const { startDate, endDate } = getDateRange(period);
  
  const results = await db
    .select()
    .from(caloriesDataTable)
    .where(and(
      eq(caloriesDataTable.userID, userId),
      gte(caloriesDataTable.date, startDate),
      lte(caloriesDataTable.date, endDate)
    ))
    .orderBy(caloriesDataTable.date);

  if (results.length === 0) {
    return res.json({
      message: `No calories data found for ${period} period`,
      data: { trend: 'no-data', entries: 0 }
    });
  }

  // Group by day and calculate daily totals
  const dailyTotals = results.reduce((acc, entry) => {
    const day = new Date(entry.date).toISOString().split('T')[0];
    acc[day] = (acc[day] || 0) + entry.calories;
    return acc;
  }, {});

  const dailyValues = Object.values(dailyTotals);
  
  if (dailyValues.length < 2) {
    return res.json({
      message: `Insufficient data for ${period} trend analysis`,
      data: { trend: 'insufficient-data', entries: results.length }
    });
  }

  // Simple trend calculation (compare first half vs second half)
  const midPoint = Math.floor(dailyValues.length / 2);
  const firstHalf = dailyValues.slice(0, midPoint);
  const secondHalf = dailyValues.slice(midPoint);

  const firstHalfAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

  let trend;
  const difference = secondHalfAvg - firstHalfAvg;
  if (Math.abs(difference) < 50) trend = 'stable';
  else if (difference > 0) trend = 'increasing';
  else trend = 'decreasing';

  res.json({
    message: `Successfully calculated ${period} calories trends`,
    data: {
      period,
      trend,
      firstHalfAverage: Math.round(firstHalfAvg),
      secondHalfAverage: Math.round(secondHalfAvg),
      difference: Math.round(difference),
      entries: results.length,
      dailyTotals
    }
  });
}));

// Bulk insert calories data (for wearable sync)
router.post('/bulk', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { caloriesData } = req.body;

  if (!Array.isArray(caloriesData) || caloriesData.length === 0) {
    return res.status(400).json({ error: 'caloriesData must be a non-empty array' });
  }

  // Validate and prepare data
  const validatedData = caloriesData.map(entry => {
    if (!validateHealthData('calories', entry.calories)) {
      throw new Error(`Invalid calories count: ${entry.calories}`);
    }
    
    return {
      userID: userId,
      date: new Date(entry.date),
      hour: entry.hour ? new Date(entry.hour) : null,
      calories: parseInt(entry.calories)
    };
  });

  const results = await db.insert(caloriesDataTable).values(validatedData);
  
  res.status(201).json({
    message: `Successfully inserted ${validatedData.length} calories data entries`,
    data: { insertedCount: validatedData.length }
  });
}));

module.exports = router;