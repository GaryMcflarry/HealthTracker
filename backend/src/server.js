const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { google } = require('googleapis');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const fitness = google.fitness({ version: 'v1', auth: oauth2Client });

let authRoutes, usersRoutes, goalsRoutes, stepsDataRoutes, heartRateDataRoutes, 
    sleepDataRoutes, caloriesDataRoutes, notificationsRoutes, wearableRoutes;

try {
  authRoutes = require('./routes/auth');
  usersRoutes = require('./routes/users');
  goalsRoutes = require('./routes/goals');
  stepsDataRoutes = require('./routes/stepsData');
  heartRateDataRoutes = require('./routes/healthRateData');
  sleepDataRoutes = require('./routes/sleepData');
  caloriesDataRoutes = require('./routes/caloriesData');
  wearableRoutes = require('./routes/wearable');
  
  try {
    notificationsRoutes = require('./routes/notifications');
  } catch (notifError) {
    notificationsRoutes = express.Router();
    notificationsRoutes.get('/test', (req, res) => {
      res.json({ message: 'Notifications route fallback active' });
    });
  }
  
} catch (error) {
  process.exit(1);
}

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/steps', stepsDataRoutes);
app.use('/api/heartrate', heartRateDataRoutes);
app.use('/api/sleep', sleepDataRoutes);
app.use('/api/calories', caloriesDataRoutes);
app.use('/api/wearable', wearableRoutes);

if (notificationsRoutes && typeof notificationsRoutes === 'function') {
  app.use('/api/notifications', notificationsRoutes);
} else {
  app.use('/api/notifications', express.Router().get('/status', (req, res) => {
    res.json({ status: 'Notifications service unavailable' });
  }));
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      notifications: !!notificationsRoutes,
      wearable: !!wearableRoutes,
      auth: !!authRoutes
    }
  });
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
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

    const [stepsData, heartRateData, sleepData, caloriesData, goals] = await Promise.all([
      db.select().from(stepsDataTable).where(and(
        eq(stepsDataTable.user_id, parseInt(userId)),
        gte(stepsDataTable.date, startDate),
        lte(stepsDataTable.date, endDate)
      )),
      db.select().from(heartRateDataTable).where(and(
        eq(heartRateDataTable.user_id, parseInt(userId)),
        gte(heartRateDataTable.date, startDate),
        lte(heartRateDataTable.date, endDate)
      )),
      db.select().from(sleepDataTable).where(and(
        eq(sleepDataTable.user_id, parseInt(userId)),
        gte(sleepDataTable.date, startDate),
        lte(sleepDataTable.date, endDate)
      )),
      db.select().from(caloriesDataTable).where(and(
        eq(caloriesDataTable.user_id, parseInt(userId)),
        gte(caloriesDataTable.date, startDate),
        lte(caloriesDataTable.date, endDate)
      )),
      db.select().from(goalsTable).where(eq(goalsTable.user_id, parseInt(userId)))
    ]);

    const totalSteps = stepsData.reduce((sum, entry) => sum + (entry.steps_count || 0), 0);
    const totalCalories = caloriesData.reduce((sum, entry) => sum + (entry.calories || 0), 0);
    const averageHeartRate = heartRateData.length > 0 
      ? Math.round(heartRateData.reduce((sum, entry) => sum + entry.heart_rate_bpm, 0) / heartRateData.length)
      : 0;
    const averageSleep = sleepData.length > 0
      ? Math.round((sleepData.reduce((sum, entry) => sum + (entry.deep_sleep_minutes + entry.light_sleep_minutes + entry.rem_sleep_minutes), 0) / sleepData.length) * 100) / 100
      : 0;

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
    res.status(500).json({ error: 'Failed to fetch dashboard data', details: error.message });
  }
});

app.use((error, req, res, next) => {
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

cron.schedule('*/15 * * * *', async () => {
  if (process.env.NODE_ENV === 'production' && process.env.HEALTH_SYNC_ENABLED === 'true') {
    try {
      // Sync logic here
    } catch (error) {
      // Handle sync errors
    }
  }
});

app.listen(PORT, () => {
  // Server started
});

module.exports = app;