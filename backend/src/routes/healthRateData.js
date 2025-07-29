const express = require('express');
const { eq, and, gte, lte, desc } = require('drizzle-orm');
const { db } = require('../db');
const { heartRateDataTable } = require('../db/schema');
const { authMiddleware } = require('../lib/auth');
const { asyncHandler, getDateRange, validateHealthData } = require('../lib/utils');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all heart rate data for current user
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { period = 'daily', limit = 100 } = req.query;
  
  const { startDate, endDate } = getDateRange(period);
  
  const results = await db
    .select()
    .from(heartRateDataTable)
    .where(and(
      eq(heartRateDataTable.userID, userId),
      gte(heartRateDataTable.date, startDate),
      lte(heartRateDataTable.date, endDate)
    ))
    .orderBy(desc(heartRateDataTable.date))
    .limit(parseInt(limit));

  res.json({
    message: 'Successfully fetched heart rate data',
    data: results
  });
}));

// Create new heart rate data entry
router.post('/', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { date, hour, heartRateBpm } = req.body;

  // Validate heart rate data
  if (!validateHealthData('heartRate', heartRateBpm)) {
    return res.status(400).json({ error: 'Invalid heart rate. Must be between 30 and 250 BPM' });
  }

  const results = await db.insert(heartRateDataTable).values({
    userID: userId,
    date: new Date(date),
    hour: hour ? new Date(hour) : null,
    heartRateBpm: parseInt(heartRateBpm)
  });

  const id = results[0]?.insertId || results[0]?.id;
  
  res.status(201).json({
    message: `Successfully created heart rate data entry ${id}`,
    data: id
  });
}));

// Get heart rate data by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  
  const results = await db
    .select()
    .from(heartRateDataTable)
    .where(and(
      eq(heartRateDataTable.heartRateID, parseInt(id)),
      eq(heartRateDataTable.userID, userId)
    ));
  
  if (results.length === 0) {
    return res.status(404).json({ error: `Heart rate data with id ${id} not found` });
  }
  
  res.json({
    message: `Successfully fetched heart rate data ${results[0].heartRateID}`,
    data: results[0]
  });
}));

// Update heart rate data
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  const updateData = req.body;

  // Validate heart rate data if provided
  if (updateData.heartRateBpm && !validateHealthData('heartRate', updateData.heartRateBpm)) {
    return res.status(400).json({ error: 'Invalid heart rate. Must be between 30 and 250 BPM' });
  }

  // Remove fields that shouldn't be updated
  delete updateData.heartRateID;
  delete updateData.userID;
  delete updateData.providedDataAt;

  // Check if heart rate data belongs to user
  const existingData = await db
    .select()
    .from(heartRateDataTable)
    .where(and(
      eq(heartRateDataTable.heartRateID, parseInt(id)),
      eq(heartRateDataTable.userID, userId)
    ));

  if (existingData.length === 0) {
    return res.status(404).json({ error: `Heart rate data with id ${id} not found` });
  }

  await db
    .update(heartRateDataTable)
    .set(updateData)
    .where(and(
      eq(heartRateDataTable.heartRateID, parseInt(id)),
      eq(heartRateDataTable.userID, userId)
    ));
  
  res.json({
    message: `Successfully updated heart rate data ${id}`
  });
}));

// Delete heart rate data
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  
  // Check if heart rate data belongs to user
  const existingData = await db
    .select()
    .from(heartRateDataTable)
    .where(and(
      eq(heartRateDataTable.heartRateID, parseInt(id)),
      eq(heartRateDataTable.userID, userId)
    ));

  if (existingData.length === 0) {
    return res.status(404).json({ error: `Heart rate data with id ${id} not found` });
  }

  await db
    .delete(heartRateDataTable)
    .where(and(
      eq(heartRateDataTable.heartRateID, parseInt(id)),
      eq(heartRateDataTable.userID, userId)
    ));
  
  res.json({
    message: `Successfully deleted heart rate data ${id}`
  });
}));

// Get daily heart rate summary
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
    .from(heartRateDataTable)
    .where(and(
      eq(heartRateDataTable.userID, userId),
      gte(heartRateDataTable.date, startOfDay),
      lte(heartRateDataTable.date, endOfDay)
    ));

  if (results.length === 0) {
    return res.json({
      message: 'No heart rate data found for this date',
      data: {
        date: targetDate.toISOString().split('T')[0],
        averageHeartRate: 0,
        minHeartRate: 0,
        maxHeartRate: 0,
        entries: 0,
        hourlyData: []
      }
    });
  }

  const heartRates = results.map(entry => entry.heartRateBpm);
  const averageHeartRate = Math.round(heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length);
  const minHeartRate = Math.min(...heartRates);
  const maxHeartRate = Math.max(...heartRates);
  
  res.json({
    message: 'Successfully fetched daily heart rate summary',
    data: {
      date: targetDate.toISOString().split('T')[0],
      averageHeartRate,
      minHeartRate,
      maxHeartRate,
      entries: results.length,
      hourlyData: results
    }
  });
}));

// Get heart rate zones
router.get('/zones/:date?', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { date } = req.params;
  
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const results = await db
    .select()
    .from(heartRateDataTable)
    .where(and(
      eq(heartRateDataTable.userID, userId),
      gte(heartRateDataTable.date, startOfDay),
      lte(heartRateDataTable.date, endOfDay)
    ));

  // Calculate heart rate zones (simplified)
  const zones = {
    resting: { min: 0, max: 60, count: 0 },
    fatBurn: { min: 60, max: 70, count: 0 },
    cardio: { min: 70, max: 85, count: 0 },
    peak: { min: 85, max: 100, count: 0 }
  };

  results.forEach(entry => {
    const hr = entry.heartRateBpm;
    if (hr <= 60) zones.resting.count++;
    else if (hr <= 70) zones.fatBurn.count++;
    else if (hr <= 85) zones.cardio.count++;
    else zones.peak.count++;
  });

  res.json({
    message: 'Successfully fetched heart rate zones',
    data: {
      date: targetDate.toISOString().split('T')[0],
      zones,
      totalEntries: results.length
    }
  });
}));

// Bulk insert heart rate data (for wearable sync)
router.post('/bulk', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { heartRateData } = req.body;

  if (!Array.isArray(heartRateData) || heartRateData.length === 0) {
    return res.status(400).json({ error: 'heartRateData must be a non-empty array' });
  }

  // Validate and prepare data
  const validatedData = heartRateData.map(entry => {
    if (!validateHealthData('heartRate', entry.heartRateBpm)) {
      throw new Error(`Invalid heart rate: ${entry.heartRateBpm}`);
    }
    
    return {
      userID: userId,
      date: new Date(entry.date),
      hour: entry.hour ? new Date(entry.hour) : null,
      heartRateBpm: parseInt(entry.heartRateBpm)
    };
  });

  const results = await db.insert(heartRateDataTable).values(validatedData);
  
  res.status(201).json({
    message: `Successfully inserted ${validatedData.length} heart rate data entries`,
    data: { insertedCount: validatedData.length }
  });
}));

module.exports = router;