const express = require('express');
const { eq, and, gte, lte, desc } = require('drizzle-orm');
const { db } = require('../db');
const { sleepDataTable } = require('../db/schema');
const { asyncHandler, getDateRange, validateHealthData } = require('../lib/utils');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const { userId, period = 'weekly', limit = 30 } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required as query parameter' });
  }
  
  const { startDate, endDate } = getDateRange(period);
  
  const results = await db
    .select()
    .from(sleepDataTable)
    .where(and(
      eq(sleepDataTable.user_id, parseInt(userId)),
      gte(sleepDataTable.date, startDate),
      lte(sleepDataTable.date, endDate)
    ))
    .orderBy(desc(sleepDataTable.date))
    .limit(parseInt(limit));

  res.json({
    message: 'Successfully fetched sleep data',
    data: results
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { userId, date, deep_sleep_minutes, light_sleep_minutes, rem_sleep_minutes, awake_minutes, sleep_efficiency_percent } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const totalSleep = (deep_sleep_minutes || 0) + (light_sleep_minutes || 0) + (rem_sleep_minutes || 0);
  const sleepHours = totalSleep / 60;
  
  if (!validateHealthData('sleep', sleepHours)) {
    return res.status(400).json({ error: 'Invalid sleep duration. Must be between 0 and 24 hours' });
  }

  const results = await db.insert(sleepDataTable).values({
    user_id: parseInt(userId),
    date: new Date(date),
    deep_sleep_minutes: deep_sleep_minutes || 0,
    light_sleep_minutes: light_sleep_minutes || 0,
    rem_sleep_minutes: rem_sleep_minutes || 0,
    awake_minutes: awake_minutes || 0,
    sleep_efficiency_percent: sleep_efficiency_percent || 0
  });

  const id = results[0]?.insertId || results[0]?.id;
  
  res.status(201).json({
    message: `Successfully created sleep data entry ${id}`,
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
    .from(sleepDataTable)
    .where(and(
      eq(sleepDataTable.id, parseInt(id)),
      eq(sleepDataTable.user_id, parseInt(userId))
    ));
  
  if (results.length === 0) {
    return res.status(404).json({ error: `Sleep data with id ${id} not found` });
  }
  
  res.json({
    message: `Successfully fetched sleep data ${results[0].id}`,
    data: results[0]
  });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId, ...updateData } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (updateData.deep_sleep_minutes || updateData.light_sleep_minutes || updateData.rem_sleep_minutes) {
    const totalSleep = (updateData.deep_sleep_minutes || 0) + (updateData.light_sleep_minutes || 0) + (updateData.rem_sleep_minutes || 0);
    const sleepHours = totalSleep / 60;
    
    if (!validateHealthData('sleep', sleepHours)) {
      return res.status(400).json({ error: 'Invalid sleep duration. Must be between 0 and 24 hours' });
    }
  }

  delete updateData.id;
  delete updateData.user_id;

  const existingData = await db
    .select()
    .from(sleepDataTable)
    .where(and(
      eq(sleepDataTable.id, parseInt(id)),
      eq(sleepDataTable.user_id, parseInt(userId))
    ));

  if (existingData.length === 0) {
    return res.status(404).json({ error: `Sleep data with id ${id} not found` });
  }

  await db
    .update(sleepDataTable)
    .set(updateData)
    .where(and(
      eq(sleepDataTable.id, parseInt(id)),
      eq(sleepDataTable.user_id, parseInt(userId))
    ));
  
  res.json({
    message: `Successfully updated sleep data ${id}`
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
    .from(sleepDataTable)
    .where(and(
      eq(sleepDataTable.id, parseInt(id)),
      eq(sleepDataTable.user_id, parseInt(userId))
    ));

  if (existingData.length === 0) {
    return res.status(404).json({ error: `Sleep data with id ${id} not found` });
  }

  await db
    .delete(sleepDataTable)
    .where(and(
      eq(sleepDataTable.id, parseInt(id)),
      eq(sleepDataTable.user_id, parseInt(userId))
    ));
  
  res.json({
    message: `Successfully deleted sleep data ${id}`
  });
}));

router.get('/summary/weekly', asyncHandler(async (req, res) => {
  const { userId, startDate } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required as query parameter' });
  }
  
  const weekStart = startDate ? new Date(startDate) : new Date();
  if (!startDate) {
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  }
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const results = await db
    .select()
    .from(sleepDataTable)
    .where(and(
      eq(sleepDataTable.user_id, parseInt(userId)),
      gte(sleepDataTable.date, weekStart),
      lte(sleepDataTable.date, weekEnd)
    ))
    .orderBy(sleepDataTable.date);

  if (results.length === 0) {
    return res.json({
      message: 'No sleep data found for this week',
      data: {
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        averageSleepDuration: 0,
        totalSleepHours: 0,
        sleepEfficiency: 0,
        entries: 0,
        dailyData: []
      }
    });
  }

  const totalSleepMinutes = results.reduce((sum, entry) => 
    sum + (entry.deep_sleep_minutes + entry.light_sleep_minutes + entry.rem_sleep_minutes), 0);
  const totalSleepHours = totalSleepMinutes / 60;
  const averageSleepDuration = totalSleepHours / results.length;
  const sleepEfficiency = (results.length / 7) * 100;
  
  res.json({
    message: 'Successfully fetched weekly sleep summary',
    data: {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      averageSleepDuration: Math.round(averageSleepDuration * 100) / 100,
      totalSleepHours: Math.round(totalSleepHours * 100) / 100,
      sleepEfficiency: Math.round(sleepEfficiency),
      entries: results.length,
      dailyData: results
    }
  });
}));

router.post('/bulk', asyncHandler(async (req, res) => {
  const { userId, sleepData } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (!Array.isArray(sleepData) || sleepData.length === 0) {
    return res.status(400).json({ error: 'sleepData must be a non-empty array' });
  }

  const validatedData = sleepData.map(entry => {
    const totalSleep = (entry.deep_sleep_minutes || 0) + (entry.light_sleep_minutes || 0) + (entry.rem_sleep_minutes || 0);
    const sleepHours = totalSleep / 60;
    
    if (!validateHealthData('sleep', sleepHours)) {
      throw new Error(`Invalid sleep duration: ${sleepHours}`);
    }
    
    return {
      user_id: parseInt(userId),
      date: new Date(entry.date),
      deep_sleep_minutes: entry.deep_sleep_minutes || 0,
      light_sleep_minutes: entry.light_sleep_minutes || 0,
      rem_sleep_minutes: entry.rem_sleep_minutes || 0,
      awake_minutes: entry.awake_minutes || 0,
      sleep_efficiency_percent: entry.sleep_efficiency_percent || 0
    };
  });

  const results = await db.insert(sleepDataTable).values(validatedData);
  
  res.status(201).json({
    message: `Successfully inserted ${validatedData.length} sleep data entries`,
    data: { insertedCount: validatedData.length }
  });
}));

module.exports = router;