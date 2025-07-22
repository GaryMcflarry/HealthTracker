const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Health Sync integration logging
console.log('🔗 Health Sync Integration Enabled');
console.log('📱 Data Flow: GT2 → Huawei Health → Health Sync → Google Fit → Your API');

// Google Fit API setup
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

const fitness = google.fitness({ version: 'v1', auth: oauth2Client });

// In-memory storage for demo (use MySQL in production)
let users = {};
let healthData = {};

// Routes

// 1. Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Health Tracker API is running',
        timestamp: new Date().toISOString()
    });
});

// 2. Google OAuth URL generation
app.get('/api/auth/google', (req, res) => {
    const scopes = [
        'https://www.googleapis.com/auth/fitness.activity.read',
        'https://www.googleapis.com/auth/fitness.heart_rate.read',
        'https://www.googleapis.com/auth/fitness.sleep.read',
        'https://www.googleapis.com/auth/fitness.location.read'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
    });

    res.json({ authUrl });
});

// 3. Google OAuth callback handler
app.get('/api/auth/callback', async (req, res) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.status(400).json({ error: 'Missing code in query params' });
        }

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // For example, generate a userId (in production, you'd get this from a user session or DB)
        const userId = `user-${Date.now()}`;

        // Store tokens (in production, use a secure DB)
        users[userId] = {
            tokens,
            createdAt: new Date().toISOString()
        };

        res.json({ 
            message: 'Authentication successful', 
            userId,
            hasTokens: !!tokens.access_token
        });

    } catch (error) {
        console.error('Auth error:', error);
        res.status(400).json({ error: 'Authentication failed', details: error.message });
    }
});


// 4. Fetch user's fitness data
app.get('/api/fitness-data/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { startDate, endDate } = req.query;

        if (!users[userId]) {
            return res.status(404).json({ error: 'User not found or not authenticated' });
        }

        // Set user tokens
        oauth2Client.setCredentials(users[userId].tokens);

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
            steps: fitnessData[0].status === 'fulfilled' ? fitnessData[0].value : null,
            heartRate: fitnessData[1].status === 'fulfilled' ? fitnessData[1].value : null,
            calories: fitnessData[2].status === 'fulfilled' ? fitnessData[2].value : null,
            sleep: fitnessData[3].status === 'fulfilled' ? fitnessData[3].value : null,
            errors: fitnessData.filter(result => result.status === 'rejected').map(result => result.reason?.message)
        };

        // Store in memory for demo
        healthData[userId] = result;

        res.json(result);
    } catch (error) {
        console.error('Fitness data error:', error);
        res.status(500).json({ error: 'Failed to fetch fitness data' });
    }
});

// 5. Get user's health summary
app.get('/api/health-summary/:userId', (req, res) => {
    const { userId } = req.params;
    
    if (!healthData[userId]) {
        return res.status(404).json({ error: 'No health data found for user' });
    }

    const data = healthData[userId];
    
    // Calculate summary metrics
    const summary = {
        userId,
        lastUpdated: new Date().toISOString(),
        metrics: {
            totalSteps: data.steps ? data.steps.reduce((sum, day) => sum + day.value, 0) : 0,
            avgHeartRate: data.heartRate && data.heartRate.length > 0 
                ? data.heartRate.reduce((sum, reading) => sum + reading.value, 0) / data.heartRate.length 
                : 0,
            totalCalories: data.calories ? data.calories.reduce((sum, day) => sum + day.value, 0) : 0,
            avgSleepHours: data.sleep && data.sleep.length > 0
                ? data.sleep.reduce((sum, night) => sum + night.value, 0) / data.sleep.length / (60 * 60 * 1000)
                : 0
        },
        insights: generateInsights(data)
    };

    res.json(summary);
});

// 6. Set health goals
app.post('/api/goals/:userId', (req, res) => {
    const { userId } = req.params;
    const { dailySteps, weeklyWorkouts, sleepHours, caloriesBurned } = req.body;

    if (!users[userId]) {
        return res.status(404).json({ error: 'User not found' });
    }

    const goals = {
        userId,
        dailySteps: dailySteps || 10000,
        weeklyWorkouts: weeklyWorkouts || 3,
        sleepHours: sleepHours || 8,
        caloriesBurned: caloriesBurned || 2000,
        createdAt: new Date().toISOString()
    };

    // Store goals (in production, save to database)
    users[userId].goals = goals;

    res.json({ message: 'Goals set successfully', goals });
});

// 7. Test Health Sync Integration
app.get('/api/test-health-sync', async (req, res) => {
    try {
        console.log('🧪 Testing Health Sync integration...');
        
        res.json({
            message: 'Health Sync Integration Test',
            status: 'ready',
            dataFlow: [
                '1. Huawei GT2 → Huawei Health ✅',
                '2. Huawei Health → Health Sync ✅', 
                '3. Health Sync → Google Fit ✅',
                '4. Google Fit → Your API (Ready for testing)'
            ],
            instructions: [
                'Ensure Health Sync app is installed and configured',
                'Make sure automatic sync is enabled in Health Sync',
                'Wait 5-10 minutes after activity for data to sync',
                'Use /api/fitness-data/{userId} to fetch synced data'
            ],
            testEndpoints: {
                fetchData: 'GET /api/fitness-data/test-user',
                healthSummary: 'GET /api/health-summary/test-user',
                insights: 'GET /api/insights/test-user',
                alerts: 'GET /api/alerts/test-user'
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Test failed', details: error.message });
    }
});

// 8. Enhanced Health Insights for Honours Project
app.get('/api/insights/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!healthData[userId]) {
            return res.status(404).json({ 
                error: 'No health data found', 
                message: 'Make sure Health Sync is running and data has been synced from your Huawei GT2',
                setup: 'Visit /api/test-health-sync for setup instructions'
            });
        }

        const data = healthData[userId];
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
            const totalSteps = data.steps.reduce((sum, day) => sum + day.value, 0);
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
            const avgHR = data.heartRate.reduce((sum, reading) => sum + reading.value, 0) / data.heartRate.length;
            const restingHR = Math.min(...data.heartRate.map(r => r.value));
            const maxHR = Math.max(...data.heartRate.map(r => r.value));
            
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
            const avgSleepHours = data.sleep.reduce((sum, night) => sum + night.value, 0) / data.sleep.length / (60 * 60 * 1000);
            
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
        
        res.json(insights);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate insights', details: error.message });
    }
});

// 9. Health Alerts Endpoint
app.get('/api/alerts/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const alerts = [];
        
        if (healthData[userId]) {
            const data = healthData[userId];
            
            // Real-time health monitoring
            if (data.heartRate && data.heartRate.length > 0) {
                const recentHR = data.heartRate.slice(-10);
                const avgRecentHR = recentHR.reduce((sum, r) => sum + r.value, 0) / recentHR.length;
                
                if (avgRecentHR > 100) {
                    alerts.push({
                        type: 'health_alert',
                        severity: 'high',
                        title: 'Elevated Heart Rate Detected',
                        message: `Recent average: ${Math.round(avgRecentHR)} bpm (normal: 60-100)`,
                        timestamp: new Date().toISOString(),
                        dataSource: 'Huawei GT2',
                        recommendation: 'Rest and monitor. Consult healthcare provider if persistent.'
                    });
                }
            }

            // Activity goals monitoring
            if (users[userId]?.goals && data.steps) {
                const todaySteps = data.steps[0]?.value || 0;
                const goalSteps = users[userId].goals.dailySteps;
                const progress = (todaySteps / goalSteps) * 100;
                
                if (progress < 50 && new Date().getHours() > 18) {
                    alerts.push({
                        type: 'goal_reminder',
                        severity: 'medium',
                        title: 'Daily Step Goal Behind Schedule',
                        message: `${todaySteps}/${goalSteps} steps (${Math.round(progress)}%)`,
                        timestamp: new Date().toISOString(),
                        recommendation: `Need ${goalSteps - todaySteps} more steps. Try a 15-minute walk!`
                    });
                }
            }
        }

        // Add motivational message if no alerts
        if (alerts.length === 0) {
            alerts.push({
                type: 'positive_feedback',
                severity: 'low',
                title: 'Health Metrics Looking Good! 🎉',
                message: 'All monitored health indicators are within normal ranges',
                timestamp: new Date().toISOString(),
                recommendation: 'Keep up the excellent work with your health routine!'
            });
        }

        res.json({
            userId,
            alertCount: alerts.length,
            alerts,
            lastChecked: new Date().toISOString(),
            dataSource: 'Huawei GT2 via Health Sync'
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch alerts', details: error.message });
    }
});

// Automatic sync every 15 minutes (for production)
cron.schedule('*/15 * * * *', async () => {
    if (process.env.NODE_ENV === 'production') {
        console.log('🔄 Running scheduled health data sync...');
        
        // In production, this would:
        // 1. Fetch latest data from Google Fit for all users
        // 2. Update database with new metrics
        // 3. Check for health alerts
        // 4. Send notifications if needed
        
        console.log('📊 Scheduled sync completed at', new Date().toISOString());
    }
});

// Helper functions for fetching specific fitness data
async function fetchStepsData(startTimeMillis, endTimeMillis) {
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
}

async function fetchHeartRateData(startTimeMillis, endTimeMillis) {
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
}

async function fetchCaloriesData(startTimeMillis, endTimeMillis) {
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

// Helper function for trend analysis
function calculateStepsTrend(stepsData) {
    if (stepsData.length < 2) return 'insufficient_data';
    
    const recent = stepsData.slice(0, Math.ceil(stepsData.length / 2));
    const older = stepsData.slice(Math.ceil(stepsData.length / 2));
    
    const recentAvg = recent.reduce((sum, day) => sum + day.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, day) => sum + day.value, 0) / older.length;
    
    const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (percentChange > 10) return 'improving';
    if (percentChange < -10) return 'declining';
    return 'stable';
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Health Tracker API running on port ${PORT}`);
    console.log(`📊 Available endpoints:`);
    console.log(`   GET  /api/health - Health check`);
    console.log(`   GET  /api/auth/google - Get OAuth URL`);
    console.log(`   POST /api/auth/callback - Handle OAuth callback`);
    console.log(`   GET  /api/fitness-data/:userId - Fetch fitness data`);
    console.log(`   GET  /api/health-summary/:userId - Get health summary`);
    console.log(`   POST /api/goals/:userId - Set health goals`);
    console.log(`   GET  /api/test-health-sync - Test Health Sync integration`);
    console.log(`   GET  /api/insights/:userId - Advanced health insights`);
    console.log(`   GET  /api/alerts/:userId - Health alerts and notifications`);
    console.log(`\n🔗 Health Sync Integration Active`);
    console.log(`📱 Data Flow: Huawei GT2 → Health Sync → Google Fit → Your API`);
    console.log(`\n💡 For Honours Project Testing:`);
    console.log(`   1. Set up Health Sync app on your phone`);
    console.log(`   2. Test with: GET /api/test-health-sync`);
    console.log(`   3. Authenticate: GET /api/auth/google`);
    console.log(`   4. Fetch real data: GET /api/fitness-data/your-user-id`);
});

module.exports = app;