// dashboard.js - Enhanced with Health Alert Data Integration

// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// ========================================
// UTILITY FUNCTIONS
// ========================================

function getCurrentUserId() {
    const userData = localStorage.getItem('userData');
    if (userData) {
        try {
            const user = JSON.parse(userData);
            return user.userID;
        } catch (e) {
            console.error('Error parsing userData from localStorage:', e);
            return null;
        }
    }
    return null;
}

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

// ========================================
// HEALTH DATA EXTRACTION FOR ALERTS
// ========================================

function extractTodaysHealthData() {
    // Extract current values from the dashboard widgets
    const stepsElement = document.querySelector('.steps-widget .stat-number');
    const heartRateElement = document.querySelector('.heartrate-widget .stat-number'); 
    const caloriesElement = document.querySelector('.calorie-widget .stat-number');
    const sleepElement = document.querySelector('.sleep-widget .stat-number');
    
    const healthData = {
        steps: parseInt(stepsElement?.textContent.replace(/,/g, '') || '0'),
        heartRate: parseInt(heartRateElement?.textContent || '0'),
        calories: parseInt(caloriesElement?.textContent.replace(/,/g, '') || '0'),
        sleepHours: parseFloat(sleepElement?.textContent || '0'),
        timestamp: new Date().toISOString(),
        date: getTodayDate()
    };
    
    console.log('📊 Extracted health data for alerts:', healthData);
    return healthData;
}

// Store health data globally for alert checking
let currentHealthData = {
    steps: 0,
    heartRate: 0,
    calories: 0,
    sleepHours: 0,
    lastUpdated: null
};

function updateGlobalHealthData(data) {
    currentHealthData = {
        ...currentHealthData,
        ...data,
        lastUpdated: new Date().toISOString()
    };
    
    console.log('🔄 Global health data updated:', currentHealthData);
}

// ========================================
// HEALTH ALERT INTEGRATION
// ========================================

async function checkHealthAlerts(userId) {
  try {
    const healthData = {
      steps: parseInt(document.querySelector('.steps-widget .stat-number')?.textContent.replace(/,/g, '') || '0'),
      heartRate: parseInt(document.querySelector('.heartrate-widget .stat-number')?.textContent || '0'),
      calories: parseInt(document.querySelector('.calorie-widget .stat-number')?.textContent.replace(/,/g, '') || '0')
    };
    
    const response = await fetch(`/api/notifications/check-health-alerts/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ healthData })
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.alertsTriggered > 0) {
        console.log(`📧 ${result.alertsTriggered} health alerts sent!`);
      }
    }
  } catch (error) {
    console.error('Health alert check failed:', error);
  }
}

// Call this after dashboard loads
document.addEventListener('DOMContentLoaded', () => {
  const userId = getCurrentUserId();
  if (userId) {
    setTimeout(() => checkHealthAlerts(userId), 3000);
  }
});

function displayHealthAlertSummary(alerts) {
    const achievementAlerts = alerts.filter(a => a.category === 'achievement');
    const healthConcerns = alerts.filter(a => a.category === 'health_concern');
    const inactivityAlerts = alerts.filter(a => a.category === 'inactivity');
    
    // Show achievement notifications (positive)
    achievementAlerts.forEach(alert => {
        showSuccessToast(`🎉 ${alert.title}! Check your email for details.`);
    });
    
    // Show health concerns (important)
    healthConcerns.forEach(alert => {
        showWarningToast(`⚠️ ${alert.title}. Email sent with recommendations.`);
    });
    
    // Show inactivity alerts (encouraging)
    inactivityAlerts.forEach(alert => {
        showInfoToast(`💪 ${alert.title}. Check your email for tips!`);
    });
}

// ========================================
// AUTOMATIC HEALTH ALERT SCHEDULING
// ========================================

let healthAlertInterval = null;

function startHealthAlertMonitoring(userId, userData) {
    // Clear existing interval
    if (healthAlertInterval) {
        clearInterval(healthAlertInterval);
    }
    
    // Check health alerts every 15 minutes
    healthAlertInterval = setInterval(async () => {
        console.log('⏰ Scheduled health alert check...');
        await checkHealthAlerts(userId, userData, false);
    }, 15 * 60 * 1000); // 15 minutes
    
    console.log('✅ Health alert monitoring started (15-minute intervals)');
}

function stopHealthAlertMonitoring() {
    if (healthAlertInterval) {
        clearInterval(healthAlertInterval);
        healthAlertInterval = null;
        console.log('🛑 Health alert monitoring stopped');
    }
}

// ========================================
// ENHANCED FITNESS DATA MANAGEMENT
// ========================================

async function fetchTodaysFitnessData(userId) {
    const today = getTodayDate();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`📊 Fetching fitness data for user ${userId} from ${yesterday} to ${today}`);
    
    showWidgetLoading('.steps-widget', 'Syncing steps...');
    showWidgetLoading('.heartrate-widget', 'Reading heart rate...');
    showWidgetLoading('.calorie-widget', 'Calculating calories...');
    showWidgetLoading('.sleep-widget', 'Syncing sleep data...');

    try {
        const [stepsResponse, heartRateResponse, caloriesResponse, sleepResponse, goalsMap] = await Promise.all([
            fetch(`${API_BASE_URL}/wearable/fitness-data?dataType=steps&startDate=${yesterday}&endDate=${today}&userId=${userId}`),
            fetch(`${API_BASE_URL}/wearable/fitness-data?dataType=heartrate&startDate=${yesterday}&endDate=${today}&userId=${userId}`),
            fetch(`${API_BASE_URL}/wearable/fitness-data?dataType=calories&startDate=${yesterday}&endDate=${today}&userId=${userId}`),
            fetch(`${API_BASE_URL}/wearable/fitness-data?dataType=sleep&startDate=${yesterday}&endDate=${today}&userId=${userId}`),
            fetchUserGoalsWithProgress()
        ]);

        // Enhanced debugging for sleep response
        console.log('🌐 Sleep API Response Status:', `${sleepResponse.status} ${sleepResponse.statusText}`);
        
        const [stepsData, heartRateData, caloriesData, sleepData] = await Promise.all([
            handleApiResponse(stepsResponse, 'steps'),
            handleApiResponse(heartRateResponse, 'heartrate'),
            handleApiResponse(caloriesResponse, 'calories'),
            handleApiResponse(sleepResponse, 'sleep')
        ]);

        // Debug the sleep data structure
        console.log('😴 Raw Sleep Data from API:', {
            hasSleepData: !!sleepData,
            sleepDataCount: sleepData?.data?.length || 0,
            sleepDataStructure: sleepData ? Object.keys(sleepData) : 'null',
            firstSleepRecord: sleepData?.data?.[0] || 'none'
        });

        // Focus on today's data specifically
        const todaysData = {
            steps: getTodaysDataFromSet(stepsData, today),
            heartRate: getTodaysDataFromSet(heartRateData, today),
            calories: getTodaysDataFromSet(caloriesData, today),
            sleep: getTodaysDataFromSet(sleepData, today)
        };

        console.log('📅 Today\'s Processed Sleep Data:', {
            sleepToday: todaysData.sleep?.today?.value || 'No data',
            sleepRecent: todaysData.sleep?.recent?.length || 0,
            sleepFallback: todaysData.sleep?.isLatestFallback || false
        });

        // Update dashboard with data
        updateDashboardWithTodaysData(todaysData, goalsMap);
        
        // Update global health data for alert system
        const healthDataForAlerts = {
            steps: todaysData.steps?.today?.value || 0,
            heartRate: todaysData.heartRate?.today?.value || 0,
            calories: todaysData.calories?.today?.value || 0,
            sleepHours: todaysData.sleep?.today?.value ? (todaysData.sleep.today.value / 60).toFixed(1) : 0
        };
        
        updateGlobalHealthData(healthDataForAlerts);

        hideWidgetLoading('.steps-widget');
        hideWidgetLoading('.heartrate-widget');
        hideWidgetLoading('.calorie-widget');
        hideWidgetLoading('.sleep-widget');

        return todaysData;

    } catch (error) {
        console.error('❌ Error fetching fitness data:', error);
        
        hideWidgetLoading('.steps-widget');
        hideWidgetLoading('.heartrate-widget');
        hideWidgetLoading('.calorie-widget');
        hideWidgetLoading('.sleep-widget');
        
        throw error;
    }
}
// ========================================
// ENHANCED UI UPDATE FUNCTIONS
// ========================================

function updateDashboardWithTodaysData(todaysData, goalsMap = {}) {
    console.log('📊 Dashboard data update:', {
        hasSteps: !!todaysData.steps,
        hasHeartRate: !!todaysData.heartRate,
        hasCalories: !!todaysData.calories,
        hasSleep: !!todaysData.sleep, // Add this line
        goalsCount: Object.keys(goalsMap).length
    });
    
    if (todaysData.steps) {
        updateTodaysStepsWidget(todaysData.steps, goalsMap);
    } else {
        showEmptyState('.steps-widget', 'STEPS', 'SYNC YOUR DEVICE TO SEE STEP COUNT');
    }
    
    if (todaysData.heartRate) {
        updateTodaysHeartRateWidget(todaysData.heartRate, goalsMap);
    } else {
        showEmptyState('.heartrate-widget', 'HEART RATE', 'SYNC YOUR DEVICE TO SEE HEART RATE DATA');
    }
    
    if (todaysData.calories) {
        updateTodaysCaloriesWidget(todaysData.calories, goalsMap);
    } else {
        showEmptyState('.calorie-widget', 'CALORIES', 'SYNC YOUR DEVICE TO SEE CALORIE DATA');
    }
    
    // Add sleep widget update
    if (todaysData.sleep) {
        updateTodaysSleepWidget(todaysData.sleep, goalsMap);
    } else {
        showEmptyState('.sleep-widget', 'SLEEP', 'SYNC YOUR DEVICE TO SEE SLEEP DATA');
    }
    
    // Update health data display for alerts
    updateHealthDataDisplay(todaysData);
}

function updateTodaysSleepWidget(sleepData, goalsMap = {}) {
    console.log('😴 Updating sleep widget with data:', sleepData);
    
    let currentSleepMinutes = 0;
    let sleepDetails = null;
    let isUsingFallback = false;
    
    if (sleepData && sleepData.today && sleepData.today.value > 0) {
        currentSleepMinutes = sleepData.today.value;
        sleepDetails = sleepData.today;
        isUsingFallback = sleepData.isLatestFallback || false;
    } else if (sleepData && sleepData.recent && sleepData.recent.length > 0) {
        const recentSleep = sleepData.recent.filter(day => day.value > 0);
        if (recentSleep.length > 0) {
            const latestSleep = recentSleep[recentSleep.length - 1];
            currentSleepMinutes = latestSleep.value;
            sleepDetails = latestSleep;
            isUsingFallback = true;
        }
    }
    
    if (currentSleepMinutes === 0) {
        showEmptyState('.sleep-widget', 'SLEEP', 'NO SLEEP DATA AVAILABLE - SYNC YOUR DEVICE');
        return;
    }
    
    const sleepHours = (currentSleepMinutes / 60).toFixed(1);
    const goalSleepHours = goalsMap.sleep?.target || 8;
    const percentage = Math.min(100, Math.round((parseFloat(sleepHours) / goalSleepHours) * 100));
    
    // Update DOM elements
    const sleepNumberElement = document.querySelector('.sleep-widget .stat-number');
    const sleepLabelElement = document.querySelector('.sleep-widget .stat-label');
    const sleepQualityElement = document.querySelector('.sleep-widget .quality-label');
    const sleepBreakdownElement = document.querySelector('.sleep-widget .sleep-breakdown');
    
    if (sleepNumberElement) {
        sleepNumberElement.textContent = sleepHours;
        sleepNumberElement.setAttribute('data-value', currentSleepMinutes);
    }
    
    if (sleepLabelElement) {
        const labelText = isUsingFallback ? 'HOURS (LATEST DATA)' : 'HOURS LAST NIGHT';
        sleepLabelElement.textContent = labelText;
    }
    
    // Update sleep quality and breakdown
    if (sleepDetails) {
        const efficiency = sleepDetails.efficiency || 0;
        let qualityText = 'UNKNOWN';
        
        if (efficiency >= 85) qualityText = 'EXCELLENT';
        else if (efficiency >= 75) qualityText = 'GOOD';
        else if (efficiency >= 65) qualityText = 'FAIR';
        else qualityText = 'POOR';
        
        if (sleepQualityElement) {
            sleepQualityElement.textContent = `QUALITY: ${qualityText} (${efficiency}%)`;
        }
        
        if (sleepBreakdownElement) {
            const deepHours = sleepDetails.deep_sleep ? (sleepDetails.deep_sleep / 60).toFixed(1) : '0.0';
            const remHours = sleepDetails.rem_sleep ? (sleepDetails.rem_sleep / 60).toFixed(1) : '0.0';
            
            sleepBreakdownElement.innerHTML = `
                <span class="sleep-detail">DEEP: ${deepHours}H</span>
                <span class="sleep-detail">REM: ${remHours}H</span>
            `;
        }
    }
    
    // Update global health data
    updateGlobalHealthData({ sleepHours: parseFloat(sleepHours) });
    
    // Create sleep chart
    if (sleepDetails) {
        createSleepChartWithRealData(sleepDetails);
    }
    
    // Update recommendation
    updateSleepRecommendation(percentage, goalSleepHours - parseFloat(sleepHours), sleepDetails);
    
    console.log(`✅ Sleep widget updated: ${sleepHours} hours (${percentage}%)`);
}

function updateSleepRecommendation(percentage, hoursRemaining, sleepDetails) {
    const recommendationElement = document.querySelector('.sleep-widget .widget-recommendation');
    if (!recommendationElement) return;
    
    let title, text, icon = "🛏️";
    
    if (percentage >= 100) {
        title = "SLEEP GOAL ACHIEVED! 😴";
        text = "EXCELLENT! YOU'VE MET YOUR SLEEP TARGET";
        icon = "✅";
    } else if (percentage >= 85) {
        title = "GOOD SLEEP!";
        text = "YOU'RE GETTING QUALITY REST - KEEP IT UP!";
        icon = "😴";
    } else if (percentage >= 70) {
        title = "DECENT SLEEP";
        text = `TRY TO GET ${Math.abs(hoursRemaining).toFixed(1)} MORE HOURS TONIGHT`;
        icon = "🌙";
    } else {
        title = "IMPROVE SLEEP";
        text = "CONSIDER EARLIER BEDTIME FOR BETTER HEALTH";
        icon = "⏰";
    }
    
    // Add efficiency-based recommendations
    if (sleepDetails && sleepDetails.efficiency < 75) {
        title = "SLEEP QUALITY ISSUE";
        text = "FREQUENT WAKE-UPS DETECTED - OPTIMIZE SLEEP ENVIRONMENT";
        icon = "🔧";
    }
    
    recommendationElement.innerHTML = `
        <div class="rec-icon">${icon}</div>
        <div class="rec-content">
            <span class="rec-title">${title}</span>
            <span class="rec-text">${text}</span>
        </div>
    `;
}

function updateTodaysHeartRateWidget(heartRateData, goalsMap = {}) {
    let currentBPM = 0;
    let isUsingFallback = false;
    
    if (heartRateData.today && heartRateData.today.value > 0) {
        currentBPM = heartRateData.today.value;
        isUsingFallback = heartRateData.isLatestFallback;
    } else if (heartRateData.recent && heartRateData.recent.length > 0) {
        const recentHR = heartRateData.recent.filter(day => day.value > 0);
        if (recentHR.length > 0) {
            currentBPM = recentHR[recentHR.length - 1].value;
            isUsingFallback = true;
        }
    }
    
    if (currentBPM === 0) {
        showEmptyState('.heartrate-widget', 'HEART RATE', 'NO HEART RATE DATA AVAILABLE');
        return;
    }
    
    const hrNumberElement = document.querySelector('.heartrate-widget .stat-number');
    const hrProgressElement = document.querySelector('.heartrate-widget .progress-text');
    
    if (hrNumberElement) {
        hrNumberElement.textContent = currentBPM;
        // Add data attribute for easy extraction
        hrNumberElement.setAttribute('data-value', currentBPM);
    }
    
    if (hrProgressElement && isUsingFallback) {
        hrProgressElement.textContent = `${hrProgressElement.textContent} (LATEST DATA)`;
    }
    
    // Update global health data
    updateGlobalHealthData({ heartRate: currentBPM });
    
    if (heartRateData.recent && heartRateData.recent.length > 0) {
        const recentHR = heartRateData.recent.filter(day => day.value > 0);
        if (recentHR.length > 0) {
            createHeartRateChartWithRealData(recentHR);
        }
    }
    
    updateHeartRateRecommendation(currentBPM, goalsMap.heart_rate?.target);
}

function updateTodaysCaloriesWidget(caloriesData, goalsMap = {}) {
    let currentCalories = 0;
    let isUsingFallback = false;
    
    if (caloriesData.today && caloriesData.today.value > 0) {
        currentCalories = caloriesData.today.value;
        isUsingFallback = caloriesData.isLatestFallback;
    } else if (caloriesData.recent && caloriesData.recent.length > 0) {
        const recentCalories = caloriesData.recent.filter(day => day.value > 0);
        if (recentCalories.length > 0) {
            currentCalories = recentCalories[recentCalories.length - 1].value;
            isUsingFallback = true;
        }
    }
    
    if (currentCalories === 0) {
        showEmptyState('.calorie-widget', 'CALORIES', 'NO CALORIE DATA AVAILABLE');
        return;
    }
    
    const goalCalories = goalsMap.calories?.target || 2500;
    const percentage = Math.min(100, Math.round((currentCalories / goalCalories) * 100));
    
    const caloriesNumberElement = document.querySelector('.calorie-widget .stat-number');
    const caloriesProgressElement = document.querySelector('.calorie-widget .progress-text');
    
    if (caloriesNumberElement) {
        caloriesNumberElement.textContent = currentCalories.toLocaleString();
        // Add data attribute for easy extraction
        caloriesNumberElement.setAttribute('data-value', currentCalories);
    }
    
    if (caloriesProgressElement) {
        const progressText = `${percentage}% OF GOAL (${goalCalories.toLocaleString()})`;
        const fallbackText = isUsingFallback ? ' (LATEST DATA)' : '';
        caloriesProgressElement.textContent = progressText + fallbackText;
    }
    
    // Update global health data
    updateGlobalHealthData({ calories: currentCalories });
    
    if (percentage >= 100) {
        addCelebrationEffect('.calorie-widget', percentage);
    }
    
    createCalorieChartWithRealData(percentage);
    updateCaloriesRecommendation(percentage, goalCalories - currentCalories, goalCalories);
}

// ========================================
// HEALTH DATA DISPLAY FOR MONITORING
// ========================================

function updateHealthDataDisplay(todaysData) {
    // Create or update health data display widget
    let healthDisplayWidget = document.querySelector('.health-data-display');
    
    if (!healthDisplayWidget) {
        healthDisplayWidget = createHealthDataDisplayWidget();
    }
    
    const stepsValue = todaysData.steps?.today?.value || 0;
    const heartRateValue = todaysData.heartRate?.today?.value || 0;
    const caloriesValue = todaysData.calories?.today?.value || 0;
    const sleepValue = todaysData.sleep?.today?.value || 0; // Add this line
    const sleepHours = sleepValue > 0 ? (sleepValue / 60).toFixed(1) : '0.0'; // Add this line
    
    healthDisplayWidget.innerHTML = `
        <div class="health-data-header">
            <span class="health-data-title">TODAY'S HEALTH DATA</span>
            <span class="health-data-time">${new Date().toLocaleTimeString()}</span>
        </div>
        <div class="health-data-grid">
            <div class="health-data-item">
                <span class="health-data-label">STEPS</span>
                <span class="health-data-value" data-type="steps">${stepsValue.toLocaleString()}</span>
            </div>
            <div class="health-data-item">
                <span class="health-data-label">HEART RATE</span>
                <span class="health-data-value" data-type="heartRate">${heartRateValue} BPM</span>
            </div>
            <div class="health-data-item">
                <span class="health-data-label">CALORIES</span>
                <span class="health-data-value" data-type="calories">${caloriesValue.toLocaleString()}</span>
            </div>
            <div class="health-data-item">
                <span class="health-data-label">SLEEP</span>
                <span class="health-data-value" data-type="sleep">${sleepHours}H</span>
            </div>
        </div>
        <div class="health-data-actions">
            <button class="health-check-btn" onclick="manualHealthCheck()">CHECK ALERTS NOW</button>
            <span class="last-check">Last check: ${currentHealthData.lastUpdated ? new Date(currentHealthData.lastUpdated).toLocaleTimeString() : 'Never'}</span>
        </div>
    `;
}

function createHealthDataDisplayWidget() {
    const widget = document.createElement('div');
    widget.className = 'health-data-display widget';
    widget.style.cssText = `
        background: linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 100%);
        border: 2px solid #4CAF50;
        border-radius: 12px;
        padding: 20px;
        margin: 20px 0;
        font-family: 'Press Start 2P', monospace;
    `;
    
    // Add to dashboard
    const dashboardGrid = document.querySelector('.dashboard-grid') || document.querySelector('.menu-content');
    if (dashboardGrid) {
        dashboardGrid.appendChild(widget);
    }
    
    return widget;
}

// ========================================
// MANUAL HEALTH CHECK FUNCTION
// ========================================

async function manualHealthCheck() {
    const userId = getCurrentUserId();
    if (!userId) {
        showErrorToast('No user logged in');
        return;
    }
    
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (!userData.email) {
        showErrorToast('No email configured for alerts');
        return;
    }
    
    console.log('🔍 Manual health check triggered...');
    showInfoToast('Checking health alerts...');
    
    // Force check health alerts
    const result = await checkHealthAlerts(userId, userData, true);
    
    if (result) {
        if (result.alertsTriggered > 0) {
            showSuccessToast(`${result.alertsTriggered} health alerts triggered! Check your email.`);
        } else {
            showInfoToast('All health metrics are within normal ranges.');
        }
    } else {
        showWarningToast('Health check completed, but no alerts were processed.');
    }
}

// ========================================
// ENHANCED INITIALIZATION WITH HEALTH MONITORING
// ========================================

async function initializeDashboardWithHealthMonitoring(forceSync = false) {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('code') || urlParams.get('oauth') || urlParams.get('error')) {
            handleOAuthCallback();
            return;
        }
        
        const userId = getCurrentUserId();
        if (!userId) {
            hideGlobalLoading();
            window.location.href = '../auth/auth.html';
            return;
        }
        
        console.log('🚀 Dashboard initializing with health monitoring for user:', userId);
        
        const userData = await loadUserProfile();
        if (!userData) {
            hideGlobalLoading();
            return;
        }
        
        updateUserDataWidget(userData);
        
        const isGoogleFitConnected = userData.fit_tokens && userData.fit_tokens.trim() !== '';
        
        if (!isGoogleFitConnected) {
            hideGlobalLoading();
            setTimeout(() => {
                displayConnectGoogleFitPrompt(userId);
            }, 100);
            return;
        }
        
        const syncNeeded = isSyncNeeded(userData.last_sync, forceSync);
        
        if (syncNeeded) {
            console.log(`🔄 ${forceSync ? 'Force syncing' : 'Syncing'} fresh data from Google Fit`);
            try {
                await fetchTodaysFitnessData(userId);
            } catch (error) {
                console.error('Fresh sync failed, falling back to cached data:', error);
                showErrorToast('Sync failed, loading cached data');
                await loadCachedData(userId);
            }
        } else {
            console.log('📋 Loading cached data (last sync was recent)');            
            await loadCachedData(userId);
        }
        
        // Start health alert monitoring
        startHealthAlertMonitoring(userId, userData);
        
        // Initial health check after data loads
        setTimeout(async () => {
            console.log('🔍 Performing initial health check...');
            await checkHealthAlerts(userId, userData, forceSync);
        }, 3000);
        
        console.log('✅ Dashboard initialization with health monitoring complete');
        hideGlobalLoading();
        
    } catch (error) {
        console.error('❌ Dashboard initialization error:', error);
        hideGlobalLoading();
        showErrorToast('Failed to initialize dashboard. Please refresh the page.');
    }
}

// ========================================
// TOAST NOTIFICATION FUNCTIONS
// ========================================

function showSuccessToast(message) {
    const toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">✅</span>
            <span class="toast-message">${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 4000);
}

function showWarningToast(message) {
    const toast = document.createElement('div');
    toast.className = 'warning-toast';
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">⚠️</span>
            <span class="toast-message">${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 5000);
}

function showInfoToast(message) {
    const toast = document.createElement('div');
    toast.className = 'info-toast';
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">ℹ️</span>
            <span class="toast-message">${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 4000);
}

function showErrorToast(message) {
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">❌</span>
            <span class="toast-message">${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 4000);
}

// ========================================
// UTILITY FUNCTIONS (EXISTING)
// ========================================

function getTodaysDataFromSet(dataSet, todayDate) {
    if (!dataSet || !dataSet.data || dataSet.data.length === 0) {
        return null;
    }
    
    const todaysEntry = dataSet.data.find(entry => entry.date === todayDate);
    const recentEntries = dataSet.data.slice(-7);
    
    if (!todaysEntry && dataSet.data.length > 0) {
        const latestEntry = dataSet.data[dataSet.data.length - 1];
        console.log(`No data for ${todayDate}, using latest entry from ${latestEntry.date}`);
        
        return {
            today: latestEntry,
            recent: recentEntries,
            isLatestFallback: true
        };
    }
    
    return {
        today: todaysEntry,
        recent: recentEntries,
        isLatestFallback: false
    };
}

async function handleApiResponse(response, dataType) {
    if (!response.ok) {
        console.warn(`API request failed for ${dataType}: ${response.status} ${response.statusText}`);
        return null;
    }
    
    const data = await response.json();
    
    if (data.stored > 0) {
        console.log(`✅ New ${dataType} data synced: ${data.stored} records`);
        showSuccessToast(`Synced ${data.stored} new ${dataType} records`);
    } else if (data.count > 0) {
        console.log(`📊 ${dataType} data loaded: ${data.count} records`);
    }
    
    return data;
}

// ========================================
// LOADING STATES
// ========================================

function showGlobalLoading() {
    const existingOverlay = document.getElementById('loadingOverlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    const loadingHTML = `
        <div id="loadingOverlay" class="loading-overlay">
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <div class="loading-text">SYNCING HEALTH DATA...</div>
                <div class="loading-subtext">PREPARING HEALTH MONITORING</div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', loadingHTML);
}

function hideGlobalLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.remove();
        }, 300);
    }
}

function showWidgetLoading(widgetSelector, message = 'Loading...') {
    const widget = document.querySelector(widgetSelector);
    if (!widget) return;
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'widget-loading';
    loadingDiv.innerHTML = `
        <div class="widget-loader">
            <div class="spinner"></div>
            <span class="loading-message">${message}</span>
        </div>
    `;
    
    const content = widget.querySelector('.widget-content');
    if (content) {
        content.style.opacity = '0.3';
        content.appendChild(loadingDiv);
    }
}

function hideWidgetLoading(widgetSelector) {
    const widget = document.querySelector(widgetSelector);
    if (!widget) return;
    
    const loadingDiv = widget.querySelector('.widget-loading');
    const content = widget.querySelector('.widget-content');
    
    if (loadingDiv) {
        loadingDiv.remove();
    }
    if (content) {
        content.style.opacity = '1';
    }
}

// ========================================
// MAIN INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    showGlobalLoading();
    
    // Initialize dashboard with health monitoring
    setTimeout(() => {
        initializeDashboardWithHealthMonitoring(false);
    }, 800);
    
    // Add manual health check button to UI
    const healthCheckButtonHTML = `
        <button id="manualHealthCheckBtn" class="button" style="
            position: fixed; 
            bottom: 80px; 
            right: 20px; 
            z-index: 1000; 
            background: #4CAF50; 
            color: white; 
            border: none; 
            padding: 10px 15px; 
            border-radius: 6px; 
            font-size: 8px; 
            cursor: pointer; 
            font-family: 'Press Start 2P', monospace;
        ">
            CHECK HEALTH
        </button>
    `;
    
    document.body.insertAdjacentHTML('beforeend', healthCheckButtonHTML);
    
    // Add event listener for manual health check
    document.getElementById('manualHealthCheckBtn').addEventListener('click', manualHealthCheck);
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        stopHealthAlertMonitoring();
    });
});

// Keep backward compatibility
async function initializeDashboard(forceSync = false) {
    return await initializeDashboardWithHealthMonitoring(forceSync);
}

// Additional helper functions for existing functionality
async function loadUserProfile() {
    const userId = getCurrentUserId();
    if (!userId) {
        window.location.href = '../auth/auth.html';
        return null;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            if (response.status === 404) {
                localStorage.removeItem('userData');
                window.location.href = '../auth/auth.html';
            } else {
                throw new Error(`Failed to fetch user profile: ${response.status}`);
            }
            return null;
        }

        const userData = await response.json();
        localStorage.setItem('currentUserProfile', JSON.stringify(userData.data));
        return userData.data;

    } catch (error) {
        console.error('Error loading user profile:', error);
        showErrorToast('Failed to load user profile');
        return null;
    }
}

function isSyncNeeded(lastSync, forceSync = false) {
    if (forceSync || !lastSync) return true;
    
    const lastSyncTime = new Date(lastSync);
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    return lastSyncTime < fifteenMinutesAgo;
}

async function fetchUserGoalsWithProgress() {
    try {
        const userId = getCurrentUserId();
        if (!userId) return {};
        
        const response = await fetch(`${API_BASE_URL}/goals?userId=${userId}`, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch goals: ${response.status}`);
        }
        
        const result = await response.json();
        const goals = result.data || [];
        
        const goalsMap = {};
        goals.forEach(goal => {
            goalsMap[goal.goalType] = {
                target: goal.targetValue,
                icon: goal.icon,
                id: goal.id
            };
        });
        
        return goalsMap;
        
    } catch (error) {
        console.error('Error fetching goals:', error);
        return {};
    }
}

async function loadCachedData(userId) {
    try {
        const [stepsData, heartRateData, caloriesData, sleepData, goalsMap] = await Promise.all([
            getStoredOrFetchData(userId, 'steps', 3),
            getStoredOrFetchData(userId, 'heartrate', 3),
            getStoredOrFetchData(userId, 'calories', 3),
            getStoredOrFetchData(userId, 'sleep', 3), // Add this line
            fetchUserGoalsWithProgress()
        ]);
        
        const today = getTodayDate();
        const todaysData = {
            steps: getTodaysDataFromSet(stepsData, today),
            heartRate: getTodaysDataFromSet(heartRateData, today),
            calories: getTodaysDataFromSet(caloriesData, today),
            sleep: getTodaysDataFromSet(sleepData, today) // Add this line
        };
        
        updateDashboardWithTodaysData(todaysData, goalsMap);
    } catch (error) {
        console.error('Failed to load cached data:', error);
        showEmptyState('.steps-widget', 'STEPS', 'UNABLE TO LOAD DATA - CHECK CONNECTION');
        showEmptyState('.heartrate-widget', 'HEART RATE', 'UNABLE TO LOAD DATA - CHECK CONNECTION');
        showEmptyState('.calorie-widget', 'CALORIES', 'UNABLE TO LOAD DATA - CHECK CONNECTION');
        showEmptyState('.sleep-widget', 'SLEEP', 'UNABLE TO LOAD DATA - CHECK CONNECTION'); // Add this line
    }
}

async function getStoredOrFetchData(userId, dataType, days = 7) {
    try {
        const storedResponse = await fetch(`${API_BASE_URL}/wearable/stored-data/${dataType}/${userId}?days=${days}`);
        
        if (storedResponse.ok) {
            const storedData = await storedResponse.json();
            if (storedData.count > 0) {
                return storedData;
            }
        }
        
        const today = getTodayDate();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];
        
        const apiResponse = await fetch(`${API_BASE_URL}/wearable/fitness-data?dataType=${dataType}&startDate=${startDateStr}&endDate=${today}&userId=${userId}`);
        
        if (apiResponse.ok) {
            const apiData = await apiResponse.json();
            return apiData;
        }
        
    } catch (error) {
        console.error(`Error getting ${dataType} data:`, error);
    }
    
    return null;
}

function updateUserDataWidget(userData) {
    // Update user name with real data
    const userNameElements = document.querySelectorAll('.user-name');
    userNameElements.forEach(element => {
        if (userData.firstName && userData.lastName) {
            const fullName = `${userData.firstName.toUpperCase()} ${userData.lastName.toUpperCase()}`;
            element.textContent = fullName;
        } else if (userData.first_name && userData.last_name) {
            const fullName = `${userData.first_name.toUpperCase()} ${userData.last_name.toUpperCase()}`;
            element.textContent = fullName;
        }
    });

    const userEmailElement = document.querySelector('.user-email');
    if (userEmailElement && userData.email) {
        userEmailElement.textContent = userData.email;
    }
}

function showEmptyState(widgetSelector, dataType, message) {
    const widget = document.querySelector(widgetSelector);
    if (!widget) return;
    
    const content = widget.querySelector('.widget-content');
    if (!content) return;
    
    const emptyStateHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">😞</div>
            <div class="empty-state-text">
                <div class="empty-state-title">NO ${dataType.toUpperCase()} DATA</div>
                <div class="empty-state-message">${message}</div>
            </div>
            <button class="empty-state-button" onclick="refreshData()">REFRESH DATA</button>
        </div>
    `;
    
    content.innerHTML = emptyStateHTML;
}

function refreshData() {
    console.log('🔄 Manual refresh triggered - forcing fresh sync');
    showGlobalLoading();
    setTimeout(() => {
        initializeDashboardWithHealthMonitoring(true);
    }, 500);
}

// Placeholder functions for chart creation and other UI elements
function createPixelatedStepsCircle(percentage) {
    // Implementation for steps circle visualization
    console.log(`Creating steps circle with ${percentage}% progress`);
}

function addCelebrationEffect(widgetSelector, percentage) {
    // Implementation for celebration effects
    console.log(`Adding celebration effect to ${widgetSelector} with ${percentage}%`);
}

function updateStepsRecommendation(percentage, stepsRemaining, goalSteps) {
    // Implementation for steps recommendations
    console.log(`Updating steps recommendation: ${percentage}% complete, ${stepsRemaining} steps remaining`);
}

function createHeartRateChartWithRealData(recentHR) {
    // Implementation for heart rate chart
    console.log('Creating heart rate chart with recent data:', recentHR.length, 'data points');
}

function updateHeartRateRecommendation(currentBPM, targetBPM) {
    // Implementation for heart rate recommendations
    console.log(`Updating heart rate recommendation: current ${currentBPM} BPM, target ${targetBPM} BPM`);
}

function createCalorieChartWithRealData(percentage) {
    // Implementation for calorie chart
    console.log(`Creating calorie chart with ${percentage}% progress`);
}

function updateCaloriesRecommendation(percentage, caloriesRemaining, goalCalories) {
    // Implementation for calorie recommendations
    console.log(`Updating calorie recommendation: ${percentage}% complete, ${caloriesRemaining} calories remaining`);
}

function displayConnectGoogleFitPrompt(userId) {
    // Implementation for Google Fit connection prompt
    console.log(`Displaying Google Fit connection prompt for user ${userId}`);
}

function handleOAuthCallback() {
    // Implementation for OAuth callback handling
    console.log('Handling OAuth callback');
}

function createPixelatedStepsCircle(percentage) {
    console.log(`🎯 Creating steps circle with ${percentage}% progress`);
    
    const circle = document.querySelector('.steps-progress-circular');
    if (circle) {
        const circumference = 314; // 2 * π * 50 (radius)
        const offset = circumference - (percentage / 100) * circumference;
        
        // Animate the circle
        circle.style.strokeDashoffset = offset;
        circle.style.transition = 'stroke-dashoffset 2s ease-in-out';
        
        console.log(`✅ Steps circle updated: ${percentage}% (offset: ${offset})`);
    } else {
        console.warn('⚠️ Steps progress circle element not found');
    }
}

function createHeartRateChartWithRealData(recentHR) {
    console.log('❤️ Creating heart rate chart with recent data:', recentHR.length, 'data points');
    
    const canvas = document.getElementById('heartRateChart');
    if (!canvas) {
        console.warn('⚠️ Heart rate chart canvas not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    if (!recentHR || recentHR.length === 0) {
        // Draw placeholder
        ctx.fillStyle = '#D32F2F';
        ctx.font = '12px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('NO DATA', width / 2, height / 2);
        return;
    }
    
    // Prepare data
    const validData = recentHR.filter(d => d.value > 0);
    if (validData.length === 0) {
        ctx.fillStyle = '#D32F2F';
        ctx.font = '12px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('NO VALID DATA', width / 2, height / 2);
        return;
    }
    
    const maxHR = Math.max(...validData.map(d => d.value));
    const minHR = Math.min(...validData.map(d => d.value));
    const range = maxHR - minHR || 1;
    
    // Draw pixelated line chart
    ctx.strokeStyle = '#D32F2F';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    validData.forEach((point, index) => {
        const x = (index / (validData.length - 1)) * (width - 40) + 20;
        const y = height - 20 - ((point.value - minHR) / range) * (height - 40);
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
        
        // Draw pixel points
        ctx.fillStyle = '#F44336';
        ctx.fillRect(x - 2, y - 2, 4, 4);
    });
    
    ctx.stroke();
    
    // Update heart rate stats
    updateHeartRateStats(validData);
    
    console.log('✅ Heart rate chart created successfully');
}

function createCalorieChartWithRealData(percentage) {
    console.log(`🔥 Creating calorie chart with ${percentage}% progress`);
    
    const canvas = document.getElementById('calorieChart');
    if (!canvas) {
        console.warn('⚠️ Calorie chart canvas not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 8;
    ctx.stroke();
    
    // Draw progress arc
    const startAngle = -Math.PI / 2; // Start from top
    const endAngle = startAngle + (percentage / 100) * 2 * Math.PI;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.strokeStyle = '#FFA000';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Draw percentage text
    ctx.fillStyle = '#FFB74D';
    ctx.font = '16px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(`${percentage}%`, centerX, centerY + 5);
    
    console.log('✅ Calorie chart created successfully');
}

function createSleepChartWithRealData(sleepData) {
    console.log('😴 Creating sleep chart with data:', sleepData);
    
    const canvas = document.getElementById('sleepChart');
    if (!canvas) {
        console.warn('⚠️ Sleep chart canvas not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!sleepData || sleepData.value === 0) {
        // Draw placeholder
        ctx.fillStyle = '#7B1FA2';
        ctx.font = '12px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('NO DATA', centerX, centerY);
        return;
    }
    
    const totalSleep = sleepData.value;
    const deepSleep = sleepData.deep_sleep || 0;
    const lightSleep = sleepData.light_sleep || 0;
    const remSleep = sleepData.rem_sleep || 0;
    const awakeTime = sleepData.awake_time || 0;
    
    // If we don't have breakdown data, estimate it
    const hasBreakdown = deepSleep > 0 || lightSleep > 0 || remSleep > 0;
    const finalDeepSleep = hasBreakdown ? deepSleep : totalSleep * 0.25;
    const finalLightSleep = hasBreakdown ? lightSleep : totalSleep * 0.55;
    const finalRemSleep = hasBreakdown ? remSleep : totalSleep * 0.20;
    
    // Draw sleep phases as segments
    let currentAngle = -Math.PI / 2;
    
    // Deep sleep (dark purple)
    if (finalDeepSleep > 0) {
        const deepAngle = (finalDeepSleep / totalSleep) * 2 * Math.PI;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + deepAngle);
        ctx.strokeStyle = '#4A148C';
        ctx.lineWidth = 12;
        ctx.stroke();
        currentAngle += deepAngle;
    }
    
    // Light sleep (medium purple)
    if (finalLightSleep > 0) {
        const lightAngle = (finalLightSleep / totalSleep) * 2 * Math.PI;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + lightAngle);
        ctx.strokeStyle = '#7B1FA2';
        ctx.lineWidth = 12;
        ctx.stroke();
        currentAngle += lightAngle;
    }
    
    // REM sleep (light purple)
    if (finalRemSleep > 0) {
        const remAngle = (finalRemSleep / totalSleep) * 2 * Math.PI;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + remAngle);
        ctx.strokeStyle = '#BA68C8';
        ctx.lineWidth = 12;
        ctx.stroke();
    }
    
    // Draw total hours in center
    ctx.fillStyle = '#BA68C8';
    ctx.font = '14px "Press Start 2P"';
    ctx.textAlign = 'center';
    const hours = (totalSleep / 60).toFixed(1);
    ctx.fillText(`${hours}h`, centerX, centerY + 5);
    
    console.log('✅ Sleep chart created successfully');
}

// ========================================
// ENHANCED DATA PROCESSING FUNCTIONS
// ========================================

function getTodaysDataFromSet(dataSet, todayDate) {
    if (!dataSet || !dataSet.data || dataSet.data.length === 0) {
        console.warn(`⚠️ No data available for processing`);
        return { 
            today: null, 
            recent: [], 
            isLatestFallback: false 
        };
    }
    
    const todaysEntry = dataSet.data.find(entry => entry.date === todayDate);
    const recentEntries = dataSet.data.slice(-7);
    
    if (!todaysEntry && dataSet.data.length > 0) {
        const latestEntry = dataSet.data[dataSet.data.length - 1];
        console.log(`📅 No data for ${todayDate}, using latest entry from ${latestEntry.date}`);
        
        return {
            today: latestEntry,
            recent: recentEntries,
            isLatestFallback: true
        };
    }
    
    return {
        today: todaysEntry,
        recent: recentEntries,
        isLatestFallback: false
    };
}

// ========================================
// ENHANCED UPDATE FUNCTIONS WITH BETTER ERROR HANDLING
// ========================================

function updateTodaysStepsWidget(stepsData, goalsMap = {}) {
    console.log('👟 Updating steps widget with data:', stepsData);
    
    let currentSteps = 0;
    let isUsingFallback = false;
    
    if (stepsData && stepsData.today && stepsData.today.value > 0) {
        currentSteps = stepsData.today.value;
        isUsingFallback = stepsData.isLatestFallback || false;
    } else if (stepsData && stepsData.recent && stepsData.recent.length > 0) {
        const recentSteps = stepsData.recent.filter(day => day.value > 0);
        if (recentSteps.length > 0) {
            currentSteps = recentSteps[recentSteps.length - 1].value;
            isUsingFallback = true;
        }
    }
    
    if (currentSteps === 0) {
        showEmptyState('.steps-widget', 'STEPS', 'NO STEP DATA AVAILABLE - SYNC YOUR DEVICE');
        return;
    }
    
    const goalSteps = goalsMap.steps?.target || 10000;
    const percentage = Math.min(100, Math.round((currentSteps / goalSteps) * 100));
    
    // Update DOM elements
    const stepsNumberElement = document.querySelector('.steps-widget .stat-number');
    const stepsProgressElement = document.querySelector('.steps-widget .progress-text');
    
    if (stepsNumberElement) {
        stepsNumberElement.textContent = currentSteps.toLocaleString();
        stepsNumberElement.setAttribute('data-value', currentSteps);
    }
    
    if (stepsProgressElement) {
        const progressText = `${percentage}% OF GOAL (${goalSteps.toLocaleString()})`;
        const fallbackText = isUsingFallback ? ' (LATEST DATA)' : '';
        stepsProgressElement.textContent = progressText + fallbackText;
    }
    
    // Update global health data
    updateGlobalHealthData({ steps: currentSteps });
    
    // Create visual progress circle
    createPixelatedStepsCircle(percentage);
    
    // Add celebration effect if goal reached
    if (percentage >= 100) {
        addCelebrationEffect('.steps-widget', percentage);
    }
    
    // Update recommendation
    updateStepsRecommendation(percentage, goalSteps - currentSteps, goalSteps);
    
    console.log(`✅ Steps widget updated: ${currentSteps} steps (${percentage}%)`);
}

function updateTodaysHeartRateWidget(heartRateData, goalsMap = {}) {
    console.log('❤️ Updating heart rate widget with data:', heartRateData);
    
    let currentBPM = 0;
    let isUsingFallback = false;
    
    if (heartRateData && heartRateData.today && heartRateData.today.value > 0) {
        currentBPM = heartRateData.today.value;
        isUsingFallback = heartRateData.isLatestFallback || false;
    } else if (heartRateData && heartRateData.recent && heartRateData.recent.length > 0) {
        const recentHR = heartRateData.recent.filter(day => day.value > 0);
        if (recentHR.length > 0) {
            currentBPM = recentHR[recentHR.length - 1].value;
            isUsingFallback = true;
        }
    }
    
    if (currentBPM === 0) {
        showEmptyState('.heartrate-widget', 'HEART RATE', 'NO HEART RATE DATA AVAILABLE - SYNC YOUR DEVICE');
        return;
    }
    
    // Update DOM elements
    const hrNumberElement = document.querySelector('.heartrate-widget .stat-number');
    if (hrNumberElement) {
        hrNumberElement.textContent = currentBPM;
        hrNumberElement.setAttribute('data-value', currentBPM);
    }
    
    // Update global health data
    updateGlobalHealthData({ heartRate: currentBPM });
    
    // Create chart with recent data
    if (heartRateData && heartRateData.recent && heartRateData.recent.length > 0) {
        const recentHR = heartRateData.recent.filter(day => day.value > 0);
        if (recentHR.length > 0) {
            createHeartRateChartWithRealData(recentHR);
        }
    }
    
    // Update recommendation
    updateHeartRateRecommendation(currentBPM, goalsMap.heart_rate?.target);
    
    console.log(`✅ Heart rate widget updated: ${currentBPM} BPM`);
}

function updateTodaysCaloriesWidget(caloriesData, goalsMap = {}) {
    console.log('🔥 Updating calories widget with data:', caloriesData);
    
    let currentCalories = 0;
    let isUsingFallback = false;
    
    if (caloriesData && caloriesData.today && caloriesData.today.value > 0) {
        currentCalories = caloriesData.today.value;
        isUsingFallback = caloriesData.isLatestFallback || false;
    } else if (caloriesData && caloriesData.recent && caloriesData.recent.length > 0) {
        const recentCalories = caloriesData.recent.filter(day => day.value > 0);
        if (recentCalories.length > 0) {
            currentCalories = recentCalories[recentCalories.length - 1].value;
            isUsingFallback = true;
        }
    }
    
    if (currentCalories === 0) {
        showEmptyState('.calorie-widget', 'CALORIES', 'NO CALORIE DATA AVAILABLE - SYNC YOUR DEVICE');
        return;
    }
    
    const goalCalories = goalsMap.calories?.target || 2500;
    const percentage = Math.min(100, Math.round((currentCalories / goalCalories) * 100));
    
    // Update DOM elements
    const caloriesNumberElement = document.querySelector('.calorie-widget .stat-number');
    const caloriesProgressElement = document.querySelector('.calorie-widget .progress-text');
    
    if (caloriesNumberElement) {
        caloriesNumberElement.textContent = currentCalories.toLocaleString();
        caloriesNumberElement.setAttribute('data-value', currentCalories);
    }
    
    if (caloriesProgressElement) {
        const progressText = `${percentage}% OF GOAL (${goalCalories.toLocaleString()})`;
        const fallbackText = isUsingFallback ? ' (LATEST DATA)' : '';
        caloriesProgressElement.textContent = progressText + fallbackText;
    }
    
    // Update global health data
    updateGlobalHealthData({ calories: currentCalories });
    
    // Add celebration effect if goal reached
    if (percentage >= 100) {
        addCelebrationEffect('.calorie-widget', percentage);
    }
    
    // Create visual chart
    createCalorieChartWithRealData(percentage);
    
    // Update recommendation
    updateCaloriesRecommendation(percentage, goalCalories - currentCalories, goalCalories);
    
    console.log(`✅ Calories widget updated: ${currentCalories} calories (${percentage}%)`);
}

// ========================================
// ENHANCED DEBUGGING FOR API CALLS
// ========================================

async function fetchTodaysFitnessData(userId) {
    const today = getTodayDate();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`📊 Fetching fitness data for user ${userId} from ${yesterday} to ${today}`);
    
    showWidgetLoading('.steps-widget', 'Syncing steps...');
    showWidgetLoading('.heartrate-widget', 'Reading heart rate...');
    showWidgetLoading('.calorie-widget', 'Calculating calories...');
    
    try {
        const [stepsResponse, heartRateResponse, caloriesResponse, goalsMap] = await Promise.all([
            fetch(`${API_BASE_URL}/wearable/fitness-data?dataType=steps&startDate=${yesterday}&endDate=${today}&userId=${userId}`),
            fetch(`${API_BASE_URL}/wearable/fitness-data?dataType=heartrate&startDate=${yesterday}&endDate=${today}&userId=${userId}`),
            fetch(`${API_BASE_URL}/wearable/fitness-data?dataType=calories&startDate=${yesterday}&endDate=${today}&userId=${userId}`),
            fetchUserGoalsWithProgress()
        ]);

        // Enhanced debugging
        console.log('🌐 API Response Status:', {
            steps: `${stepsResponse.status} ${stepsResponse.statusText}`,
            heartRate: `${heartRateResponse.status} ${heartRateResponse.statusText}`,
            calories: `${caloriesResponse.status} ${caloriesResponse.statusText}`
        });

        const [stepsData, heartRateData, caloriesData] = await Promise.all([
            handleApiResponse(stepsResponse, 'steps'),
            handleApiResponse(heartRateResponse, 'heartrate'),
            handleApiResponse(caloriesResponse, 'calories')
        ]);

        // Debug the actual data structure
        console.log('📋 Parsed API Data:', {
            stepsData: {
                hasData: !!stepsData,
                dataCount: stepsData?.data?.length || 0,
                structure: stepsData ? Object.keys(stepsData) : 'null'
            },
            heartRateData: {
                hasData: !!heartRateData,
                dataCount: heartRateData?.data?.length || 0,
                structure: heartRateData ? Object.keys(heartRateData) : 'null'
            },
            caloriesData: {
                hasData: !!caloriesData,
                dataCount: caloriesData?.data?.length || 0,
                structure: caloriesData ? Object.keys(caloriesData) : 'null'
            }
        });

        // Focus on today's data specifically
        const todaysData = {
            steps: getTodaysDataFromSet(stepsData, today),
            heartRate: getTodaysDataFromSet(heartRateData, today),
            calories: getTodaysDataFromSet(caloriesData, today)
        };

        console.log('📅 Today\'s Processed Data:', {
            steps: todaysData.steps?.today?.value || 'No data',
            heartRate: todaysData.heartRate?.today?.value || 'No data',
            calories: todaysData.calories?.today?.value || 'No data'
        });

        // Update dashboard with data
        updateDashboardWithTodaysData(todaysData, goalsMap);
        
        // Update global health data for alert system
        const healthDataForAlerts = {
            steps: todaysData.steps?.today?.value || 0,
            heartRate: todaysData.heartRate?.today?.value || 0,
            calories: todaysData.calories?.today?.value || 0,
            sleepHours: 7.5 // You can get this from sleep data if available
        };
        
        updateGlobalHealthData(healthDataForAlerts);

        hideWidgetLoading('.steps-widget');
        hideWidgetLoading('.heartrate-widget');
        hideWidgetLoading('.calorie-widget');

        return todaysData;

    } catch (error) {
        console.error('❌ Error fetching fitness data:', error);
        
        hideWidgetLoading('.steps-widget');
        hideWidgetLoading('.heartrate-widget');
        hideWidgetLoading('.calorie-widget');
        
        // Show error state
        showEmptyState('.steps-widget', 'STEPS', 'SYNC FAILED - CHECK CONNECTION');
        showEmptyState('.heartrate-widget', 'HEART RATE', 'SYNC FAILED - CHECK CONNECTION');
        showEmptyState('.calorie-widget', 'CALORIES', 'SYNC FAILED - CHECK CONNECTION');
        
        throw error;
    }
}

// ========================================
// HELPER FUNCTIONS FOR RECOMMENDATIONS AND STATS
// ========================================

function updateStepsRecommendation(percentage, stepsRemaining, goalSteps) {
    const recommendationElement = document.querySelector('.steps-widget .widget-recommendation');
    if (!recommendationElement) return;
    
    let title, text;
    
    if (percentage >= 100) {
        title = "GOAL ACHIEVED! 🎉";
        text = "EXCELLENT WORK! YOU'VE REACHED YOUR DAILY STEP GOAL";
    } else if (percentage >= 80) {
        title = "ALMOST THERE!";
        text = `TAKE A ${Math.ceil(stepsRemaining / 120)}-MINUTE WALK TO REACH YOUR GOAL`;
    } else if (percentage >= 50) {
        title = "HALFWAY THERE!";
        text = `${stepsRemaining.toLocaleString()} MORE STEPS TO GO - YOU CAN DO IT!`;
    } else {
        title = "GET MOVING!";
        text = `START WITH A 10-MINUTE WALK TO BOOST YOUR STEP COUNT`;
    }
    
    recommendationElement.innerHTML = `
        <div class="rec-content">
            <span class="rec-title">${title}</span>
            <span class="rec-text">${text}</span>
        </div>
    `;
}

function updateHeartRateRecommendation(currentBPM, targetBPM) {
    const recommendationElement = document.querySelector('.heartrate-widget .widget-recommendation');
    if (!recommendationElement) return;
    
    let title, text, icon = "💧";
    
    if (currentBPM > 100) {
        title = "ELEVATED HEART RATE";
        text = "CONSIDER RELAXATION TECHNIQUES OR HYDRATION";
        icon = "🧘";
    } else if (currentBPM < 60) {
        title = "LOW HEART RATE";
        text = "GREAT RESTING HEART RATE - SIGN OF GOOD FITNESS";
        icon = "💪";
    } else {
        title = "NORMAL HEART RATE";
        text = "YOUR HEART RATE IS IN A HEALTHY RANGE";
        icon = "❤️";
    }
    
    recommendationElement.innerHTML = `
        <div class="rec-icon">${icon}</div>
        <div class="rec-content">
            <span class="rec-title">${title}</span>
            <span class="rec-text">${text}</span>
        </div>
    `;
}

function updateCaloriesRecommendation(percentage, caloriesRemaining, goalCalories) {
    const recommendationElement = document.querySelector('.calorie-widget .widget-recommendation');
    if (!recommendationElement) return;
    
    let title, text;
    
    if (percentage >= 100) {
        title = "CALORIE GOAL MET! 🔥";
        text = "FANTASTIC! YOU'VE BURNED YOUR TARGET CALORIES TODAY";
    } else if (percentage >= 75) {
        title = "ALMOST THERE!";
        text = `${caloriesRemaining} MORE CALORIES TO BURN - KEEP IT UP!`;
    } else {
        title = "BOOST YOUR BURN";
        text = "ADD 20 MINUTES OF CARDIO TO REACH YOUR CALORIE GOAL";
    }
    
    recommendationElement.innerHTML = `
        <div class="rec-icon">🏃</div>
        <div class="rec-content">
            <span class="rec-title">${title}</span>
            <span class="rec-text">${text}</span>
        </div>
    `;
}

function updateHeartRateStats(recentHR) {
    const restingElement = document.querySelector('.heart-stat .heart-value');
    const maxElement = document.querySelectorAll('.heart-stat .heart-value')[1];
    
    if (recentHR && recentHR.length > 0) {
        const values = recentHR.map(d => d.value);
        const minHR = Math.min(...values);
        const maxHR = Math.max(...values);
        
        if (restingElement) restingElement.textContent = `${minHR} BPM`;
        if (maxElement) maxElement.textContent = `${maxHR} BPM`;
    }
}