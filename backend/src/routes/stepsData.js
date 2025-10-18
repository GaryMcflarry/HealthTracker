const express = require('express');
const { eq, and, gte, lte, desc } = require('drizzle-orm');
const { db } = require('../db');
const { stepsDataTable } = require('../db/schema');
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
    .from(stepsDataTable)
    .where(and(
      eq(stepsDataTable.user_id, parseInt(userId)),
      gte(stepsDataTable.date, startDate),
      lte(stepsDataTable.date, endDate)
    ))
    .orderBy(desc(stepsDataTable.date))
    .limit(parseInt(limit));

  res.json({
    message: 'Successfully fetched steps data',
    data: results
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { userId, date, hour, steps_count } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (!validateHealthData('steps', steps_count)) {
    return res.status(400).json({ error: 'Invalid steps count. Must be between 0 and 100,000' });
  }

  const results = await db.insert(stepsDataTable).values({
    user_id: parseInt(userId),
    date: new Date(date),
    hour: hour || null,
    steps_count: parseInt(steps_count)
  });

  const id = results[0]?.insertId || results[0]?.id;
  
  res.status(201).json({
    message: `Successfully created steps data entry ${id}`,
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
    .from(stepsDataTable)
    .where(and(
      eq(stepsDataTable.id, parseInt(id)),
      eq(stepsDataTable.user_id, parseInt(userId))
    ));
  
  if (results.length === 0) {
    return res.status(404).json({ error: `Steps data with id ${id} not found` });
  }
  
  res.json({
    message: `Successfully fetched steps data ${results[0].id}`,
    data: results[0]
  });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId, ...updateData } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (updateData.steps_count && !validateHealthData('steps', updateData.steps_count)) {
    return res.status(400).json({ error: 'Invalid steps count. Must be between 0 and 100,000' });
  }

  delete updateData.id;
  delete updateData.user_id;

  const existingData = await db
    .select()
    .from(stepsDataTable)
    .where(and(
      eq(stepsDataTable.id, parseInt(id)),
      eq(stepsDataTable.user_id, parseInt(userId))
    ));

  if (existingData.length === 0) {
    return res.status(404).json({ error: `Steps data with id ${id} not found` });
  }

  await db
    .update(stepsDataTable)
    .set(updateData)
    .where(and(
      eq(stepsDataTable.id, parseInt(id)),
      eq(stepsDataTable.user_id, parseInt(userId))
    ));
  
  res.json({
    message: `Successfully updated steps data ${id}`
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
    .from(stepsDataTable)
    .where(and(
      eq(stepsDataTable.id, parseInt(id)),
      eq(stepsDataTable.user_id, parseInt(userId))
    ));

  if (existingData.length === 0) {
    return res.status(404).json({ error: `Steps data with id ${id} not found` });
  }

  await db
    .delete(stepsDataTable)
    .where(and(
      eq(stepsDataTable.id, parseInt(id)),
      eq(stepsDataTable.user_id, parseInt(userId))
    ));
  
  res.json({
    message: `Successfully deleted steps data ${id}`
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
    .from(stepsDataTable)
    .where(and(
      eq(stepsDataTable.user_id, parseInt(userId)),
      gte(stepsDataTable.date, startOfDay),
      lte(stepsDataTable.date, endOfDay)
    ));

  const totalSteps = results.reduce((sum, entry) => sum + (entry.steps_count || 0), 0);
  
  res.json({
    message: 'Successfully fetched daily steps summary',
    data: {
      date: targetDate.toISOString().split('T')[0],
      totalSteps,
      entries: results.length,
      hourlyData: results
    }
  });
}));

router.post('/bulk', asyncHandler(async (req, res) => {
  const { userId, stepsData } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (!Array.isArray(stepsData) || stepsData.length === 0) {
    return res.status(400).json({ error: 'stepsData must be a non-empty array' });
  }

  const validatedData = stepsData.map(entry => {
    if (!validateHealthData('steps', entry.steps_count)) {
      throw new Error(`Invalid steps count: ${entry.steps_count}`);
    }
    
    return {
      user_id: parseInt(userId),
      date: new Date(entry.date),
      hour: entry.hour || null,
      steps_count: parseInt(entry.steps_count)
    };
  });

  const results = await db.insert(stepsDataTable).values(validatedData);
  
  res.status(201).json({
    message: `Successfully inserted ${validatedData.length} steps data entries`,
    data: { insertedCount: validatedData.length }
  });
}));

module.exports = router;