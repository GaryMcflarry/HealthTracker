const express = require('express');
const { google } = require('googleapis');
const { eq, and, gte, desc } = require('drizzle-orm');
const { db } = require('../db');
const { 
  usersTable,
  stepsDataTable, 
  heartRateDataTable, 
  sleepDataTable, 
  calorieDataTable,
  goalsTable
} = require('../db/schema');
const { asyncHandler } = require('../lib/utils');

const router = express.Router();

function logError(context, error, additionalInfo = {}) {
  console.error(`[${context}] Error:`, error.message);
  console.error(`   Stack:`, error.stack);
  if (Object.keys(additionalInfo).length > 0) {
    console.error(`   Additional Info:`, additionalInfo);
  }
}

function logInfo(context, message, data = {}) {
  console.log(`[${context}] ${message}`);
  if (Object.keys(data).length > 0) {
    console.log(`   Data:`, JSON.stringify(data, null, 2));
  }
}

// ========================================
// GOOGLE FIT API SETUP
// ========================================

const oauth2Client = new google.auth.OAuth2(
  '140323638250-v75qjj2ki2qhal2rsscbnhkvhkcctpa0.apps.googleusercontent.com',
  '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',
  'http://localhost:3000/api/wearable/auth/callback'
);

const fitness = google.fitness({ version: 'v1', auth: oauth2Client });

async function getUserTokens(userId) {
  logInfo('getUserTokens', `Retrieving tokens for user: ${userId}`);
  
  const user = await db
    .select({ fit_tokens: usersTable.fit_tokens })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
    
  if (user[0]?.fit_tokens) {
    try {
      const tokens = JSON.parse(user[0].fit_tokens);
      logInfo('getUserTokens', 'Tokens found and parsed');
      return tokens;
    } catch (e) {
      logError('getUserTokens', e, { userId });
      return null;
    }
  }
  
  logInfo('getUserTokens', 'No tokens found', { userId });
  return null;
}

async function saveUserTokens(userId, tokens) {
  logInfo('saveUserTokens', `Saving tokens for user: ${userId}`);
  
  const tokensWithCredentials = {
    ...tokens,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET
  };
  
  await db
    .update(usersTable)
    .set({ 
      fit_tokens: JSON.stringify(tokensWithCredentials),
      last_sync: new Date()
    })
    .where(eq(usersTable.id, userId));
    
  logInfo('saveUserTokens', 'Tokens saved with credentials');
}

async function setOAuthCredentialsForUser(userId) {
  logInfo('setOAuthCredentialsForUser', `Setting OAuth credentials for user: ${userId}`);
  
  const tokens = await getUserTokens(userId);
  if (!tokens || !tokens.access_token) {
    throw new Error('User has not authorized Google Fit');
  }

  oauth2Client.setCredentials(tokens);
  
  if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
    logInfo('setOAuthCredentialsForUser', 'Token expired, refreshing...');
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await saveUserTokens(userId, credentials);
      logInfo('setOAuthCredentialsForUser', 'Token refreshed');
    } catch (error) {
      logError('setOAuthCredentialsForUser', error, { userId });
      throw new Error('Token refresh failed. Please re-authorize.');
    }
  }
  
  logInfo('setOAuthCredentialsForUser', 'OAuth credentials set');
}

router.get('/auth/google', asyncHandler(async (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId query parameter is required' });
  }
  
  logInfo('auth-google', `Initiating Google Fit auth for user: ${userId}`);
  
  const scopes = [
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.heart_rate.read',
    'https://www.googleapis.com/auth/fitness.sleep.read',
    'https://www.googleapis.com/auth/fitness.body.read'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: JSON.stringify({ userId: parseInt(userId) })
  });

  logInfo('auth-google', 'OAuth URL generated');
  
  res.redirect(authUrl);
}));

router.get('/auth/callback', asyncHandler(async (req, res) => {
  logInfo('auth-callback', 'Handling OAuth callback...');
  
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      logError('auth-callback', new Error(error));
      return res.redirect('/dashboard/dashboard.html?error=oauth_failed');
    }
    
    if (!code) {
      logError('auth-callback', new Error('No authorization code'));
      return res.redirect('/dashboard/dashboard.html?error=oauth_failed');
    }

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    let userId = null;
    if (state) {
      try {
        const stateObj = JSON.parse(state);
        userId = stateObj.userId;
      } catch (e) {
        logError('auth-callback', e, { context: 'parsing state' });
      }
    }

    if (!userId) {
      logError('auth-callback', new Error('No user ID in state'));
      return res.redirect('/dashboard/dashboard.html?error=no_user_id');
    }

    await saveUserTokens(parseInt(userId), tokens);
    
    logInfo('auth-callback', 'OAuth callback completed');
    res.redirect('/dashboard/dashboard.html?oauth=success');

  } catch (error) {
    logError('auth-callback', error);
    res.redirect('/dashboard/dashboard.html?error=oauth_callback_failed');
  }
}));

async function discoverDataSources(dataType) {
  try {
    logInfo('discoverDataSources', `Discovering sources for ${dataType}...`);
    
    const sourcesResponse = await fitness.users.dataSources.list({ userId: 'me' });
    
    if (!sourcesResponse.data.dataSource) {
      logInfo('discoverDataSources', 'No data sources found');
      return [];
    }
    
    const dataTypeMap = {
      steps: 'com.google.step_count.delta',
      heartrate: 'com.google.heart_rate.bpm',
      calories: 'com.google.calories.expended',
      sleep: 'com.google.sleep.segment'
    };
    
    const targetDataType = dataTypeMap[dataType];
    if (!targetDataType) {
      logError('discoverDataSources', new Error(`Unknown data type: ${dataType}`));
      return [];
    }
    
    const matchingSources = sourcesResponse.data.dataSource.filter(source => 
      source.dataType?.name === targetDataType
    );
    
    logInfo('discoverDataSources', `Found ${matchingSources.length} sources for ${dataType}`);
    matchingSources.forEach((source, idx) => {
      logInfo('discoverDataSources', `Source ${idx + 1}: ${source.dataStreamId}`);
    });
    
    return matchingSources;
    
  } catch (error) {
    logError('discoverDataSources', error, { dataType });
    return [];
  }
}


async function fetchFromDataSource(dataSource, start, end, dataType) {
  const request = {
    userId: 'me',
    resource: {
      aggregateBy: [{
        dataTypeName: dataSource.dataTypeName,
        dataSourceId: dataSource.dataStreamId
      }],
      bucketByTime: { durationMillis: 86400000 },
      startTimeMillis: start.getTime(),
      endTimeMillis: end.getTime()
    }
  };

  logInfo('fetchFromDataSource', 'Making Google Fit API request...');
  const response = await fitness.users.dataset.aggregate(request);
  
  return processApiResponse(response, dataType);
}

function processApiResponse(response, dataType) {
  const processedData = [];
  
  if (!response.data.bucket || response.data.bucket.length === 0) {
    logInfo('processApiResponse', `No buckets for ${dataType}`);
    return processedData;
  }

  logInfo('processApiResponse', `Processing ${response.data.bucket.length} buckets`);

  for (const bucket of response.data.bucket) {
    const bucketDate = new Date(parseInt(bucket.startTimeMillis));
    const date = bucketDate.toISOString().split('T')[0];
    let value = 0;
    let sleepBreakdown = null;

    if (bucket.dataset && bucket.dataset.length > 0) {
      for (const dataset of bucket.dataset) {
        if (dataset.point && dataset.point.length > 0) {
          
          if (dataType === 'sleep') {
            const sleepResult = processSleepPoints(dataset.point);
            value += sleepResult.totalMinutes;
            sleepBreakdown = sleepResult.breakdown;
          } else if (dataType === 'calories') {
            value += processCaloriePoints(dataset.point);
          } else {
            const dayTotal = dataset.point.reduce((sum, point) => {
              if (point.value && point.value.length > 0) {
                const pointValue = point.value[0];
                const val = pointValue.intVal !== undefined ? pointValue.intVal : 
                           pointValue.fpVal !== undefined ? pointValue.fpVal : 0;
                return sum + val;
              }
              return sum;
            }, 0);
            value += dayTotal;
          }
        }
      }
    }
    
    const dataPoint = {
      date,
      value: Math.round(value),
      dataType
    };

    if (dataType === 'sleep' && sleepBreakdown) {
      Object.assign(dataPoint, sleepBreakdown);
    }
    
    processedData.push(dataPoint);
  }

  return processedData;
}

function processSleepPoints(points) {
  let totalSleepMinutes = 0;
  let deepSleep = 0;
  let lightSleep = 0;
  let remSleep = 0;
  let awakeTime = 0;
  
  for (const point of points) {
    if (point.value && point.value.length > 0) {
      const startTime = parseInt(point.startTimeNanos) / 1000000;
      const endTime = parseInt(point.endTimeNanos) / 1000000;
      const durationMinutes = (endTime - startTime) / (1000 * 60);
      const sleepType = point.value[0].intVal || 0;
      
      switch (sleepType) {
        case 1: 
          awakeTime += durationMinutes;
          break;
        case 2: 
        case 4:
          lightSleep += durationMinutes;
          totalSleepMinutes += durationMinutes;
          break;
        case 5: 
          deepSleep += durationMinutes;
          totalSleepMinutes += durationMinutes;
          break;
        case 6: 
          remSleep += durationMinutes;
          totalSleepMinutes += durationMinutes;
          break;
        default:
          lightSleep += durationMinutes;
          totalSleepMinutes += durationMinutes;
      }
    }
  }
  
  const efficiency = totalSleepMinutes > 0 ? 
    Math.round((totalSleepMinutes / (totalSleepMinutes + awakeTime)) * 100) : 0;
  
  return {
    totalMinutes: totalSleepMinutes,
    breakdown: {
      deep_sleep: Math.round(deepSleep),
      light_sleep: Math.round(lightSleep),
      rem_sleep: Math.round(remSleep),
      awake_time: Math.round(awakeTime),
      efficiency: Math.min(100, Math.max(0, efficiency))
    }
  };
}

function processCaloriePoints(points) {
  let totalCalories = 0;
  
  for (const point of points) {
    if (point.value && point.value.length > 0) {
      const pointValue = point.value[0];
      const calories = pointValue.fpVal !== undefined ? pointValue.fpVal : 
                      pointValue.intVal !== undefined ? pointValue.intVal : 0;
      totalCalories += calories;
    }
  }
  
  return totalCalories;
}

async function fetchFromDiscoveredSources(sources, start, end, dataType) {
  logInfo('fetchFromDiscoveredSources', `Trying ${sources.length} sources for ${dataType}`);
  
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    try {
      logInfo('fetchFromDiscoveredSources', `Trying source ${i + 1}/${sources.length}: ${source.dataStreamId}`);
      
      const dataSource = {
        dataSourceId: source.dataStreamId,
        dataTypeName: source.dataType.name
      };
      
      const data = await fetchFromDataSource(dataSource, start, end, dataType);
      
      if (data.length > 0) {
        logInfo('fetchFromDiscoveredSources', `SUCCESS with source ${i + 1}: ${data.length} records`);
        return data;
      } else {
        logInfo('fetchFromDiscoveredSources', `Source ${i + 1} returned no data`);
      }
      
    } catch (error) {
      logError('fetchFromDiscoveredSources', error, { sourceIndex: i + 1, sourceId: source.dataStreamId });
    }
  }
  
  logInfo('fetchFromDiscoveredSources', `All ${sources.length} sources failed for ${dataType}`);
  return [];
}

router.get('/fitness-data', asyncHandler(async (req, res) => {
  const { startDate, endDate, dataType, sync = false, userId: queryUserId } = req.query;
  const userId = parseInt(queryUserId);
  
  logInfo('fitness-data', `Request received`, { userId, dataType, sync, startDate, endDate });
  
  if (!userId) {
    logError('fitness-data', new Error('Missing userId parameter'));
    return res.status(400).json({ error: 'userId query parameter is required' });
  }
  
  if (!dataType || !['steps', 'heartrate', 'calories', 'sleep'].includes(dataType)) {
    logError('fitness-data', new Error('Invalid dataType'), { dataType });
    return res.status(400).json({ 
      error: 'dataType must be one of: steps, heartrate, calories, sleep' 
    });
  }

  try {
    logInfo('fitness-data', `Fetching ${dataType} for user ${userId}`, { startDate, endDate });

    const tokens = await getUserTokens(userId);
    if (!tokens) {
      logInfo('fitness-data', `No Google Fit tokens for user ${userId}`, { fallbackToStored: true });
      
      const storedData = await getStoredFitnessData(userId, dataType, startDate, endDate);
      
      return res.json({
        message: `No Google Fit connection, returning stored ${dataType} data`,
        dataType,
        data: storedData,
        count: storedData.length,
        requiresAuth: true,
        authUrl: `/api/wearable/auth/google?userId=${userId}`
      });
    }

    logInfo('fitness-data', 'Setting OAuth credentials');
    await setOAuthCredentialsForUser(userId);

    const start = startDate ? new Date(startDate + 'T00:00:00.000Z') : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();
    
    logInfo('fitness-data', `Date range determined`, { 
      start: start.toISOString(), 
      end: end.toISOString() 
    });

    logInfo('fitness-data', `Discovering data sources for ${dataType}`);
    const availableSources = await discoverDataSources(dataType);
    
    if (availableSources.length === 0) {
      logInfo('fitness-data', `No Google Fit sources available for ${dataType}`, { fallbackToStored: true });
      const storedData = await getStoredFitnessData(userId, dataType, startDate, endDate);
      return res.json({
        message: `No Google Fit sources for ${dataType}, returning stored data`,
        dataType,
        data: storedData,
        count: storedData.length,
        noSourcesAvailable: true
      });
    }

    logInfo('fitness-data', `Found ${availableSources.length} sources, fetching data`);
    const processedData = await fetchFromDiscoveredSources(availableSources, start, end, dataType);
    
    logInfo('fitness-data', `Processed ${processedData.length} data points`);

    if (sync === 'true' && processedData.length > 0) {
      logInfo('fitness-data', `Storing ${processedData.length} records in database`);
      await storeDataInDatabase(userId, dataType, processedData);
      logInfo('fitness-data', `Successfully synced ${processedData.length} ${dataType} records`);
    }
    
    await db.update(usersTable)
      .set({ last_sync: new Date() })
      .where(eq(usersTable.id, userId));

    logInfo('fitness-data', 'Request completed successfully');
    
    res.json({
      message: `Successfully fetched ${dataType} data`,
      dataType,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      data: processedData,
      count: processedData.length,
      syncTimestamp: new Date().toISOString(),
      dataSource: 'Google Fit via API'
    });

  } catch (error) {
    logError('fitness-data', error, { userId, dataType });
    
    if (error.message.includes('token') || error.message.includes('auth') || error.code === 401) {
      logInfo('fitness-data', 'Authentication error detected, returning auth required response');
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Google Fit token expired or invalid',
        requiresReauth: true,
        authUrl: `/api/wearable/auth/google?userId=${userId}`
      });
    }
    
    try {
      logInfo('fitness-data', 'Attempting fallback to stored data');
      const storedData = await getStoredFitnessData(userId, dataType, startDate, endDate);
      logInfo('fitness-data', `Fallback successful, returning ${storedData.length} stored records`);
      
      return res.json({
        message: `Google Fit error, returning stored ${dataType} data`,
        dataType,
        data: storedData,
        count: storedData.length,
        error: error.message,
        usingFallback: true
      });
    } catch (dbError) {
      logError('fitness-data', dbError, { context: 'database-fallback', originalError: error.message });
    }
    
    res.status(500).json({ 
      error: `Failed to fetch ${dataType} data`,
      details: error.message 
    });
  }
}));

async function storeDataInDatabase(userId, dataType, processedData) {
  logInfo('storeDataInDatabase', `Storing ${processedData.length} ${dataType} records`);
  
  let storedCount = 0;
  for (const dayData of processedData) {
    if (dayData.value > 0) {
      try {
        const stored = await storeDataByType(userId, dataType, dayData);
        if (stored) storedCount++;
      } catch (error) {
        logError('storeDataInDatabase', error, { dataType, date: dayData.date });
      }
    }
  }
  
  logInfo('storeDataInDatabase', `Stored ${storedCount}/${processedData.length} ${dataType} records`);
}

async function storeDataByType(userId, dataType, dayData) {
  switch (dataType) {
    case 'steps':
      return await storeStepsData(userId, dayData);
    case 'heartrate':
      return await storeHeartRateData(userId, dayData);
    case 'calories':
      return await storeCaloriesData(userId, dayData);
    case 'sleep':
      return await storeSleepData(userId, dayData);
    default:
      logError('storeDataByType', new Error(`Unknown data type: ${dataType}`));
      return false;
  }
}

async function storeStepsData(userId, dayData) {
  try {
    const existing = await db.select()
      .from(stepsDataTable)
      .where(and(
        eq(stepsDataTable.user_id, userId),
        eq(stepsDataTable.date, dayData.date)
      ))
      .limit(1);

    if (existing.length > 0) {
      await db.update(stepsDataTable)
        .set({ steps_count: dayData.value })
        .where(and(
          eq(stepsDataTable.user_id, userId),
          eq(stepsDataTable.date, dayData.date)
        ));
      logInfo('storeStepsData', `Updated steps ${dayData.date}: ${dayData.value}`);
    } else {
      await db.insert(stepsDataTable)
        .values({
          user_id: userId,
          date: dayData.date,
          steps_count: dayData.value
        });
      logInfo('storeStepsData', `Inserted steps ${dayData.date}: ${dayData.value}`);
    }
    return true;
  } catch (error) {
    logError('storeStepsData', error);
    return false;
  }
}

async function storeHeartRateData(userId, dayData) {
  try {
    const existing = await db.select()
      .from(heartRateDataTable)
      .where(and(
        eq(heartRateDataTable.user_id, userId),
        eq(heartRateDataTable.date, dayData.date)
      ))
      .limit(1);

    if (existing.length > 0) {
      await db.update(heartRateDataTable)
        .set({ heart_rate_bpm: dayData.value })
        .where(and(
          eq(heartRateDataTable.user_id, userId),
          eq(heartRateDataTable.date, dayData.date)
        ));
      logInfo('storeHeartRateData', `Updated heart rate ${dayData.date}: ${dayData.value} bpm`);
    } else {
      await db.insert(heartRateDataTable)
        .values({
          user_id: userId,
          date: dayData.date,
          heart_rate_bpm: dayData.value
        });
      logInfo('storeHeartRateData', `Inserted heart rate ${dayData.date}: ${dayData.value} bpm`);
    }
    return true;
  } catch (error) {
    logError('storeHeartRateData', error);
    return false;
  }
}

async function storeCaloriesData(userId, dayData) {
  try {
    const existing = await db.select()
      .from(calorieDataTable)
      .where(and(
        eq(calorieDataTable.user_id, userId),
        eq(calorieDataTable.date, dayData.date)
      ))
      .limit(1);

    if (existing.length > 0) {
      await db.update(calorieDataTable)
        .set({ calories: dayData.value })
        .where(and(
          eq(calorieDataTable.user_id, userId),
          eq(calorieDataTable.date, dayData.date)
        ));
      logInfo('storeCaloriesData', `Updated calories ${dayData.date}: ${dayData.value}`);
    } else {
      await db.insert(calorieDataTable)
        .values({
          user_id: userId,
          date: dayData.date,
          calories: dayData.value
        });
      logInfo('storeCaloriesData', `Inserted calories ${dayData.date}: ${dayData.value}`);
    }
    return true;
  } catch (error) {
    logError('storeCaloriesData', error);
    return false;
  }
}

async function storeSleepData(userId, dayData) {
  try {
    const existing = await db.select()
      .from(sleepDataTable)
      .where(and(
        eq(sleepDataTable.user_id, userId),
        eq(sleepDataTable.date, dayData.date)
      ))
      .limit(1);

    const sleepData = {
      deep_sleep_minutes: Math.round(dayData.deep_sleep || 0),
      light_sleep_minutes: Math.round(dayData.light_sleep || 0),
      rem_sleep_minutes: Math.round(dayData.rem_sleep || 0),
      awake_minutes: Math.round(dayData.awake_time || 0),
      sleep_efficiency_percent: Math.round(dayData.efficiency || 85)
    };

    if (existing.length > 0) {
      await db.update(sleepDataTable)
        .set(sleepData)
        .where(and(
          eq(sleepDataTable.user_id, userId),
          eq(sleepDataTable.date, dayData.date)
        ));
      logInfo('storeSleepData', `Updated sleep ${dayData.date}: ${dayData.value}min`);
    } else {
      await db.insert(sleepDataTable)
        .values({
          user_id: userId,
          date: dayData.date,
          ...sleepData
        });
      logInfo('storeSleepData', `Inserted sleep ${dayData.date}: ${dayData.value}min`);
    }
    return true;
  } catch (error) {
    logError('storeSleepData', error);
    return false;
  }
}


router.get('/stored-data/:dataType/:userId', asyncHandler(async (req, res) => {
  const { dataType, userId } = req.params;
  const { days = 7 } = req.query;
  
  logInfo('stored-data', `Retrieving stored ${dataType} data for user ${userId} (last ${days} days)`);
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));
  const startDateStr = startDate.toISOString().split('T')[0];
  
  try {
    const data = await getStoredFitnessData(parseInt(userId), dataType, startDateStr, null);
    
    logInfo('stored-data', `Retrieved ${data.length} stored ${dataType} records`);
    
    res.json({
      message: `Retrieved ${dataType} data from database`,
      dataType,
      period: `Last ${days} days`,
      data: data,
      count: data.length
    });
    
  } catch (error) {
    logError('stored-data', error, { dataType, userId });
    res.status(500).json({ error: error.message });
  }
}));

async function getStoredFitnessData(userId, dataType, startDate, endDate) {
  logInfo('getStoredFitnessData', `Getting stored ${dataType} for user ${userId}`);
  
  const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  try {
    let data = [];
    
    switch (dataType) {
      case 'steps':
        const stepsData = await db.select()
          .from(stepsDataTable)
          .where(and(
            eq(stepsDataTable.user_id, userId),
            gte(stepsDataTable.date, start)
          ))
          .orderBy(stepsDataTable.date);
        
        data = stepsData.map(row => ({
          date: row.date,
          value: row.steps_count || 0,
          dataType: 'steps'
        }));
        break;
        
      case 'heartrate':
        const heartData = await db.select()
          .from(heartRateDataTable)
          .where(and(
            eq(heartRateDataTable.user_id, userId),
            gte(heartRateDataTable.date, start)
          ))
          .orderBy(heartRateDataTable.date);
        
        data = heartData.map(row => ({
          date: row.date,
          value: row.heart_rate_bpm || 0,
          dataType: 'heartrate'
        }));
        break;
        
      case 'calories':
        const calorieData = await db.select()
          .from(calorieDataTable)
          .where(and(
            eq(calorieDataTable.user_id, userId),
            gte(calorieDataTable.date, start)
          ))
          .orderBy(calorieDataTable.date);
        
        data = calorieData.map(row => ({
          date: row.date,
          value: row.calories || 0,
          dataType: 'calories'
        }));
        break;
        
      case 'sleep':
        const sleepData = await db.select()
          .from(sleepDataTable)
          .where(and(
            eq(sleepDataTable.user_id, userId),
            gte(sleepDataTable.date, start)
          ))
          .orderBy(sleepDataTable.date);
        
        data = sleepData.map(row => {
          const deep = row.deep_sleep_minutes || 0;
          const light = row.light_sleep_minutes || 0;
          const rem = row.rem_sleep_minutes || 0;
          const total = deep + light + rem;
          
          return {
            date: row.date,
            value: total,
            deep_sleep: deep,
            light_sleep: light,
            rem_sleep: rem,
            awake_time: row.awake_minutes || 0,
            efficiency: row.sleep_efficiency_percent || 85,
            dataType: 'sleep'
          };
        });
        break;
    }
    
    logInfo('getStoredFitnessData', `Retrieved ${data.length} stored ${dataType} records`);
    return data;
    
  } catch (error) {
    logError('getStoredFitnessData', error, { dataType, userId });
    return [];
  }
}

module.exports = router;