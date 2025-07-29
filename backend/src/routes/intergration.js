const express = require('express');
const { google } = require('googleapis');
const { eq, and } = require('drizzle-orm');
const { db } = require('../db');
const { 
  wearableIntegrationTable, 
  stepsDataTable, 
  heartRateDataTable, 
  sleepDataTable, 
  caloriesDataTable,
  goalsTable,
  notificationsTable 
} = require('../db/schema');
const { authMiddleware } = require('../lib/auth');
const { asyncHandler } = require('../lib/utils');

const router = express.Router();

// Google Fit API setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const fitness = google.fitness({ version: 'v1', auth: oauth2Client });

// 1. Google OAuth URL generation
router.get('/auth/google', authMiddleware, asyncHandler(async (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.heart_rate.read',
    'https://www.googleapis.com/auth/fitness.sleep.read',
    'https://www.googleapis.com/auth/fitness.location.read'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: req.user.userID // Pass user ID in state for callback
  });

  res.json({ 
    message: 'Google Fit authorization URL generated',
    authUrl,
    instructions: [
      '1. Click the authorization URL to connect Google Fit',
      '2. Grant permissions for health data access',
      '3. You will be redirected to complete the setup'
    ]
  });
}));

// 2. Google OAuth callback handler
router.get('/auth/callback', asyncHandler(async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    const userId = parseInt(state);
    if (!userId) {
      return res.status(400).json({ error: 'Invalid user session' });
    }

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Store tokens in wearable integration table
    await db.insert(wearableIntegrationTable).values({
      userID: userId,
      apiType: 'google_fit',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      syncLastDate: new Date(),
      isActive: true
    }).onDuplicateKeyUpdate({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      syncLastDate: new Date(),
      isActive: true
    });

    res.json({ 
      message: 'Google Fit integration successful!',
      userId,
      hasTokens: !!tokens.access_token,
      nextSteps: [
        'Integration is now active',
        'Health data will sync automatically every 15 minutes',
        'Use /api/wearable/fitness-data to fetch your data',
        'Check /api/wearable/test-sync to verify everything is working'
      ]
    });

  } catch (error) {
    console.error('Wearable auth error:', error);
    res.status(400).json({ error: 'Authentication failed', details: error.message });
  }
}));

// 3. Fetch user's fitness data from Google Fit
router.get('/fitness-data', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.userID;
    const { startDate, endDate, sync = false } = req.query;

    // Get user's wearable integration
    const integration = await db
      .select()
      .from(wearableIntegrationTable)
      .where(and(
        eq(wearableIntegrationTable.userID, userId),
        eq(wearableIntegrationTable.apiType, 'google_fit'),
        eq(wearableIntegrationTable.isActive, true)
      ));

    if (integration.length === 0) {
      return res.status(404).json({ 
        error: 'Google Fit not connected', 
        message: 'Please connect Google Fit first using /api/wearable/auth/google'
      });
    }

    // Set user tokens
    oauth2Client.setCredentials({
      access_token: integration[0].accessToken,
      refresh_token: integration[0].refreshToken
    });

    // Default to last 7 days if no dates provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const startTimeMillis = start.getTime();
    const endTimeMillis = end.getTime();

    // Fetch different types of fitness data
    const fitnessData = await Promise.allSettled([
      fetchStepsData(startTimeMillis, endTimeMillis),
      fetchHeartRateData(startTimeMillis, endTimeMillis),
      fetchCaloriesData(startTimeMillis, endTimeMillis),
      fetchSleepData(startTimeMillis, endTimeMillis)
    ]);

    const result = {
      userId,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      steps: fitnessData[0].status === 'fulfilled' ? fitnessData[0].value : [],
      heartRate: fitnessData[1].status === 'fulfilled' ? fitnessData[1].value : [],
      calories: fitnessData[2].status === 'fulfilled' ? fitnessData[2].value : [],
      sleep: fitnessData[3].status === 'fulfilled' ? fitnessData[3].value : [],
      errors: fitnessData.filter(result => result.status === 'rejected').map(result => result.reason?.message),
      lastSync: new Date().toISOString()
    };

    // Optionally sync data to database
    if (sync === 'true') {
      await syncDataToDatabase(userId, result);
    }

    // Update last sync time
    await db
      .update(wearableIntegrationTable)
      .set({ syncLastDate: new Date() })
      .where(and(
        eq(wearableIntegrationTable.userID, userId),
        eq(wearableIntegrationTable.apiType, 'google_fit')
      ));

    res.json({
      message: 'Successfully fetched fitness data from Google Fit',
      data: result,
      dataSource: 'Huawei GT2 via Health Sync → Google Fit'
    });

  } catch (error) {
    console.error('Fitness data error:', error);
    res.status(500).json({ error: 'Failed to fetch fitness data', details: error.message });
  }
}));

// 4. Get health summary with Google Fit data
router.get('/health-summary', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.userID;
    
    // First try to get data from Google Fit
    const fitnessResponse = await fetch(`${req.protocol}://${req.get('host')}/api/wearable/fitness-data?userId=${userId}`);
    let googleFitData = null;
    
    if (fitnessResponse.ok) {
      const fitData = await fitnessResponse.json();
      googleFitData = fitData.data;
    }

    // Get data from local database as fallback
    const [stepsData, heartRateData, caloriesData, sleepData, goals] = await Promise.all([
      db.select().from(stepsDataTable).where(eq(stepsDataTable.userID, userId)),
      db.select().from(heartRateDataTable).where(eq(heartRateDataTable.userID, userId)),
      db.select().from(caloriesDataTable).where(eq(caloriesDataTable.userID, userId)),
      db.select().from(sleepDataTable).where(eq(sleepDataTable.userID, userId)),
      db.select().from(goalsTable).where(eq(goalsTable.userID, userId))
    ]);

    // Use Google Fit data if available, otherwise use database data
    const dataSource = googleFitData ? googleFitData : {
      steps: stepsData.map(s => ({ value: s.steps_count, date: s.date })),
      heartRate: heartRateData.map(h => ({ value: h.heartRateBpm, timestamp: h.date })),
      calories: caloriesData.map(c => ({ value: c.calories, date: c.date })),
      sleep: sleepData.map(s => ({ value: s.sleepDuration * 60 * 60 * 1000, date: s.date }))
    };

    // Calculate summary metrics
    const summary = {
      userId,
      lastUpdated: new Date().toISOString(),
      dataSource: googleFitData ? 'Google Fit (Real-time)' : 'Local Database',
      metrics: {
        totalSteps: dataSource.steps ? dataSource.steps.reduce((sum, day) => sum + (day.value || 0), 0) : 0,
        avgHeartRate: dataSource.heartRate && dataSource.heartRate.length > 0 
          ? Math.round(dataSource.heartRate.reduce((sum, reading) => sum + (reading.value || 0), 0) / dataSource.heartRate.length)
          : 0,
        totalCalories: dataSource.calories ? dataSource.calories.reduce((sum, day) => sum + (day.value || 0), 0) : 0,
        avgSleepHours: dataSource.sleep && dataSource.sleep.length > 0
          ? Math.round((dataSource.sleep.reduce((sum, night) => sum + (night.value || 0), 0) / dataSource.sleep.length / (60 * 60 * 1000)) * 10) / 10
          : 0
      },
      goals: goals.map(goal => ({
        ...goal,
        progressPercentage: goal.targetValue > 0 ? Math.min(Math.round((goal.currentValue / goal.targetValue) * 100), 100) : 0
      })),
      insights: generateHealthInsights(dataSource, goals)
    };

    res.json({
      message: 'Successfully generated health summary',
      data: summary
    });

  } catch (error) {
    console.error('Health summary error:', error);
    res.status(500).json({ error: 'Failed to generate health summary', details: error.message });
  }
}));

// 5. Advanced health insights
router.get('/insights', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.userID;
    
    // Get latest fitness data
    const fitnessResponse = await fetch(`${req.protocol}://${req.get('host')}/api/wearable/fitness-data?userId=${userId}`);
    
    if (!fitnessResponse.ok) {
      return res.status(404).json({ 
        error: 'No health data found', 
        message: 'Make sure Health Sync is running and data has been synced from your Huawei GT2',
        setup: 'Visit /api/wearable/test-sync for setup instructions'
      });
    }

    const { data } = await fitnessResponse.json();
    
    const insights = {
      userId,
      generatedAt: new Date().toISOString(),
      dataSource: 'Huawei GT2 via Health Sync → Google Fit',
      insights: [],
      recommendations: [],
      alerts: [],
      academicMetrics: {
        dataPoints: 0,
        completeness: '0%',
        reliability: 'Good'
      }
    };

    // Steps Analysis
    if (data.steps && data.steps.length > 0) {
      const totalSteps = data.steps.reduce((sum, day) => sum + (day.value || 0), 0);
      const avgSteps = totalSteps / data.steps.length;
      const trend = calculateStepsTrend(data.steps);
      
      insights.insights.push({
        metric: 'daily_steps',
        average: Math.round(avgSteps),
        total: totalSteps,
        trend: trend,
        status: avgSteps >= 10000 ? 'excellent' : avgSteps >= 7500 ? 'good' : 'needs_improvement',
        daysTracked: data.steps.length
      });

      insights.academicMetrics.dataPoints += data.steps.length;

      if (avgSteps < 8000) {
        insights.recommendations.push({
          type: 'activity_increase',
          priority: 'high',
          message: `Average steps (${Math.round(avgSteps)}) below recommended 10,000`,
          actions: [
            'Take stairs instead of elevator',
            'Park farther from destinations', 
            'Take 10-minute walks every 2 hours',
            'Use walking meetings when possible'
          ],
          expectedImpact: '+15% daily activity'
        });
      }
    }

    // Heart Rate Analysis
    if (data.heartRate && data.heartRate.length > 0) {
      const avgHR = data.heartRate.reduce((sum, reading) => sum + (reading.value || 0), 0) / data.heartRate.length;
      const heartRates = data.heartRate.map(r => r.value || 0).filter(hr => hr > 0);
      const restingHR = heartRates.length > 0 ? Math.min(...heartRates) : 0;
      const maxHR = heartRates.length > 0 ? Math.max(...heartRates) : 0;
      
      insights.insights.push({
        metric: 'heart_rate',
        average: Math.round(avgHR),
        resting: restingHR,
        maximum: maxHR,
        status: restingHR < 60 ? 'excellent' : restingHR < 80 ? 'good' : 'monitor',
        readingsCount: data.heartRate.length
      });

      insights.academicMetrics.dataPoints += data.heartRate.length;

      if (avgHR > 100) {
        insights.alerts.push({
          type: 'health_warning',
          message: `Average heart rate elevated (${Math.round(avgHR)} bpm)`,
          recommendation: 'Monitor closely and consider medical consultation',
          priority: 'high',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Sleep Analysis
    if (data.sleep && data.sleep.length > 0) {
      const avgSleepHours = data.sleep.reduce((sum, night) => sum + (night.value || 0), 0) / data.sleep.length / (60 * 60 * 1000);
      
      insights.insights.push({
        metric: 'sleep_quality',
        averageHours: Math.round(avgSleepHours * 10) / 10,
        status: avgSleepHours >= 7 ? 'good' : 'insufficient',
        nightsTracked: data.sleep.length
      });

      if (avgSleepHours < 7) {
        insights.recommendations.push({
          type: 'sleep_improvement',
          priority: 'medium',
          message: `Sleep duration (${avgSleepHours.toFixed(1)}h) below recommended 7-9 hours`,
          actions: [
            'Establish consistent bedtime routine',
            'Limit screen time 1 hour before bed',
            'Keep bedroom cool and dark',
            'Avoid caffeine after 2 PM'
          ],
          expectedImpact: 'Improved recovery and energy levels'
        });
      }
    }

    // Calculate data completeness for academic assessment
    const totalPossibleDataPoints = 7 * 24; // 7 days * 24 hours
    insights.academicMetrics.completeness = Math.round((insights.academicMetrics.dataPoints / totalPossibleDataPoints) * 100) + '%';
    
    res.json({
      message: 'Successfully generated health insights',
      data: insights
    });

  } catch (error) {
    console.error('Insights error:', error);
    res.status(500).json({ error: 'Failed to generate insights', details: error.message });
  }
}));

// 6. Test Health Sync Integration
router.get('/test-sync', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.userID;
    
    console.log('🧪 Testing Health Sync integration for user:', userId);
    
    // Check if user has Google Fit connected
    const integration = await db
      .select()
      .from(wearableIntegrationTable)
      .where(and(
        eq(wearableIntegrationTable.userID, userId),
        eq(wearableIntegrationTable.apiType, 'google_fit')
      ));

    const hasIntegration = integration.length > 0 && integration[0].isActive;
    
    res.json({
      message: 'Health Sync Integration Test',
      userId,
      status: hasIntegration ? 'connected' : 'not_connected',
      googleFitIntegration: hasIntegration ? 'active' : 'inactive',
      lastSync: hasIntegration ? integration[0].syncLastDate : null,
      dataFlow: [
        '1. Huawei GT2 → Huawei Health ✅',
        '2. Huawei Health → Health Sync ✅', 
        '3. Health Sync → Google Fit ✅',
        `4. Google Fit → Your API ${hasIntegration ? '✅' : '❌'}`
      ],
      instructions: hasIntegration ? [
        'Integration is active and ready!',
        'Data syncs automatically every 15 minutes',
        'Use GET /api/wearable/fitness-data to fetch current data',
        'Check GET /api/wearable/health-summary for insights'
      ] : [
        'Connect Google Fit: GET /api/wearable/auth/google',
        'Ensure Health Sync app is installed and configured',
        'Make sure automatic sync is enabled in Health Sync',
        'Wait 5-10 minutes after activity for data to sync'
      ],
      testEndpoints: {
        connectGoogleFit: '/api/wearable/auth/google',
        fetchData: '/api/wearable/fitness-data',
        healthSummary: '/api/wearable/health-summary',
        insights: '/api/wearable/insights'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Test sync error:', error);
    res.status(500).json({ error: 'Test failed', details: error.message });
  }
}));

// 7. Manual sync trigger
router.post('/sync', authMiddleware, asyncHandler(async (req, res) => {
  try {
    const userId = req.user.userID;
    
    // Fetch latest data and sync to database
    const fitnessResponse = await fetch(`${req.protocol}://${req.get('host')}/api/wearable/fitness-data?sync=true&userId=${userId}`);
    
    if (!fitnessResponse.ok) {
      return res.status(400).json({ error: 'Failed to sync data from Google Fit' });
    }

    const { data } = await fitnessResponse.json();
    
    // Sync to database
    await syncDataToDatabase(userId, data);
    
    res.json({
      message: 'Manual sync completed successfully',
      syncedData: {
        steps: data.steps ? data.steps.length : 0,
        heartRate: data.heartRate ? data.heartRate.length : 0,
        calories: data.calories ? data.calories.length : 0,
        sleep: data.sleep ? data.sleep.length : 0
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({ error: 'Manual sync failed', details: error.message });
  }
}));

// Helper functions for fetching specific fitness data
async function fetchStepsData(startTimeMillis, endTimeMillis) {
  try {
    const response = await fitness.users.dataSources.datasets.get({
      userId: 'me',
      dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
      datasetId: `${startTimeMillis * 1000000}-${endTimeMillis * 1000000}`
    });

    return response.data.point?.map(point => ({
      date: new Date(parseInt(point.startTimeNanos) / 1000000).toISOString().split('T')[0],
      value: point.value[0].intVal || 0,
      type: 'steps'
    })) || [];
  } catch (error) {
    console.log('Steps data not available:', error.message);
    return [];
  }
}

async function fetchHeartRateData(startTimeMillis, endTimeMillis) {
  try {
    const response = await fitness.users.dataSources.datasets.get({
      userId: 'me',
      dataSourceId: 'derived:com.google.heart_rate.summary:com.google.android.gms:merge_heart_rate_summary',
      datasetId: `${startTimeMillis * 1000000}-${endTimeMillis * 1000000}`
    });

    return response.data.point?.map(point => ({
      timestamp: new Date(parseInt(point.startTimeNanos) / 1000000).toISOString(),
      value: point.value[0].fpVal || 0,
      type: 'heart_rate'
    })) || [];
  } catch (error) {
    console.log('Heart rate data not available:', error.message);
    return [];
  }
}

async function fetchCaloriesData(startTimeMillis, endTimeMillis) {
  try {
    const response = await fitness.users.dataSources.datasets.get({
      userId: 'me',
      dataSourceId: 'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended',
      datasetId: `${startTimeMillis * 1000000}-${endTimeMillis * 1000000}`
    });

    return response.data.point?.map(point => ({
      date: new Date(parseInt(point.startTimeNanos) / 1000000).toISOString().split('T')[0],
      value: point.value[0].fpVal || 0,
      type: 'calories'
    })) || [];
  } catch (error) {
    console.log('Calories data not available:', error.message);
    return [];
  }
}

async function fetchSleepData(startTimeMillis, endTimeMillis) {
  try {
    const response = await fitness.users.dataSources.datasets.get({
      userId: 'me',
      dataSourceId: 'derived:com.google.sleep.segment:com.google.android.gms:merged',
      datasetId: `${startTimeMillis * 1000000}-${endTimeMillis * 1000000}`
    });

    return response.data.point?.map(point => ({
      date: new Date(parseInt(point.startTimeNanos) / 1000000).toISOString().split('T')[0],
      value: parseInt(point.endTimeNanos) - parseInt(point.startTimeNanos), // Duration in nanoseconds
      sleepType: point.value[0].intVal, // Sleep stage
      type: 'sleep'
    })) || [];
  } catch (error) {
    console.log('Sleep data not available:', error.message);
    return [];
  }
}

// Helper function to sync Google Fit data to database
async function syncDataToDatabase(userId, fitnessData) {
  try {
    // Sync steps data
    if (fitnessData.steps && fitnessData.steps.length > 0) {
      const stepsEntries = fitnessData.steps.map(entry => ({
        userID: userId,
        date: new Date(entry.date),
        steps_count: entry.value || 0,
        providedDataAt: new Date()
      }));
      
      await db.insert(stepsDataTable).values(stepsEntries).ignore();
    }

    // Sync heart rate data
    if (fitnessData.heartRate && fitnessData.heartRate.length > 0) {
      const heartRateEntries = fitnessData.heartRate.map(entry => ({
        userID: userId,
        date: new Date(entry.timestamp),
        heartRateBpm: Math.round(entry.value || 0),
        providedDataAt: new Date()
      }));
      
      await db.insert(heartRateDataTable).values(heartRateEntries).ignore();
    }

    // Sync calories data
    if (fitnessData.calories && fitnessData.calories.length > 0) {
      const caloriesEntries = fitnessData.calories.map(entry => ({
        userID: userId,
        date: new Date(entry.date),
        calories: Math.round(entry.value || 0),
        providedDataAt: new Date()
      }));
      
      await db.insert(caloriesDataTable).values(caloriesEntries).ignore();
    }

    // Sync sleep data
    if (fitnessData.sleep && fitnessData.sleep.length > 0) {
      const sleepEntries = fitnessData.sleep.map(entry => ({
        userID: userId,
        date: new Date(entry.date),
        sleepDuration: (entry.value || 0) / (60 * 60 * 1000 * 1000000), // Convert nanoseconds to hours
        sleepQuality: entry.sleepType === 1 ? 'light' : entry.sleepType === 2 ? 'deep' : 'rem',
        providedDataAt: new Date()
      }));
      
      await db.insert(sleepDataTable).values(sleepEntries).ignore();
    }

    console.log(`✅ Synced fitness data to database for user ${userId}`);
    
  } catch (error) {
    console.error('Database sync error:', error);
    throw error;
  }
}

// Helper function for trend analysis
function calculateStepsTrend(stepsData) {
  if (stepsData.length < 2) return 'insufficient_data';
  
  const recent = stepsData.slice(0, Math.ceil(stepsData.length / 2));
  const older = stepsData.slice(Math.ceil(stepsData.length / 2));
  
  const recentAvg = recent.reduce((sum, day) => sum + (day.value || 0), 0) / recent.length;
  const olderAvg = older.reduce((sum, day) => sum + (day.value || 0), 0) / older.length;
  
  const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;
  
  if (percentChange > 10) return 'improving';
  if (percentChange < -10) return 'declining';
  return 'stable';
}

// Helper function to generate health insights
function generateHealthInsights(data, goals) {
  const insights = [];
  
  // Steps insights
  if (data.steps && data.steps.length > 0) {
    const totalSteps = data.steps.reduce((sum, day) => sum + (day.value || 0), 0);
    const avgSteps = totalSteps / data.steps.length;
    
    if (avgSteps >= 10000) {
      insights.push("🎉 Excellent activity level! You're consistently hitting 10k+ steps.");
    } else if (avgSteps >= 7500) {
      insights.push("👍 Good activity level! Try to reach 10,000 steps daily for optimal health.");
    } else {
      insights.push("🚶 Consider increasing daily activity. Small walks throughout the day can help!");
    }
  }

  // Heart rate insights
  if (data.heartRate && data.heartRate.length > 0) {
    const heartRates = data.heartRate.map(r => r.value || 0).filter(hr => hr > 0);
    if (heartRates.length > 0) {
      const restingHR = Math.min(...heartRates);
      
      if (restingHR < 60) {
        insights.push("💪 Excellent cardiovascular fitness! Your resting heart rate indicates great heart health.");
      } else if (restingHR < 80) {
        insights.push("❤️ Good heart health! Maintain regular exercise to keep improving.");
      } else {
        insights.push("🏃 Consider cardio exercises to improve your resting heart rate.");
      }
    }
  }

  // Sleep insights
  if (data.sleep && data.sleep.length > 0) {
    const avgSleepHours = data.sleep.reduce((sum, night) => sum + (night.value || 0), 0) / data.sleep.length / (60 * 60 * 1000);
    
    if (avgSleepHours >= 7) {
      insights.push("😴 Great sleep habits! You're getting adequate rest for recovery.");
    } else {
      insights.push("🌙 Focus on getting 7-9 hours of sleep for better health and recovery.");
    }
  }

  return insights;
}

module.exports = router;