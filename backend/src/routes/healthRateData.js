const express = require('express');
const { eq, and, gte, lte, desc } = require('drizzle-orm');
const { db } = require('../db');
const { heartRateDataTable } = require('../db/schema');
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
    .from(heartRateDataTable)
    .where(and(
      eq(heartRateDataTable.user_id, parseInt(userId)),
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

router.post('/', asyncHandler(async (req, res) => {
  const { userId, date, hour, heart_rate_bpm } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (!validateHealthData('heartRate', heart_rate_bpm)) {
    return res.status(400).json({ error: 'Invalid heart rate. Must be between 30 and 250 BPM' });
  }

  const results = await db.insert(heartRateDataTable).values({
    user_id: parseInt(userId),
    date: new Date(date),
    hour: hour || null,
    heart_rate_bpm: parseInt(heart_rate_bpm)
  });

  const id = results[0]?.insertId || results[0]?.id;
  
  res.status(201).json({
    message: `Successfully created heart rate data entry ${id}`,
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
    .from(heartRateDataTable)
    .where(and(
      eq(heartRateDataTable.id, parseInt(id)),
      eq(heartRateDataTable.user_id, parseInt(userId))
    ));
  
  if (results.length === 0) {
    return res.status(404).json({ error: `Heart rate data with id ${id} not found` });
  }
  
  res.json({
    message: `Successfully fetched heart rate data ${results[0].id}`,
    data: results[0]
  });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId, ...updateData } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (updateData.heart_rate_bpm && !validateHealthData('heartRate', updateData.heart_rate_bpm)) {
    return res.status(400).json({ error: 'Invalid heart rate. Must be between 30 and 250 BPM' });
  }

  delete updateData.id;
  delete updateData.user_id;

  const existingData = await db
    .select()
    .from(heartRateDataTable)
    .where(and(
      eq(heartRateDataTable.id, parseInt(id)),
      eq(heartRateDataTable.user_id, parseInt(userId))
    ));

  if (existingData.length === 0) {
    return res.status(404).json({ error: `Heart rate data with id ${id} not found` });
  }

  await db
    .update(heartRateDataTable)
    .set(updateData)
    .where(and(
      eq(heartRateDataTable.id, parseInt(id)),
      eq(heartRateDataTable.user_id, parseInt(userId))
    ));
  
  res.json({
    message: `Successfully updated heart rate data ${id}`
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
    .from(heartRateDataTable)
    .where(and(
      eq(heartRateDataTable.id, parseInt(id)),
      eq(heartRateDataTable.user_id, parseInt(userId))
    ));

  if (existingData.length === 0) {
    return res.status(404).json({ error: `Heart rate data with id ${id} not found` });
  }

  await db
    .delete(heartRateDataTable)
    .where(and(
      eq(heartRateDataTable.id, parseInt(id)),
      eq(heartRateDataTable.user_id, parseInt(userId))
    ));
  
  res.json({
    message: `Successfully deleted heart rate data ${id}`
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
    .from(heartRateDataTable)
    .where(and(
      eq(heartRateDataTable.user_id, parseInt(userId)),
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

  const heartRates = results.map(entry => entry.heart_rate_bpm);
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

router.post('/bulk', asyncHandler(async (req, res) => {
  const { userId, heartRateData } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (!Array.isArray(heartRateData) || heartRateData.length === 0) {
    return res.status(400).json({ error: 'heartRateData must be a non-empty array' });
  }

  const validatedData = heartRateData.map(entry => {
    if (!validateHealthData('heartRate', entry.heart_rate_bpm)) {
      throw new Error(`Invalid heart rate: ${entry.heart_rate_bpm}`);
    }
    
    return {
      user_id: parseInt(userId),
      date: new Date(entry.date),
      hour: entry.hour || null,
      heart_rate_bpm: parseInt(entry.heart_rate_bpm)
    };
  });

  const results = await db.insert(heartRateDataTable).values(validatedData);
  
  res.status(201).json({
    message: `Successfully inserted ${validatedData.length} heart rate data entries`,
    data: { insertedCount: validatedData.length }
  });
}));

module.exports = router;