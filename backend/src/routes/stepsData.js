const express = require('express');
const { eq, and, gte, lte, desc } = require('drizzle-orm');
const { db } = require('../db');
const { stepsDataTable } = require('../db/schema');
const { authMiddleware } = require('../lib/auth');
const { asyncHandler, getDateRange, validateHealthData } = require('../lib/utils');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all steps data for current user
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { period = 'daily', limit = 100 } = req.query;
  
  const { startDate, endDate } = getDateRange(period);
  
  const results = await db
    .select()
    .from(stepsDataTable)
    .where(and(
      eq(stepsDataTable.userID, userId),
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

// Create new steps data entry
router.post('/', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { date, hour, steps_count } = req.body;

  // Validate steps data
  if (!validateHealthData('steps', steps_count)) {
    return res.status(400).json({ error: 'Invalid steps count. Must be between 0 and 100,000' });
  }

  const results = await db.insert(stepsDataTable).values({
    userID: userId,
    date: new Date(date),
    hour: hour ? new Date(hour) : null,
    steps_count: parseInt(steps_count)
  });

  const id = results[0]?.insertId || results[0]?.id;
  
  res.status(201).json({
    message: `Successfully created steps data entry ${id}`,
    data: id
  });
}));

// Get steps data by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  
  const results = await db
    .select()
    .from(stepsDataTable)
    .where(and(
      eq(stepsDataTable.stepID, parseInt(id)),
      eq(stepsDataTable.userID, userId)
    ));
  
  if (results.length === 0) {
    return res.status(404).json({ error: `Steps data with id ${id} not found` });
  }
  
  res.json({
    message: `Successfully fetched steps data ${results[0].stepID}`,
    data: results[0]
  });
}));

// Update steps data
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  const updateData = req.body;

  // Validate steps data if provided
  if (updateData.steps_count && !validateHealthData('steps', updateData.steps_count)) {
    return res.status(400).json({ error: 'Invalid steps count. Must be between 0 and 100,000' });
  }

  // Remove fields that shouldn't be updated
  delete updateData.stepID;
  delete updateData.userID;
  delete updateData.providedDataAt;

  // Check if steps data belongs to user
  const existingData = await db
    .select()
    .from(stepsDataTable)
    .where(and(
      eq(stepsDataTable.stepID, parseInt(id)),
      eq(stepsDataTable.userID, userId)
    ));

  if (existingData.length === 0) {
    return res.status(404).json({ error: `Steps data with id ${id} not found` });
  }

  await db
    .update(stepsDataTable)
    .set(updateData)
    .where(and(
      eq(stepsDataTable.stepID, parseInt(id)),
      eq(stepsDataTable.userID, userId)
    ));
  
  res.json({
    message: `Successfully updated steps data ${id}`
  });
}));

// Delete steps data
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  
  // Check if steps data belongs to user
  const existingData = await db
    .select()
    .from(stepsDataTable)
    .where(and(
      eq(stepsDataTable.stepID, parseInt(id)),
      eq(stepsDataTable.userID, userId)
    ));

  if (existingData.length === 0) {
    return res.status(404).json({ error: `Steps data with id ${id} not found` });
  }

  await db
    .delete(stepsDataTable)
    .where(and(
      eq(stepsDataTable.stepID, parseInt(id)),
      eq(stepsDataTable.userID, userId)
    ));
  
  res.json({
    message: `Successfully deleted steps data ${id}`
  });
}));

// Get daily steps summary
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
    .from(stepsDataTable)
    .where(and(
      eq(stepsDataTable.userID, userId),
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

// Bulk insert steps data (for wearable sync)
router.post('/bulk', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { stepsData } = req.body;

  if (!Array.isArray(stepsData) || stepsData.length === 0) {
    return res.status(400).json({ error: 'stepsData must be a non-empty array' });
  }

  // Validate and prepare data
  const validatedData = stepsData.map(entry => {
    if (!validateHealthData('steps', entry.steps_count)) {
      throw new Error(`Invalid steps count: ${entry.steps_count}`);
    }
    
    return {
      userID: userId,
      date: new Date(entry.date),
      hour: entry.hour ? new Date(entry.hour) : null,
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