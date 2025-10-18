const express = require('express');
const { eq, and, gte, lte, desc } = require('drizzle-orm');
const { db } = require('../db');
const { calorieDataTable } = require('../db/schema');
const { asyncHandler, getDateRange, validateHealthData } = require('../lib/utils');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { userId, period = 'daily', limit = 100 } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required as query parameter' });
  }
  
  const { startDate, endDate } = getDateRange(period);
  
  const results = await db
    .select()
    .from(calorieDataTable)
    .where(and(
      eq(calorieDataTable.user_id, parseInt(userId)),
      gte(calorieDataTable.date, startDate),
      lte(calorieDataTable.date, endDate)
    ))
    .orderBy(desc(calorieDataTable.date))
    .limit(parseInt(limit));

  res.json({
    message: 'Successfully fetched calories data',
    data: results
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { userId, date, hour, calories } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (!validateHealthData('calories', calories)) {
    return res.status(400).json({ error: 'Invalid calories count. Must be between 0 and 10,000' });
  }

  const results = await db.insert(calorieDataTable).values({
    user_id: parseInt(userId),
    date: new Date(date),
    hour: hour || null,
    calories: parseInt(calories)
  });

  const id = results[0]?.insertId || results[0]?.id;
  
  res.status(201).json({
    message: `Successfully created calories data entry ${id}`,
    data: id
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required as query parameter' });
  }
  
  const results = await db
    .select()
    .from(calorieDataTable)
    .where(and(
      eq(calorieDataTable.id, parseInt(id)),
      eq(calorieDataTable.user_id, parseInt(userId))
    ));
  
  if (results.length === 0) {
    return res.status(404).json({ error: `Calories data with id ${id} not found` });
  }
  
  res.json({
    message: `Successfully fetched calories data ${results[0].id}`,
    data: results[0]
  });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId, ...updateData } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (updateData.calories && !validateHealthData('calories', updateData.calories)) {
    return res.status(400).json({ error: 'Invalid calories count. Must be between 0 and 10,000' });
  }

  delete updateData.id;
  delete updateData.user_id;

  const existingData = await db
    .select()
    .from(calorieDataTable)
    .where(and(
      eq(calorieDataTable.id, parseInt(id)),
      eq(calorieDataTable.user_id, parseInt(userId))
    ));

  if (existingData.length === 0) {
    return res.status(404).json({ error: `Calories data with id ${id} not found` });
  }

  await db
    .update(calorieDataTable)
    .set(updateData)
    .where(and(
      eq(calorieDataTable.id, parseInt(id)),
      eq(calorieDataTable.user_id, parseInt(userId))
    ));
  
  res.json({
    message: `Successfully updated calories data ${id}`
  });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required as query parameter' });
  }
  
  const existingData = await db
    .select()
    .from(calorieDataTable)
    .where(and(
      eq(calorieDataTable.id, parseInt(id)),
      eq(calorieDataTable.user_id, parseInt(userId))
    ));

  if (existingData.length === 0) {
    return res.status(404).json({ error: `Calories data with id ${id} not found` });
  }

  await db
    .delete(calorieDataTable)
    .where(and(
      eq(calorieDataTable.id, parseInt(id)),
      eq(calorieDataTable.user_id, parseInt(userId))
    ));
  
  res.json({
    message: `Successfully deleted calories data ${id}`
  });
}));

router.get('/summary/daily', asyncHandler(async (req, res) => {
  const { userId, date } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required as query parameter' });
  }
  
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const results = await db
    .select()
    .from(calorieDataTable)
    .where(and(
      eq(calorieDataTable.user_id, parseInt(userId)),
      gte(calorieDataTable.date, startOfDay),
      lte(calorieDataTable.date, endOfDay)
    ));

  const totalCalories = results.reduce((sum, entry) => sum + (entry.calories || 0), 0);
  
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

router.post('/bulk', asyncHandler(async (req, res) => {
  const { userId, caloriesData } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (!Array.isArray(caloriesData) || caloriesData.length === 0) {
    return res.status(400).json({ error: 'caloriesData must be a non-empty array' });
  }

  const validatedData = caloriesData.map(entry => {
    if (!validateHealthData('calories', entry.calories)) {
      throw new Error(`Invalid calories count: ${entry.calories}`);
    }
    
    return {
      user_id: parseInt(userId),
      date: new Date(entry.date),
      hour: entry.hour || null,
      calories: parseInt(entry.calories)
    };
  });

  const results = await db.insert(calorieDataTable).values(validatedData);
  
  res.status(201).json({
    message: `Successfully inserted ${validatedData.length} calories data entries`,
    data: { insertedCount: validatedData.length }
  });
}));

module.exports = router;