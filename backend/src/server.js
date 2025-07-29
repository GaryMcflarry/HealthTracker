const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { google } = require('googleapis');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Google Fit API setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const fitness = google.fitness({ version: 'v1', auth: oauth2Client });

// Health Sync integration logging
console.log('🔗 Health Sync Integration Enabled');
console.log('📱 Data Flow: GT2 → Huawei Health → Health Sync → Google Fit → Your API');

// Import routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const goalsRoutes = require('./routes/goals');
const stepsDataRoutes = require('./routes/stepsData');
const heartRateDataRoutes = require('./routes/heartRateData');
const sleepDataRoutes = require('./routes/sleepData');
const caloriesDataRoutes = require('./routes/caloriesData');
const notificationsRoutes = require('./routes/notifications');
const wearableRoutes = require('./routes/wearable'); // New wearable integration routes

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/steps', stepsDataRoutes);
app.use('/api/heartrate', heartRateDataRoutes);
app.use('/api/sleep', sleepDataRoutes);
app.use('/api/calories', caloriesDataRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/wearable', wearableRoutes); // Wearable integration routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Dashboard API endpoint (aggregated data)
app.get('/api/dashboard', require('./lib/auth').authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userID;
    const { period = 'daily' } = req.query;
    const { db } = require('./db');
    const { 
      stepsDataTable, 
      heartRateDataTable, 
      sleepDataTable, 
      caloriesDataTable,
      goalsTable 
    } = require('./db/schema');
    const { eq, and, gte, lte } = require('drizzle-orm');
    const { getDateRange } = require('./lib/utils');

    const { startDate, endDate } = getDateRange(period);

    // Fetch all data in parallel
    const [stepsData, heartRateData, sleepData, caloriesData, goals] = await Promise.all([
      db.select().from(stepsDataTable).where(and(
        eq(stepsDataTable.userID, userId),
        gte(stepsDataTable.date, startDate),
        lte(stepsDataTable.date, endDate)
      )),
      db.select().from(heartRateDataTable).where(and(
        eq(heartRateDataTable.userID, userId),
        gte(heartRateDataTable.date, startDate),
        lte(heartRateDataTable.date, endDate)
      )),
      db.select().from(sleepDataTable).where(and(
        eq(sleepDataTable.userID, userId),
        gte(sleepDataTable.date, startDate),
        lte(sleepDataTable.date, endDate)
      )),
      db.select().from(caloriesDataTable).where(and(
        eq(caloriesDataTable.userID, userId),
        gte(caloriesDataTable.date, startDate),
        lte(caloriesDataTable.date, endDate)
      )),
      db.select().from(goalsTable).where(eq(goalsTable.userID, userId))
    ]);

    // Calculate summaries
    const totalSteps = stepsData.reduce((sum, entry) => sum + (entry.steps_count || 0), 0);
    const totalCalories = caloriesData.reduce((sum, entry) => sum + (entry.calories || 0), 0);
    const averageHeartRate = heartRateData.length > 0 
      ? Math.round(heartRateData.reduce((sum, entry) => sum + entry.heartRateBpm, 0) / heartRateData.length)
      : 0;
    const averageSleep = sleepData.length > 0
      ? Math.round((sleepData.reduce((sum, entry) => sum + entry.sleepDuration, 0) / sleepData.length) * 100) / 100
      : 0;

    // Calculate goal progress
    const goalProgress = goals.map(goal => ({
      ...goal,
      progressPercentage: goal.targetValue > 0 ? Math.min(Math.round((goal.currentValue / goal.targetValue) * 100), 100) : 0
    }));

    res.json({
      message: 'Successfully fetched dashboard data',
      data: {
        period,
        summary: {
          totalSteps,
          totalCalories,
          averageHeartRate,
          averageSleep
        },
        goals: goalProgress,
        chartData: {
          steps: stepsData,
          heartRate: heartRateData,
          sleep: sleepData,
          calories: caloriesData
        }
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Serve the main HTML file for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Automatic sync every 15 minutes (for production)
cron.schedule('*/15 * * * *', async () => {
  if (process.env.NODE_ENV === 'production' && process.env.HEALTH_SYNC_ENABLED === 'true') {
    console.log('🔄 Running scheduled health data sync...');
    
    try {
      // In production, this would:
      // 1. Fetch latest data from Google Fit for all users
      // 2. Update database with new metrics
      // 3. Check for health alerts
      // 4. Send notifications if needed
      
      console.log('📊 Scheduled sync completed at', new Date().toISOString());
    } catch (error) {
      console.error('Scheduled sync error:', error);
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Health Tracker server running on port ${PORT}`);
  console.log(`📊 Dashboard available at http://localhost:${PORT}`);
  console.log(`🔗 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`📱 Google Fit Integration: ${process.env.HEALTH_SYNC_ENABLED === 'true' ? 'ENABLED' : 'DISABLED'}`);
  if (process.env.HEALTH_SYNC_ENABLED === 'true') {
    console.log(`   📋 Available wearable endpoints:`);
    console.log(`      GET  /api/wearable/auth/google - Get OAuth URL`);
    console.log(`      GET  /api/wearable/auth/callback - Handle OAuth callback`);
    console.log(`      GET  /api/wearable/fitness-data - Fetch fitness data`);
    console.log(`      GET  /api/wearable/health-summary - Get health summary`);
    console.log(`      GET  /api/wearable/insights - Advanced health insights`);
    console.log(`      GET  /api/wearable/test-sync - Test Health Sync integration`);
  }
});