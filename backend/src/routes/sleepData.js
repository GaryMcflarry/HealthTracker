const express = require('express');
const { eq, and, gte, lte, desc } = require('drizzle-orm');
const { db } = require('../db');
const { sleepDataTable } = require('../db/schema');
const { authMiddleware } = require('../lib/auth');
const { asyncHandler, getDateRange, validateHealthData } = require('../lib/utils');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all sleep data for current user
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { period = 'weekly', limit = 30 } = req.query;
  
  const { startDate, endDate } = getDateRange(period);
  
  const results = await db
    .select()
    .from(sleepDataTable)
    .where(and(
      eq(sleepDataTable.userID, userId),
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

// Create new sleep data entry
router.post('/', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { date, sleepDuration, sleepQuality } = req.body;

  // Validate sleep data
  if (!validateHealthData('sleep', sleepDuration)) {
    return res.status(400).json({ error: 'Invalid sleep duration. Must be between 0 and 24 hours' });
  }

  const validQualities = ['poor', 'fair', 'good', 'excellent'];
  if (sleepQuality && !validQualities.includes(sleepQuality.toLowerCase())) {
    return res.status(400).json({ error: `Invalid sleep quality. Must be one of: ${validQualities.join(', ')}` });
  }

  const results = await db.insert(sleepDataTable).values({
    userID: userId,
    date: new Date(date),
    sleepDuration: parseFloat(sleepDuration),
    sleepQuality: sleepQuality?.toLowerCase()
  });

  const id = results[0]?.insertId || results[0]?.id;
  
  res.status(201).json({
    message: `Successfully created sleep data entry ${id}`,
    data: id
  });
}));

// Get sleep data by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  
  const results = await db
    .select()
    .from(sleepDataTable)
    .where(and(
      eq(sleepDataTable.sleepID, parseInt(id)),
      eq(sleepDataTable.userID, userId)
    ));
  
  if (results.length === 0) {
    return res.status(404).json({ error: `Sleep data with id ${id} not found` });
  }
  
  res.json({
    message: `Successfully fetched sleep data ${results[0].sleepID}`,
    data: results[0]
  });
}));

// Update sleep data
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  const updateData = req.body;

  // Validate sleep data if provided
  if (updateData.sleepDuration && !validateHealthData('sleep', updateData.sleepDuration)) {
    return res.status(400).json({ error: 'Invalid sleep duration. Must be between 0 and 24 hours' });
  }

  const validQualities = ['poor', 'fair', 'good', 'excellent'];
  if (updateData.sleepQuality && !validQualities.includes(updateData.sleepQuality.toLowerCase())) {
    return res.status(400).json({ error: `Invalid sleep quality. Must be one of: ${validQualities.join(', ')}` });
  }

  // Remove fields that shouldn't be updated
  delete updateData.sleepID;
  delete updateData.userID;
  delete updateData.providedDataAt;

  // Check if sleep data belongs to user
  const existingData = await db
    .select()
    .from(sleepDataTable)
    .where(and(
      eq(sleepDataTable.sleepID, parseInt(id)),
      eq(sleepDataTable.userID, userId)
    ));

  if (existingData.length === 0) {
    return res.status(404).json({ error: `Sleep data with id ${id} not found` });
  }

  await db
    .update(sleepDataTable)
    .set(updateData)
    .where(and(
      eq(sleepDataTable.sleepID, parseInt(id)),
      eq(sleepDataTable.userID, userId)
    ));
  
  res.json({
    message: `Successfully updated sleep data ${id}`
  });
}));

// Delete sleep data
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userID;
  
  // Check if sleep data belongs to user
  const existingData = await db
    .select()
    .from(sleepDataTable)
    .where(and(
      eq(sleepDataTable.sleepID, parseInt(id)),
      eq(sleepDataTable.userID, userId)
    ));

  if (existingData.length === 0) {
    return res.status(404).json({ error: `Sleep data with id ${id} not found` });
  }

  await db
    .delete(sleepDataTable)
    .where(and(
      eq(sleepDataTable.sleepID, parseInt(id)),
      eq(sleepDataTable.userID, userId)
    ));
  
  res.json({
    message: `Successfully deleted sleep data ${id}`
  });
}));

// Get weekly sleep summary
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
    .from(sleepDataTable)
    .where(and(
      eq(sleepDataTable.userID, userId),
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

  const totalSleepHours = results.reduce((sum, entry) => sum + (entry.sleepDuration || 0), 0);
  const averageSleepDuration = totalSleepHours / results.length;
  const sleepEfficiency = (results.length / 7) * 100; // Percentage of days with sleep data

  // Quality distribution
  const qualityDistribution = results.reduce((acc, entry) => {
    const quality = entry.sleepQuality || 'unknown';
    acc[quality] = (acc[quality] || 0) + 1;
    return acc;
  }, {});
  
  res.json({
    message: 'Successfully fetched weekly sleep summary',
    data: {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      averageSleepDuration: Math.round(averageSleepDuration * 100) / 100,
      totalSleepHours: Math.round(totalSleepHours * 100) / 100,
      sleepEfficiency: Math.round(sleepEfficiency),
      qualityDistribution,
      entries: results.length,
      dailyData: results
    }
  });
}));

// Get sleep trends
router.get('/trends/:period', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { period } = req.params; // 'weekly' or 'monthly'
  
  const { startDate, endDate } = getDateRange(period);
  
  const results = await db
    .select()
    .from(sleepDataTable)
    .where(and(
      eq(sleepDataTable.userID, userId),
      gte(sleepDataTable.date, startDate),
      lte(sleepDataTable.date, endDate)
    ))
    .orderBy(sleepDataTable.date);

  if (results.length === 0) {
    return res.json({
      message: `No sleep data found for ${period} period`,
      data: { trend: 'no-data', entries: 0 }
    });
  }

  // Calculate trend (simplified - compare first half vs second half)
  const midPoint = Math.floor(results.length / 2);
  const firstHalf = results.slice(0, midPoint);
  const secondHalf = results.slice(midPoint);

  if (firstHalf.length === 0 || secondHalf.length === 0) {
    return res.json({
      message: `Insufficient data for ${period} trend analysis`,
      data: { trend: 'insufficient-data', entries: results.length }
    });
  }

  const firstHalfAvg = firstHalf.reduce((sum, entry) => sum + entry.sleepDuration, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, entry) => sum + entry.sleepDuration, 0) / secondHalf.length;

  let trend;
  const difference = secondHalfAvg - firstHalfAvg;
  if (Math.abs(difference) < 0.1) trend = 'stable';
  else if (difference > 0) trend = 'improving';
  else trend = 'declining';

  res.json({
    message: `Successfully calculated ${period} sleep trends`,
    data: {
      period,
      trend,
      firstHalfAverage: Math.round(firstHalfAvg * 100) / 100,
      secondHalfAverage: Math.round(secondHalfAvg * 100) / 100,
      difference: Math.round(difference * 100) / 100,
      entries: results.length
    }
  });
}));

// Get sleep quality analysis
router.get('/quality/analysis', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { days = 30 } = req.query;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));
  
  const results = await db
    .select()
    .from(sleepDataTable)
    .where(and(
      eq(sleepDataTable.userID, userId),
      gte(sleepDataTable.date, startDate)
    ))
    .orderBy(sleepDataTable.date);

  const qualityScores = {
    'poor': 1,
    'fair': 2,
    'good': 3,
    'excellent': 4
  };

  const qualityAnalysis = results.reduce((acc, entry) => {
    const quality = entry.sleepQuality || 'unknown';
    const score = qualityScores[quality] || 0;
    
    acc.totalScore += score;
    acc.qualityCount[quality] = (acc.qualityCount[quality] || 0) + 1;
    acc.totalEntries++;
    
    return acc;
  }, {
    totalScore: 0,
    qualityCount: {},
    totalEntries: 0
  });

  const averageQualityScore = qualityAnalysis.totalEntries > 0 
    ? qualityAnalysis.totalScore / qualityAnalysis.totalEntries 
    : 0;

  let qualityRating;
  if (averageQualityScore >= 3.5) qualityRating = 'excellent';
  else if (averageQualityScore >= 2.5) qualityRating = 'good';
  else if (averageQualityScore >= 1.5) qualityRating = 'fair';
  else qualityRating = 'poor';

  res.json({
    message: 'Successfully analyzed sleep quality',
    data: {
      period: `${days} days`,
      averageQualityScore: Math.round(averageQualityScore * 100) / 100,
      qualityRating,
      qualityDistribution: qualityAnalysis.qualityCount,
      totalEntries: qualityAnalysis.totalEntries
    }
  });
}));

// Bulk insert sleep data (for wearable sync)
router.post('/bulk', asyncHandler(async (req, res) => {
  const userId = req.user.userID;
  const { sleepData } = req.body;

  if (!Array.isArray(sleepData) || sleepData.length === 0) {
    return res.status(400).json({ error: 'sleepData must be a non-empty array' });
  }

  const validQualities = ['poor', 'fair', 'good', 'excellent'];

  // Validate and prepare data
  const validatedData = sleepData.map(entry => {
    if (!validateHealthData('sleep', entry.sleepDuration)) {
      throw new Error(`Invalid sleep duration: ${entry.sleepDuration}`);
    }

    if (entry.sleepQuality && !validQualities.includes(entry.sleepQuality.toLowerCase())) {
      throw new Error(`Invalid sleep quality: ${entry.sleepQuality}`);
    }
    
    return {
      userID: userId,
      date: new Date(entry.date),
      sleepDuration: parseFloat(entry.sleepDuration),
      sleepQuality: entry.sleepQuality?.toLowerCase()
    };
  });

  const results = await db.insert(sleepDataTable).values(validatedData);
  
  res.status(201).json({
    message: `Successfully inserted ${validatedData.length} sleep data entries`,
    data: { insertedCount: validatedData.length }
  });
}));

module.exports = router;