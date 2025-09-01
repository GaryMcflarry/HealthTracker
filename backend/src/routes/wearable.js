const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { eq, gte, and } = require('drizzle-orm');
const { db } = require('../db');
const { usersTable, stepsDataTable, heartRateDataTable, sleepDataTable, calorieDataTable } = require('../db/schema');
const { asyncHandler } = require('../lib/utils');

// Initialize Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || '140323638250-v75qjj2ki2qhal2rsscbnhkvhkcctpa0.apps.googleusercontent.com',
  process.env.GOOGLE_CLIENT_SECRET || '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',
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/wearable/auth/callback'
);

const fitness = google.fitness({ version: 'v1', auth: oauth2Client });

// ========================================
// UTILITY FUNCTIONS FOR TOKEN MANAGEMENT
// ========================================

async function getUserTokens(userId) {
  console.log(`🔍 Retrieving tokens for user: ${userId}`);
  
  const user = await db
    .select({ fit_tokens: usersTable.fit_tokens })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
    
  if (user[0]?.fit_tokens) {
    try {
      const tokens = JSON.parse(user[0].fit_tokens);
      console.log('✅ Tokens found and parsed successfully');
      return tokens;
    } catch (e) {
      console.error('❌ Error parsing fit_tokens:', e);
      return null;
    }
  }
  
  console.warn('⚠️ No tokens found for user');
  return null;
}

async function saveUserTokens(userId, tokens) {
  console.log(`💾 Saving tokens for user: ${userId}`);
  
  await db
    .update(usersTable)
    .set({ 
      fit_tokens: JSON.stringify(tokens),
      last_sync: new Date()
    })
    .where(eq(usersTable.id, userId));
    
  console.log('✅ Tokens saved successfully');
}

async function updateUserLastSync(userId) {
  console.log(`🔄 Updating last_sync for user: ${userId}`);
  
  await db
    .update(usersTable)
    .set({ 
      last_sync: new Date()
    })
    .where(eq(usersTable.id, userId));
    
  console.log('✅ User last_sync updated successfully');
}

async function setOAuthCredentialsForUser(userId) {
  console.log(`🔐 Setting OAuth credentials for user: ${userId}`);
  
  const tokens = await getUserTokens(userId);
  if (!tokens) {
    throw new Error('User has not authorized Google Fit or tokens are missing.');
  }
  
  if (!tokens.access_token) {
     throw new Error('Invalid Google Fit tokens found for user - missing access_token.');
  }

  oauth2Client.setCredentials(tokens);
  
  // Check if token needs refresh
  if (tokens.expiry_date && Date.now() >= tokens.expiry_date) {
    console.log('🔄 Token expired, refreshing...');
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await saveUserTokens(userId, credentials);
      console.log('✅ Token refreshed successfully');
    } catch (error) {
      console.error('❌ Failed to refresh token:', error);
      throw new Error('Failed to refresh expired token. User needs to re-authorize.');
    }
  } else {
    console.log('✅ OAuth credentials set successfully');
  }
}

// ========================================
// AUTHENTICATION ROUTES
// ========================================

// Get Google Fit OAuth URL
router.get('/auth/google', asyncHandler(async (req, res) => {
  const userId = req.query.userId;
  console.log(`🔗 Initiating Google Fit auth for user: ${userId}`);
  
  if (!userId) {
      return res.status(400).json({ error: 'User ID is required to initiate Google Fit connection.' });
  }
  
  try {
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
      state: JSON.stringify({ userId: userId }) 
    });

    console.log('✅ OAuth URL generated successfully');
    res.json({
      message: 'Google Fit OAuth URL generated',
      authUrl: authUrl
    });
  } catch (error) {
    console.error('❌ OAuth URL generation error:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
}));

// Handle OAuth callback
router.get('/auth/callback', asyncHandler(async (req, res) => {
  console.log('🔄 Handling OAuth callback...');
  
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      console.error('❌ OAuth error:', error);
      return res.redirect('/dashboard/dashboard.html?error=oauth_failed');
    }
    
    if (!code) {
      console.error('❌ No authorization code received');
      return res.redirect('/dashboard/dashboard.html?error=oauth_failed');
    }

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Parse userId from state
    let userId = null;
    if (state) {
        try {
            const stateObj = JSON.parse(state);
            userId = stateObj.userId;
        } catch (e) {
            console.error("❌ Error parsing state parameter:", e);
        }
    }

    if (!userId) {
      console.error('❌ No user ID found in state');
      return res.redirect('/dashboard/dashboard.html?error=no_user_id');
    }

    // Save tokens to the database
    await saveUserTokens(parseInt(userId), tokens);
    
    console.log('✅ OAuth callback completed successfully');
    res.redirect('/dashboard/dashboard.html?oauth=success');

  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.redirect('/dashboard/dashboard.html?error=oauth_callback_failed');
  }
}));

// ========================================
// IMPROVED DATA SOURCE CONFIGURATIONS
// ========================================

function getDataSourceConfig(dataType) {
  const configs = {
    steps: {
      dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
      dataTypeName: 'com.google.step_count.delta'
    },
    heartrate: {
      dataSourceId: 'derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm',
      dataTypeName: 'com.google.heart_rate.bpm'
    },
    calories: {
      // Try multiple data sources for calories
      dataSourceId: 'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended',
      dataTypeName: 'com.google.calories.expended',
      alternatives: [
        {
          dataSourceId: 'derived:com.google.calories.expended:com.google.android.gms:platform_calories_expended',
          dataTypeName: 'com.google.calories.expended'
        },
        {
          dataSourceId: 'raw:com.google.calories.expended:com.google.android.gms:from_activities',
          dataTypeName: 'com.google.calories.expended'
        }
      ]
    },
    sleep: {
      // Primary sleep data source
      dataSourceId: 'derived:com.google.sleep.segment:com.google.android.gms:merged',
      dataTypeName: 'com.google.sleep.segment',
      alternatives: [
        {
          dataSourceId: 'raw:com.google.sleep.segment:com.google.android.gms:sleep_from_activity',
          dataTypeName: 'com.google.sleep.segment'
        },
        {
          dataSourceId: 'derived:com.google.activity.segment:com.google.android.gms:merge_activity_segments',
          dataTypeName: 'com.google.activity.segment'
        }
      ]
    }
  };
  
  return configs[dataType] || null;
}
// ENHANCED FITNESS DATA FETCHING WITH FALLBACKS
// ========================================

router.get('/fitness-data', asyncHandler(async (req, res) => {
  const { startDate, endDate, dataType, userId } = req.query;
  
  console.log(`📊 Fetching ${dataType} data for user ${userId} from ${startDate} to ${endDate}`);
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required as query parameter' });
  }

  try {
    // Check if user has Google Fit tokens first
    const tokens = await getUserTokens(parseInt(userId));
    if (!tokens) {
      console.warn(`⚠️ No Google Fit tokens found for user ${userId}`);
      
      // Try to get stored data from database instead
      const storedData = await getStoredFitnessData(parseInt(userId), dataType, startDate, endDate);
      
      return res.json({
        message: `No Google Fit connection found, returning stored ${dataType} data`,
        dataType: dataType,
        data: storedData,
        count: storedData.length,
        requiresAuth: true,
        authUrl: `/api/wearable/auth/google?userId=${userId}`
      });
    }

    await setOAuthCredentialsForUser(parseInt(userId));

    const start = startDate ? new Date(startDate + 'T00:00:00.000Z') : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();
    
    console.log(`📅 Date range: ${start.toISOString()} to ${end.toISOString()}`);

    // Get data with enhanced fetching logic
    const processedData = await fetchDataWithFallbacks(dataType, start, end);
    
    console.log(`✅ Processed ${processedData.length} data points`);

    // Store data in database
    if (processedData.length > 0) {
      console.log('💾 Storing data in database...');
      await storeDataInDatabase(parseInt(userId), dataType, processedData);
      
      // Update user's last_sync timestamp
      await updateUserLastSync(parseInt(userId));
      
      const newDataCount = processedData.filter(d => d.value > 0).length;
      console.log('✅ Data stored successfully');
      console.log(`🎉 SYNC SUCCESS: ${newDataCount} new ${dataType} records synced for user ${userId}`);
      console.log(`📊 SYNC DETAILS: ${dataType.toUpperCase()} data from ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`);
    } else {
      console.log(`⚠️ SYNC RESULT: No new ${dataType} data found for user ${userId}`);
    }

    res.json({
      message: `Successfully fetched and stored ${dataType} data`,
      dataType: dataType,
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      data: processedData,
      count: processedData.length,
      stored: processedData.filter(d => d.value > 0).length,
      syncTimestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ SYNC FAILED: Error fetching ${dataType} data for user ${userId}:`, error);
    
    // Check if it's a token/auth issue and trigger re-auth
    if (error.message.includes('token') || error.message.includes('auth') || error.message.includes('unauthorized')) {
      console.log(`🔄 TOKEN ISSUE DETECTED: Initiating re-auth flow for user ${userId}`);
      
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Google Fit token expired or invalid',
        requiresReauth: true,
        authUrl: `/api/wearable/auth/google?userId=${userId}`,
        redirectToAuth: true
      });
    }
    
    // If Google Fit API fails, try to return stored data
    try {
      const storedData = await getStoredFitnessData(parseInt(userId), dataType, startDate, endDate);
      console.log(`🗃️ FALLBACK: Returning ${storedData.length} stored records due to API error`);
      
      return res.json({
        message: `Google Fit API error, returning stored ${dataType} data`,
        dataType: dataType,
        data: storedData,
        count: storedData.length,
        error: error.message,
        usingFallback: true
      });
    } catch (dbError) {
      console.error(`❌ Database fallback also failed:`, dbError);
    }
    
    res.status(500).json({ 
      error: `Failed to fetch ${dataType} data`,
      details: error.message 
    });
  }
}));

// ========================================
// ENHANCED DATA FETCHING WITH MULTIPLE FALLBACKS
// ========================================

async function fetchDataWithFallbacks(dataType, start, end) {
  const dataSource = getDataSourceConfig(dataType);
  if (!dataSource) {
    throw new Error(`Unsupported data type: ${dataType}`);
  }

  // Try primary data source first
  try {
    console.log(`🔧 Trying primary data source for ${dataType}: ${dataSource.dataSourceId}`);
    const data = await fetchFromDataSource(dataSource, start, end, dataType);
    if (data.length > 0) {
      console.log(`✅ Primary source successful for ${dataType}: ${data.length} records`);
      return data;
    }
  } catch (error) {
    console.warn(`⚠️ Primary data source failed for ${dataType}:`, error.message);
  }

  // Try alternative data sources if available
  if (dataSource.alternatives && dataSource.alternatives.length > 0) {
    for (let i = 0; i < dataSource.alternatives.length; i++) {
      const altSource = dataSource.alternatives[i];
      try {
        console.log(`🔄 Trying alternative ${i + 1} for ${dataType}: ${altSource.dataSourceId}`);
        const data = await fetchFromDataSource(altSource, start, end, dataType);
        if (data.length > 0) {
          console.log(`✅ Alternative source ${i + 1} successful for ${dataType}: ${data.length} records`);
          return data;
        }
      } catch (error) {
        console.warn(`⚠️ Alternative source ${i + 1} failed for ${dataType}:`, error.message);
      }
    }
  }

  // Special handling for sleep data - try activity-based detection
  if (dataType === 'sleep') {
    try {
      console.log('🛏️ Trying activity-based sleep detection...');
      return await fetchSleepFromActivity(start, end);
    } catch (error) {
      console.warn('⚠️ Activity-based sleep detection failed:', error.message);
    }
  }

  // Special handling for calories - try basal + active calories
  if (dataType === 'calories') {
    try {
      console.log('🔥 Trying combined basal + active calories...');
      return await fetchCombinedCalories(start, end);
    } catch (error) {
      console.warn('⚠️ Combined calories fetch failed:', error.message);
    }
  }

  console.warn(`⚠️ All data sources failed for ${dataType}, returning empty array`);
  return [];
}

async function fetchFromDataSource(dataSource, start, end, dataType) {
  const request = {
    userId: 'me',
    resource: {
      aggregateBy: [{
        dataTypeName: dataSource.dataTypeName,
        dataSourceId: dataSource.dataSourceId
      }],
      bucketByTime: { durationMillis: 86400000 }, // 24 hours
      startTimeMillis: start.getTime(),
      endTimeMillis: end.getTime()
    }
  };

  console.log('🌐 Making Google Fit API request...');
  const response = await fitness.users.dataset.aggregate(request);
  
  return processApiResponse(response, dataType);
}

// ========================================
// ENHANCED DATA PROCESSING
// ========================================

function processApiResponse(response, dataType) {
  const processedData = [];
  
  if (!response.data.bucket || response.data.bucket.length === 0) {
    console.warn(`⚠️ No data buckets received for ${dataType}`);
    return processedData;
  }

  for (const bucket of response.data.bucket) {
    const bucketDate = new Date(parseInt(bucket.startTimeMillis));
    const date = bucketDate.toISOString().split('T')[0];
    let value = 0;

    if (bucket.dataset && bucket.dataset.length > 0) {
      for (const dataset of bucket.dataset) {
        if (dataset.point && dataset.point.length > 0) {
          // Enhanced processing based on data type
          if (dataType === 'sleep') {
            value += processSleepPoints(dataset.point);
          } else if (dataType === 'calories') {
            value += processCaloriePoints(dataset.point);
          } else {
            // Standard processing for steps and heart rate
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
    
    if (value > 0) {
      console.log(`📊 ${date}: ${value} ${getDataUnit(dataType)}`);
    }
    
    processedData.push({
      date: date,
      value: Math.round(value),
      dataType: dataType
    });
  }

  return processedData;
}

function processSleepPoints(points) {
  let totalSleepMinutes = 0;
  
  for (const point of points) {
    if (point.value && point.value.length > 0) {
      // Sleep segments have start and end times
      const startTime = parseInt(point.startTimeNanos) / 1000000;
      const endTime = parseInt(point.endTimeNanos) / 1000000;
      const durationMs = endTime - startTime;
      const durationMinutes = durationMs / (1000 * 60);
      
      // Check if this is actually a sleep segment (not awake time)
      const sleepType = point.value[0].intVal;
      if (sleepType && sleepType !== 1) { // 1 = awake, others are sleep types
        totalSleepMinutes += durationMinutes;
      }
    }
  }
  
  return totalSleepMinutes;
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

// ========================================
// SPECIAL FALLBACK METHODS
// ========================================

async function fetchSleepFromActivity(start, end) {
  console.log('🛏️ Attempting to fetch sleep data from HealthSync...');
  
  // First try HealthSync sources
  const healthSyncData = await fetchHealthSyncSleepData(start, end);
  if (healthSyncData.length > 0) {
    console.log(`✅ Successfully fetched ${healthSyncData.length} days of HealthSync sleep data`);
    return healthSyncData;
  }
  
  // Fallback to original activity-based detection
  console.log('🔄 Falling back to activity-based sleep detection...');
  try {
    const request = {
      userId: 'me',
      resource: {
        aggregateBy: [{
          dataTypeName: 'com.google.activity.segment'
        }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: start.getTime(),
        endTimeMillis: end.getTime()
      }
    };

    const response = await fitness.users.dataset.aggregate(request);
    const sleepData = [];

    if (response.data.bucket) {
      for (const bucket of response.data.bucket) {
        const date = new Date(parseInt(bucket.startTimeMillis)).toISOString().split('T')[0];
        let sleepMinutes = 0;

        if (bucket.dataset && bucket.dataset.length > 0) {
          for (const dataset of bucket.dataset) {
            if (dataset.point) {
              for (const point of dataset.point) {
                if (point.value && point.value[0] && point.value[0].intVal === 72) {
                  const startTime = parseInt(point.startTimeNanos) / 1000000;
                  const endTime = parseInt(point.endTimeNanos) / 1000000;
                  sleepMinutes += (endTime - startTime) / (1000 * 60);
                }
              }
            }
          }
        }

        if (sleepMinutes > 0) {
          sleepData.push({
            date: date,
            value: Math.round(sleepMinutes),
            deep_sleep: Math.round(sleepMinutes * 0.25),
            light_sleep: Math.round(sleepMinutes * 0.55),
            rem_sleep: Math.round(sleepMinutes * 0.20),
            awake_time: 0,
            efficiency: Math.round((sleepMinutes / (sleepMinutes + 30)) * 100), // Assume 30min awake
            dataType: 'sleep'
          });
        }
      }
    }

    return sleepData;
  } catch (error) {
    console.error('❌ Activity-based sleep detection failed:', error);
    return [];
  }
}

async function fetchCombinedCalories(start, end) {
  console.log('🔥 Attempting to fetch basal + active calories...');
  
  try {
    // Fetch basal metabolic rate calories
    const basalRequest = {
      userId: 'me',
      resource: {
        aggregateBy: [{
          dataTypeName: 'com.google.calories.bmr'
        }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: start.getTime(),
        endTimeMillis: end.getTime()
      }
    };

    // Fetch active calories
    const activeRequest = {
      userId: 'me',
      resource: {
        aggregateBy: [{
          dataTypeName: 'com.google.calories.expended'
        }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: start.getTime(),
        endTimeMillis: end.getTime()
      }
    };

    const [basalResponse, activeResponse] = await Promise.all([
      fitness.users.dataset.aggregate(basalRequest).catch(() => ({ data: { bucket: [] } })),
      fitness.users.dataset.aggregate(activeRequest).catch(() => ({ data: { bucket: [] } }))
    ]);

    const combinedData = [];
    const dateMap = new Map();

    // Process basal calories
    if (basalResponse.data.bucket) {
      for (const bucket of basalResponse.data.bucket) {
        const date = new Date(parseInt(bucket.startTimeMillis)).toISOString().split('T')[0];
        let basalCalories = 0;

        if (bucket.dataset && bucket.dataset.length > 0) {
          basalCalories = processCaloriePoints(bucket.dataset[0].point || []);
        }

        dateMap.set(date, { basal: basalCalories, active: 0 });
      }
    }

    // Process active calories
    if (activeResponse.data.bucket) {
      for (const bucket of activeResponse.data.bucket) {
        const date = new Date(parseInt(bucket.startTimeMillis)).toISOString().split('T')[0];
        let activeCalories = 0;

        if (bucket.dataset && bucket.dataset.length > 0) {
          activeCalories = processCaloriePoints(bucket.dataset[0].point || []);
        }

        const existing = dateMap.get(date) || { basal: 0, active: 0 };
        existing.active = activeCalories;
        dateMap.set(date, existing);
      }
    }

    // Combine the data
    for (const [date, calories] of dateMap) {
      const totalCalories = calories.basal + calories.active;
      if (totalCalories > 0) {
        combinedData.push({
          date: date,
          value: Math.round(totalCalories),
          dataType: 'calories'
        });
      }
    }

    return combinedData;
  } catch (error) {
    console.error('❌ Combined calories fetch failed:', error);
    return [];
  }
}

// ========================================
// HEALTH DATA ROUTES
// ========================================

// Get comprehensive health summary
router.get('/health-summary', asyncHandler(async (req, res) => {
  const { userId } = req.query;
  
  console.log(`📋 Generating health summary for user: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required as query parameter' });
  }

  try {
    await setOAuthCredentialsForUser(parseInt(userId));

    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    console.log('🔄 Fetching summary data from multiple sources...');

    // Fetch multiple data types in parallel with error handling
    const [stepsData, heartRateData, caloriesData, sleepData] = await Promise.all([
      fetchGoogleFitData('steps', weekAgo, today).catch(err => { 
        console.warn('⚠️ Steps data unavailable:', err.message); 
        return []; 
      }),
      fetchGoogleFitData('heartrate', weekAgo, today).catch(err => { 
        console.warn('⚠️ Heart rate data unavailable:', err.message); 
        return []; 
      }),
      fetchGoogleFitData('calories', weekAgo, today).catch(err => { 
        console.warn('⚠️ Calories data unavailable:', err.message); 
        return []; 
      }),
      fetchGoogleFitData('sleep', weekAgo, today).catch(err => { 
        console.warn('⚠️ Sleep data unavailable:', err.message); 
        return []; 
      })
    ]);

    // Calculate summary statistics
    const summary = {
      steps: calculateMetricSummary(stepsData, 'steps'),
      heartRate: calculateMetricSummary(heartRateData, 'heartRate'),
      calories: calculateMetricSummary(caloriesData, 'calories'),
      sleep: calculateMetricSummary(sleepData, 'sleep')
    };

    console.log('✅ Health summary generated successfully');

    res.json({
      message: 'Health summary generated successfully',
      period: 'Last 7 days',
      summary: summary,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Health summary error:', error);
    res.status(500).json({ 
      error: 'Failed to generate health summary', 
      details: error.message 
    });
  }
}));

// Get stored fitness data from database - works with existing schema
router.get('/stored-data/:dataType/:userId', asyncHandler(async (req, res) => {
  const { dataType, userId } = req.params;
  const { days = 7 } = req.query;
  
  console.log(`🗃️ Retrieving stored ${dataType} data for user ${userId} (last ${days} days)`);
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));
  const startDateStr = startDate.toISOString().split('T')[0];
  
  try {
    let data = [];
    
    // Query existing schema structure exactly as it is
    switch (dataType) {
      case 'steps':
        const stepsData = await db
          .select()
          .from(stepsDataTable)
          .where(and(
            eq(stepsDataTable.user_id, parseInt(userId)),
            gte(stepsDataTable.date, startDateStr)
          ))
          .orderBy(stepsDataTable.date);
        
        // Transform to match expected format
        data = stepsData.map(row => ({
          date: row.date,
          value: row.steps_count || 0,
          dataType: 'steps'
        }));
        break;
        
      case 'heartrate':
        const heartData = await db
          .select()
          .from(heartRateDataTable)
          .where(and(
            eq(heartRateDataTable.user_id, parseInt(userId)),
            gte(heartRateDataTable.date, startDateStr)
          ))
          .orderBy(heartRateDataTable.date);
        
        data = heartData.map(row => ({
          date: row.date,
          value: row.heart_rate_bpm || 0,
          dataType: 'heartrate'
        }));
        break;
        
      case 'calories':
        const calorieData = await db
          .select()
          .from(calorieDataTable)
          .where(and(
            eq(calorieDataTable.user_id, parseInt(userId)),
            gte(calorieDataTable.date, startDateStr)
          ))
          .orderBy(calorieDataTable.date);
        
        data = calorieData.map(row => ({
          date: row.date,
          value: row.calories || 0,
          dataType: 'calories'
        }));
        break;
        
      case 'sleep':
        const sleepData = await db
          .select()
          .from(sleepDataTable)
          .where(and(
            eq(sleepDataTable.user_id, parseInt(userId)),
            gte(sleepDataTable.date, startDateStr)
          ))
          .orderBy(sleepDataTable.date);
        
        data = sleepData.map(row => ({
          date: row.date,
          value: (row.deep_sleep_minutes + row.light_sleep_minutes + row.rem_sleep_minutes) || 0,
          deep_sleep: row.deep_sleep_minutes || 0,
          light_sleep: row.light_sleep_minutes || 0,
          rem_sleep: row.rem_sleep_minutes || 0,
          efficiency: row.sleep_efficiency_percent || 0,
          dataType: 'sleep'
        }));
        break;
    }
    
    console.log(`✅ Retrieved ${data.length} stored ${dataType} records`);
    
    res.json({
      message: `Retrieved ${dataType} data from database`,
      dataType,
      period: `Last ${days} days`,
      data: data,
      count: data.length
    });
    
  } catch (error) {
    console.error(`❌ Error retrieving stored ${dataType} data:`, error);
    res.status(500).json({ error: error.message });
  }
}));

// ========================================
// HELPER FUNCTIONS
// ========================================

async function getStoredFitnessData(userId, dataType, startDate, endDate) {
  console.log(`🗃️ Getting stored ${dataType} data for user ${userId}`);
  
  const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];
  
  try {
    let data = [];
    
    switch (dataType) {
      case 'steps':
        const stepsData = await db
          .select()
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
        const heartData = await db
          .select()
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
        const calorieData = await db
          .select()
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
        const sleepData = await db
          .select()
          .from(sleepDataTable)
          .where(and(
            eq(sleepDataTable.user_id, userId),
            gte(sleepDataTable.date, start)
          ))
          .orderBy(sleepDataTable.date);
        
        data = sleepData.map(row => ({
          date: row.date,
          value: (row.deep_sleep_minutes + row.light_sleep_minutes + row.rem_sleep_minutes) || 0,
          dataType: 'sleep'
        }));
        break;
    }
    
    console.log(`✅ Retrieved ${data.length} stored ${dataType} records`);
    return data;
    
  } catch (error) {
    console.error(`❌ Error retrieving stored ${dataType} data:`, error);
    return [];
  }
}

function getDataUnit(dataType) {
  const units = {
    steps: 'steps',
    heartrate: 'bpm',
    calories: 'cal',
    sleep: 'minutes'
  };
  
  return units[dataType] || '';
}

function calculateMetricSummary(data, metricType) {
  if (!data || data.length === 0) {
    return {
      total: 0,
      average: 0,
      highest: 0,
      lowest: 0,
      data: []
    };
  }

  const values = data.map(d => d.value).filter(v => v > 0);
  
  if (values.length === 0) {
    return {
      total: 0,
      average: 0,
      highest: 0,
      lowest: 0,
      data: data
    };
  }

  const total = values.reduce((sum, val) => sum + val, 0);
  const average = Math.round(total / values.length);
  const highest = Math.max(...values);
  const lowest = Math.min(...values);

  return {
    total: metricType === 'steps' || metricType === 'calories' ? total : average,
    average,
    highest,
    lowest,
    data: data
  };
}

// ========================================
// DATA STORAGE FUNCTIONS - USING EXISTING SCHEMA
// ========================================

async function storeDataInDatabase(userId, dataType, processedData) {
  console.log(`💾 Storing ${processedData.length} ${dataType} records for user ${userId}`);
  
  let storedCount = 0;
  for (const dayData of processedData) {
    // Only store data with actual values to avoid cluttering database
    if (dayData.value > 0) {
      try {
        const stored = await storeDataByType(userId, dataType, dayData);
        if (stored) storedCount++;
      } catch (error) {
        console.error(`❌ Error storing ${dataType} data for ${dayData.date}:`, error);
      }
    }
  }
  
  console.log(`✅ Successfully stored ${storedCount}/${processedData.length} ${dataType} records`);
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
      console.warn(`⚠️ Unknown data type: ${dataType}`);
      return false;
  }
}

// Store functions using your EXACT existing schema
async function storeStepsData(userId, dayData) {
  try {
    const existing = await db
      .select()
      .from(stepsDataTable)
      .where(and(
        eq(stepsDataTable.user_id, userId),
        eq(stepsDataTable.date, dayData.date)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update existing record
      await db
        .update(stepsDataTable)
        .set({ 
          steps_count: dayData.value,
          hour: '23:59:00'
        })
        .where(and(
          eq(stepsDataTable.user_id, userId),
          eq(stepsDataTable.date, dayData.date)
        ));
      console.log(`📝 Updated steps data for ${dayData.date}: ${dayData.value}`);
    } else {
      // Insert new record using your exact schema
      await db
        .insert(stepsDataTable)
        .values({
          user_id: userId,
          date: dayData.date,
          hour: '23:59:00',
          steps_count: dayData.value
        });
      console.log(`➕ Inserted steps data for ${dayData.date}: ${dayData.value}`);
    }
    return true;
  } catch (error) {
    console.error(`❌ Error storing steps data:`, error);
    return false;
  }
}

async function storeHeartRateData(userId, dayData) {
  try {
    const existing = await db
      .select()
      .from(heartRateDataTable)
      .where(and(
        eq(heartRateDataTable.user_id, userId),
        eq(heartRateDataTable.date, dayData.date)
      ))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(heartRateDataTable)
        .set({ 
          heart_rate_bpm: dayData.value,
          hour: '23:59:00'
        })
        .where(and(
          eq(heartRateDataTable.user_id, userId),
          eq(heartRateDataTable.date, dayData.date)
        ));
      console.log(`📝 Updated heart rate data for ${dayData.date}: ${dayData.value} bpm`);
    } else {
      await db
        .insert(heartRateDataTable)
        .values({
          user_id: userId,
          date: dayData.date,
          hour: '23:59:00',
          heart_rate_bpm: dayData.value
        });
      console.log(`➕ Inserted heart rate data for ${dayData.date}: ${dayData.value} bpm`);
    }
    return true;
  } catch (error) {
    console.error(`❌ Error storing heart rate data:`, error);
    return false;
  }
}

async function storeCaloriesData(userId, dayData) {
  try {
    const existing = await db
      .select()
      .from(calorieDataTable)
      .where(and(
        eq(calorieDataTable.user_id, userId),
        eq(calorieDataTable.date, dayData.date)
      ))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(calorieDataTable)
        .set({ 
          calories: dayData.value,
          hour: '23:59:00'
        })
        .where(and(
          eq(calorieDataTable.user_id, userId),
          eq(calorieDataTable.date, dayData.date)
        ));
      console.log(`📝 Updated calories data for ${dayData.date}: ${dayData.value} cal`);
    } else {
      await db
        .insert(calorieDataTable)
        .values({
          user_id: userId,
          date: dayData.date,
          hour: '23:59:00',
          calories: dayData.value
        });
      console.log(`➕ Inserted calories data for ${dayData.date}: ${dayData.value} cal`);
    }
    return true;
  } catch (error) {
    console.error(`❌ Error storing calories data:`, error);
    return false;
  }
}

async function storeSleepData(userId, dayData) {
  try {
    const existing = await db
      .select()
      .from(sleepDataTable)
      .where(and(
        eq(sleepDataTable.user_id, userId),
        eq(sleepDataTable.date, dayData.date)
      ))
      .limit(1);

    const sleepData = {
      deep_sleep_minutes: dayData.deep_sleep || 0,
      light_sleep_minutes: dayData.light_sleep || 0,
      rem_sleep_minutes: dayData.rem_sleep || 0,
      awake_minutes: dayData.awake_time || 0,
      sleep_efficiency_percent: dayData.efficiency || 0
    };

    if (existing.length > 0) {
      await db
        .update(sleepDataTable)
        .set(sleepData)
        .where(and(
          eq(sleepDataTable.user_id, userId),
          eq(sleepDataTable.date, dayData.date)
        ));
      console.log(`📝 Updated sleep data for ${dayData.date}: ${dayData.value}min (${dayData.efficiency}% efficiency)`);
    } else {
      await db
        .insert(sleepDataTable)
        .values({
          user_id: userId,
          date: dayData.date,
          bedtime_start: '23:00:00',
          bedtime_end: '07:00:00',
          ...sleepData
        });
      console.log(`➕ Inserted sleep data for ${dayData.date}: ${dayData.value}min (${dayData.efficiency}% efficiency)`);
    }
    return true;
  } catch (error) {
    console.error(`❌ Error storing sleep data:`, error);
    return false;
  }
}

// ========================================
// GOOGLE FIT API FETCH HELPER
// ========================================

async function fetchGoogleFitData(dataType, startDate, endDate) {
  console.log(`🌐 Fetching ${dataType} data from Google Fit API...`);
  
  return await fetchDataWithFallbacks(dataType, startDate, endDate);
}


router.get('/test-healthsync-sleep/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { days = 7 } = req.query;
  
  console.log(`🛏️ Testing HealthSync sleep data for user ${userId} (${days} days)`);
  
  try {
    await setOAuthCredentialsForUser(parseInt(userId));
    
    const end = new Date();
    const start = new Date(end.getTime() - (parseInt(days) * 24 * 60 * 60 * 1000));
    
    console.log(`📅 Date range: ${start.toISOString()} to ${end.toISOString()}`);
    
    const sleepData = await fetchHealthSyncSleepData(start, end);
    
    // Store the data
    if (sleepData.length > 0) {
      console.log('💾 Storing HealthSync sleep data...');
      for (const dayData of sleepData) {
        await storeSleepData(parseInt(userId), dayData);
      }
      await updateUserLastSync(parseInt(userId));
    }
    
    res.json({
      message: 'HealthSync sleep data test completed',
      userId: userId,
      period: `${days} days`,
      data: sleepData,
      count: sleepData.length,
      stored: sleepData.length,
      format: 'Enhanced sleep data with phases and efficiency'
    });
    
  } catch (error) {
    console.error('❌ HealthSync sleep test failed:', error);
    res.status(500).json({
      error: 'HealthSync sleep test failed',
      details: error.message
    });
  }
}));

function generateSleepRecommendations(tests) {
  const recommendations = [];
  
  const hasAnySleepData = tests.some(test => test.success && test.test.includes('Sleep'));
  const hasDataSources = tests.find(test => test.test === 'Available Data Sources');
  
  if (!hasAnySleepData) {
    recommendations.push('❌ No sleep data found in any source');
    recommendations.push('🔧 Possible solutions:');
    recommendations.push('   1. Enable sleep tracking in Google Fit app');
    recommendations.push('   2. Connect a sleep-tracking device (Fitbit, Samsung Health, etc.)');
    recommendations.push('   3. Manually log sleep in Google Fit');
    recommendations.push('   4. Check if sleep permissions are granted in OAuth');
  }
  
  if (hasDataSources && hasDataSources.sleepSources?.length === 0) {
    recommendations.push('⚠️ No sleep data sources available - user may need to set up sleep tracking');
  }
  
  return recommendations;
}

// Helper function for testing individual sleep data sources
async function testSleepDataSource(dataSourceId, dataTypeName, start, end, debugResults, testName) {
  try {
    console.log(`🧪 Testing: ${testName} (${dataSourceId})`);
    
    const request = {
      userId: 'me',
      resource: {
        aggregateBy: [{
          dataTypeName: dataTypeName,
          dataSourceId: dataSourceId
        }],
        bucketByTime: { durationMillis: 86400000 }, // 24 hours
        startTimeMillis: start.getTime(),
        endTimeMillis: end.getTime()
      }
    };

    const response = await fitness.users.dataset.aggregate(request);
    
    let totalPoints = 0;
    let totalSleepMinutes = 0;
    const dailyData = [];
    
    if (response.data.bucket) {
      for (const bucket of response.data.bucket) {
        const date = new Date(parseInt(bucket.startTimeMillis)).toISOString().split('T')[0];
        let dayPoints = 0;
        let daySleep = 0;
        
        if (bucket.dataset && bucket.dataset.length > 0) {
          for (const dataset of bucket.dataset) {
            if (dataset.point && dataset.point.length > 0) {
              dayPoints += dataset.point.length;
              totalPoints += dataset.point.length;
              
              // Log first few points for inspection
              if (dataset.point.length > 0 && dailyData.length < 3) {
                console.log(`📊 Sample points for ${date}:`, 
                  dataset.point.slice(0, 3).map(p => ({
                    startTime: new Date(parseInt(p.startTimeNanos) / 1000000).toISOString(),
                    endTime: new Date(parseInt(p.endTimeNanos) / 1000000).toISOString(),
                    value: p.value
                  }))
                );
              }
              
              // Calculate sleep duration
              if (dataTypeName === 'com.google.sleep.segment') {
                daySleep = processSleepPoints(dataset.point);
              } else if (dataTypeName === 'com.google.activity.segment') {
                // Look for sleep activity type (72)
                for (const point of dataset.point) {
                  if (point.value && point.value[0] && point.value[0].intVal === 72) {
                    const startTime = parseInt(point.startTimeNanos) / 1000000;
                    const endTime = parseInt(point.endTimeNanos) / 1000000;
                    daySleep += (endTime - startTime) / (1000 * 60);
                  }
                }
              }
            }
          }
        }
        
        if (dayPoints > 0) {
          dailyData.push({
            date: date,
            points: dayPoints,
            sleepMinutes: Math.round(daySleep)
          });
        }
        
        totalSleepMinutes += daySleep;
      }
    }
    
    console.log(`✅ ${testName}: ${totalPoints} points, ${Math.round(totalSleepMinutes)} total sleep minutes`);
    
    debugResults.tests.push({
      test: testName,
      success: totalPoints > 0,
      dataSourceId: dataSourceId,
      dataTypeName: dataTypeName,
      totalPoints: totalPoints,
      totalSleepMinutes: Math.round(totalSleepMinutes),
      dailyBreakdown: dailyData,
      rawResponse: response.data.bucket?.length > 0 ? response.data.bucket[0] : null
    });
    
  } catch (error) {
    console.error(`❌ ${testName} failed:`, error.message);
    debugResults.tests.push({
      test: testName,
      success: false,
      dataSourceId: dataSourceId,
      error: error.message
    });
  }
}

// Add this new function to handle the HealthSync sleep data sources
async function fetchHealthSyncSleepData(start, end) {
  console.log('🛏️ Fetching sleep data from HealthSync sources...');
  
  try {
    // Get all available sleep data sources (we saw 13 HealthSync sources in your investigation)
    const sourcesResponse = await fitness.users.dataSources.list({ userId: 'me' });
    const sleepSources = sourcesResponse.data.dataSource?.filter(source => 
      source.dataStreamId?.includes('healthsync') && 
      source.dataType?.name === 'com.google.sleep.segment'
    ) || [];
    
    console.log(`📊 Found ${sleepSources.length} HealthSync sleep sources`);
    
    const allSleepData = [];
    
    // Fetch data from each HealthSync source
    for (const source of sleepSources) {
      try {
        console.log(`🔄 Fetching from: ${source.dataStreamId}`);
        
        const datasetId = `${start.getTime()}000000-${end.getTime()}000000`;
        const response = await fitness.users.dataSources.datasets.get({
          userId: 'me',
          dataSourceId: source.dataStreamId,
          datasetId: datasetId
        });
        
        if (response.data.point && response.data.point.length > 0) {
          console.log(`✅ Found ${response.data.point.length} sleep points from ${source.dataStreamId}`);
          allSleepData.push(...response.data.point);
        }
        
      } catch (error) {
        console.warn(`⚠️ Failed to fetch from ${source.dataStreamId}:`, error.message);
      }
    }
    
    console.log(`📊 Total sleep points collected: ${allSleepData.length}`);
    
    // Process the sleep data into daily format
    return processSleepDataPoints(allSleepData);
    
  } catch (error) {
    console.error('❌ HealthSync sleep data fetch failed:', error);
    return [];
  }
}

function processSleepDataPoints(sleepPoints) {
  console.log('🔄 Processing sleep data points...');
  
  const dailySleepMap = new Map();
  
  for (const point of sleepPoints) {
    try {
      const startTime = new Date(parseInt(point.startTimeNanos) / 1000000);
      const endTime = new Date(parseInt(point.endTimeNanos) / 1000000);
      const date = startTime.toISOString().split('T')[0];
      
      const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
      const sleepType = point.value?.[0]?.intVal || 0;
      
      // Initialize daily data if not exists
      if (!dailySleepMap.has(date)) {
        dailySleepMap.set(date, {
          date: date,
          totalSleep: 0,
          deepSleep: 0,
          lightSleep: 0,
          remSleep: 0,
          awakeTime: 0,
          segments: []
        });
      }
      
      const dayData = dailySleepMap.get(date);
      
      // Sleep segment types (based on Google Fit documentation):
      // 1 = Awake, 2 = Sleep (light), 3 = Out-of-bed, 4 = Light sleep, 5 = Deep sleep, 6 = REM sleep
      switch (sleepType) {
        case 1: // Awake
          dayData.awakeTime += durationMinutes;
          break;
        case 2: // Sleep (general)
        case 4: // Light sleep
          dayData.lightSleep += durationMinutes;
          dayData.totalSleep += durationMinutes;
          break;
        case 5: // Deep sleep
          dayData.deepSleep += durationMinutes;
          dayData.totalSleep += durationMinutes;
          break;
        case 6: // REM sleep
          dayData.remSleep += durationMinutes;
          dayData.totalSleep += durationMinutes;
          break;
        default:
          // If unknown type, assume it's sleep
          dayData.lightSleep += durationMinutes;
          dayData.totalSleep += durationMinutes;
      }
      
      dayData.segments.push({
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        type: sleepType,
        duration: durationMinutes
      });
      
    } catch (error) {
      console.warn('⚠️ Error processing sleep point:', error);
    }
  }
  
  // Convert to array and calculate sleep efficiency
  const processedData = [];
  for (const [date, dayData] of dailySleepMap) {
    if (dayData.totalSleep > 0) {
      const efficiency = dayData.totalSleep > 0 ? 
        Math.round((dayData.totalSleep / (dayData.totalSleep + dayData.awakeTime)) * 100) : 0;
      
      processedData.push({
        date: date,
        value: Math.round(dayData.totalSleep), // Total sleep in minutes
        deep_sleep: Math.round(dayData.deepSleep),
        light_sleep: Math.round(dayData.lightSleep),
        rem_sleep: Math.round(dayData.remSleep),
        awake_time: Math.round(dayData.awakeTime),
        efficiency: Math.min(100, Math.max(0, efficiency)),
        dataType: 'sleep'
      });
      
      console.log(`📊 ${date}: ${Math.round(dayData.totalSleep)}min total (Deep: ${Math.round(dayData.deepSleep)}, Light: ${Math.round(dayData.lightSleep)}, REM: ${Math.round(dayData.remSleep)}, Efficiency: ${efficiency}%)`);
    }
  }
  
  return processedData.sort((a, b) => a.date.localeCompare(b.date));
}



module.exports = router;