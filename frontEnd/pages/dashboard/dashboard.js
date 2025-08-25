// dashboard.js - Enhanced with Loading States and Today's Data Focus

// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// ========================================
// UTILITY FUNCTIONS
// ========================================

function getCurrentUserId() {
    console.log('🔍 Retrieving user ID from localStorage...');
    const userData = localStorage.getItem('userData');
    if (userData) {
        try {
            const user = JSON.parse(userData);
            console.log('✅ User ID found:', user.userID);
            return user.userID;
        } catch (e) {
            console.error('❌ Error parsing userData from localStorage:', e);
            return null;
        }
    }
    console.warn('⚠️ No user data found in localStorage');
    return null;
}

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'JUST NOW';
    if (diffMins < 60) return `${diffMins} MIN AGO`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}H AGO`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}D AGO`;
}

function getTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    console.log('📅 Today\'s date:', today);
    return today;
}

// ========================================
// LOADING STATE MANAGEMENT
// ========================================

function showGlobalLoading() {
    console.log('⏳ Showing global loading indicator...');
    
    // Remove existing loading overlay if any
    const existingOverlay = document.getElementById('loadingOverlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    const loadingHTML = `
        <div id="loadingOverlay" class="loading-overlay">
            <div class="loading-container">
                <div class="pixel-loader">
                    <div class="pixel-dot"></div>
                    <div class="pixel-dot"></div>
                    <div class="pixel-dot"></div>
                    <div class="pixel-dot"></div>
                </div>
                <div class="loading-text">SYNCING HEALTH DATA...</div>
                <div class="loading-subtext">CONNECTING TO YOUR WEARABLE DEVICE</div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', loadingHTML);
}

function hideGlobalLoading() {
    console.log('✅ Hiding global loading indicator...');
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.remove();
        }, 300);
    }
}

function showWidgetLoading(widgetSelector, message = 'Loading...') {
    console.log(`⏳ Showing loading for widget: ${widgetSelector}`);
    const widget = document.querySelector(widgetSelector);
    if (!widget) return;
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'widget-loading';
    loadingDiv.innerHTML = `
        <div class="widget-loader">
            <div class="pixel-spinner"></div>
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
    console.log(`✅ Hiding loading for widget: ${widgetSelector}`);
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
// STARS ANIMATION
// ========================================
function createStars() {
    console.log('⭐ Creating background stars animation...');
    const starsContainer = document.querySelector('.stars');
    if (!starsContainer) return;

    const starCount = 50;
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        const size = Math.random() * 3 + 1;
        star.style.width = size + 'px';
        star.style.height = size + 'px';
        star.style.animationDelay = Math.random() * 2 + 's';
        starsContainer.appendChild(star);
    }
    console.log(`✅ Created ${starCount} background stars`);
}

function enhanceStars() {
    const stars = document.querySelectorAll('.star');
    stars.forEach((star, index) => {
        star.style.animationDuration = `${(index % 3 === 0 ? 4 : (index % 2 === 0 ? 2.5 : 3))}s`;
    });
    console.log(`✨ Enhanced ${stars.length} stars with varied animations`);
}

// ========================================
// USER PROFILE AND DATA MANAGEMENT
// ========================================

async function loadUserProfile() {
    console.log('👤 Loading user profile...');
    const userId = getCurrentUserId();
    if (!userId) {
        console.warn('⚠️ No user ID found, redirecting to auth...');
        window.location.href = '../auth/auth.html';
        return null;
    }

    try {
        console.log(`🌐 Fetching user profile for ID: ${userId}`);
        const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            if (response.status === 404) {
                console.error('❌ User not found (404), clearing localStorage and redirecting...');
                localStorage.removeItem('userData');
                window.location.href = '../auth/auth.html';
            } else {
                throw new Error(`Failed to fetch user profile: ${response.status}`);
            }
            return null;
        }

        const userData = await response.json();
        console.log('✅ User profile loaded successfully:', userData.data);
        localStorage.setItem('currentUserProfile', JSON.stringify(userData.data));
        return userData.data;

    } catch (error) {
        console.error('❌ Error loading user profile:', error);
        showErrorToast('Failed to load user profile');
        return null;
    }
}

function isSyncNeeded(lastSync) {
    if (!lastSync) {
        console.log('🔄 No previous sync found, sync needed');
        return true;
    }
    
    const lastSyncTime = new Date(lastSync);
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const needsSync = lastSyncTime < fifteenMinutesAgo;
    
    console.log(`🔄 Last sync: ${lastSyncTime.toISOString()}, Sync needed: ${needsSync}`);
    return needsSync;
}

// ========================================
// FITNESS DATA MANAGEMENT
// ========================================

async function fetchTodaysFitnessData(userId) {
    console.log('📊 Fetching today\'s fitness data...');
    const today = getTodayDate();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    showWidgetLoading('.steps-widget', 'Syncing steps...');
    showWidgetLoading('.heartrate-widget', 'Reading heart rate...');
    showWidgetLoading('.calorie-widget', 'Calculating calories...');
    
    try {
        console.log(`🌐 Making parallel API calls for user ${userId} from ${yesterday} to ${today}`);
        
        const [stepsResponse, heartRateResponse, caloriesResponse, summaryResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/wearable/fitness-data?dataType=steps&startDate=${yesterday}&endDate=${today}&userId=${userId}`),
            fetch(`${API_BASE_URL}/wearable/fitness-data?dataType=heartrate&startDate=${yesterday}&endDate=${today}&userId=${userId}`),
            fetch(`${API_BASE_URL}/wearable/fitness-data?dataType=calories&startDate=${yesterday}&endDate=${today}&userId=${userId}`),
            fetch(`${API_BASE_URL}/wearable/health-summary?userId=${userId}`)
        ]);

        console.log('📡 API responses received, processing data...');
        
        const [stepsData, heartRateData, caloriesData, summaryData] = await Promise.all([
            stepsResponse.ok ? stepsResponse.json() : null,
            heartRateResponse.ok ? heartRateResponse.json() : null,
            caloriesResponse.ok ? caloriesResponse.json() : null,
            summaryResponse.ok ? summaryResponse.json() : null
        ]);

        // Log data quality
        console.log('📈 Steps data:', stepsData ? `${stepsData.count} records` : 'No data');
        console.log('💓 Heart rate data:', heartRateData ? `${heartRateData.count} records` : 'No data');
        console.log('🔥 Calories data:', caloriesData ? `${caloriesData.count} records` : 'No data');
        console.log('📋 Summary data:', summaryData ? 'Available' : 'No data');

        // Focus on today's data specifically
        const todaysData = {
            steps: getTodaysDataFromSet(stepsData, today),
            heartRate: getTodaysDataFromSet(heartRateData, today),
            calories: getTodaysDataFromSet(caloriesData, today),
            summary: summaryData
        };

        console.log('🎯 Today\'s focused data prepared, updating dashboard...');
        updateDashboardWithTodaysData(todaysData);

        // Hide loading states
        hideWidgetLoading('.steps-widget');
        hideWidgetLoading('.heartrate-widget');
        hideWidgetLoading('.calorie-widget');

    } catch (error) {
        console.error('❌ Error fetching today\'s fitness data:', error);
        showErrorToast('Failed to fetch fitness data');
        
        // Hide loading states even on error
        hideWidgetLoading('.steps-widget');
        hideWidgetLoading('.heartrate-widget');
        hideWidgetLoading('.calorie-widget');
    }
}

function getTodaysDataFromSet(dataSet, todayDate) {
    if (!dataSet || !dataSet.data) {
        console.warn('⚠️ No data set provided');
        return null;
    }
    
    // Find today's specific data
    const todaysEntry = dataSet.data.find(entry => entry.date === todayDate);
    const recentEntries = dataSet.data.slice(-7); // Last 7 days for trends
    
    console.log(`📅 Today's entry for ${todayDate}:`, todaysEntry || 'Not found');
    console.log(`📊 Recent entries (${recentEntries.length} days):`, recentEntries.map(e => `${e.date}: ${e.value}`));
    
    return {
        today: todaysEntry,
        recent: recentEntries,
        all: dataSet.data
    };
}

async function getStoredOrFetchData(userId, dataType, days = 7) {
    console.log(`🗃️ Getting ${dataType} data for ${days} days...`);
    
    try {
        // Try stored data first
        console.log(`🔍 Checking stored ${dataType} data...`);
        const storedResponse = await fetch(`${API_BASE_URL}/wearable/stored-data/${dataType}/${userId}?days=${days}`);
        
        if (storedResponse.ok) {
            const storedData = await storedResponse.json();
            if (storedData.count > 0) {
                console.log(`✅ Found ${storedData.count} stored ${dataType} records`);
                return storedData;
            }
        }
        
        // Fetch from Google Fit API if no stored data
        console.log(`🌐 Fetching ${dataType} from Google Fit API...`);
        const today = getTodayDate();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];
        
        const apiResponse = await fetch(`${API_BASE_URL}/wearable/fitness-data?dataType=${dataType}&startDate=${startDateStr}&endDate=${today}&userId=${userId}`);
        
        if (apiResponse.ok) {
            const apiData = await apiResponse.json();
            console.log(`✅ Fetched ${apiData.count || 0} ${dataType} records from API`);
            return apiData;
        }
        
    } catch (error) {
        console.error(`❌ Error getting ${dataType} data:`, error);
    }
    
    console.warn(`⚠️ No ${dataType} data available`);
    return null;
}

// ========================================
// UI UPDATE FUNCTIONS
// ========================================

function updateUserDataWidget(userData) {
    console.log('👤 Updating user data widget...');
    
    const userNameElement = document.querySelector('.user-name');
    const userEmailElement = document.querySelector('.user-email');
    const userAvatarElement = document.querySelector('.user-avatar');
    
    if (userNameElement && userData.firstName && userData.lastName) {
        const fullName = `${userData.firstName.toUpperCase()} ${userData.lastName.toUpperCase()}`;
        userNameElement.textContent = fullName;
        console.log('✅ Updated user name:', fullName);
    }
    
    if (userEmailElement && userData.email) {
        userEmailElement.textContent = userData.email;
        console.log('✅ Updated user email:', userData.email);
    }
    
    if (userAvatarElement && userData.firstName && userData.lastName) {
        const initials = `${userData.firstName.charAt(0)}${userData.lastName.charAt(0)}`;
        userAvatarElement.textContent = initials;
        console.log('✅ Updated user avatar:', initials);
    }
    
    const deviceNameElement = document.querySelector('.device-name-main');
    const deviceStatusElement = document.querySelector('.device-status-main');
    
    if (deviceNameElement) {
        const deviceName = userData.deviceName || 'GOOGLE FIT CONNECTED';
        deviceNameElement.textContent = deviceName;
        console.log('✅ Updated device name:', deviceName);
    }
    
    if (deviceStatusElement) {
        const lastSync = userData.last_sync;
        const syncStatus = lastSync ? `SYNCED ${getTimeAgo(new Date(lastSync))}` : 'NEVER SYNCED';
        deviceStatusElement.textContent = syncStatus;
        console.log('✅ Updated sync status:', syncStatus);
    }
}

function updateDashboardWithTodaysData(todaysData) {
    console.log('🎯 Updating dashboard with today\'s focused data...');
    
    if (todaysData.steps) {
        console.log('👟 Updating steps widget with today\'s data...');
        updateTodaysStepsWidget(todaysData.steps);
    }
    
    if (todaysData.heartRate) {
        console.log('💓 Updating heart rate widget with today\'s data...');
        updateTodaysHeartRateWidget(todaysData.heartRate);
    }
    
    if (todaysData.calories) {
        console.log('🔥 Updating calories widget with today\'s data...');
        updateTodaysCaloriesWidget(todaysData.calories);
    }
    
    if (todaysData.summary && todaysData.summary.summary) {
        console.log('📋 Enhancing widgets with summary data...');
        enhanceWidgetsWithSummary(todaysData.summary.summary);
    }
    
    console.log('✅ Dashboard update complete!');
}

function updateTodaysStepsWidget(stepsData) {
    let currentSteps = 0;
    
    // Prioritize today's data
    if (stepsData.today && stepsData.today.value > 0) {
        currentSteps = stepsData.today.value;
        console.log(`📅 Using today's steps: ${currentSteps}`);
    } else if (stepsData.recent && stepsData.recent.length > 0) {
        // Fallback to most recent data
        const recentSteps = stepsData.recent.filter(day => day.value > 0);
        if (recentSteps.length > 0) {
            currentSteps = recentSteps[recentSteps.length - 1].value;
            console.log(`📊 Using most recent steps: ${currentSteps}`);
        }
    }
    
    const goalSteps = 10000;
    const percentage = Math.min(100, Math.round((currentSteps / goalSteps) * 100));
    
    console.log(`👟 Steps update: ${currentSteps}/${goalSteps} (${percentage}%)`);
    
    const stepsNumberElement = document.querySelector('.steps-widget .stat-number');
    const stepsProgressElement = document.querySelector('.steps-widget .progress-text');
    const stepsCircleElement = document.querySelector('.steps-progress-circular');
    
    if (stepsNumberElement) {
        stepsNumberElement.textContent = currentSteps.toLocaleString();
    }
    
    if (stepsProgressElement) {
        stepsProgressElement.textContent = `${percentage}% OF GOAL (${goalSteps.toLocaleString()})`;
    }
    
    if (stepsCircleElement) {
        const circumference = 314;
        const offset = circumference - (percentage / 100) * circumference;
        stepsCircleElement.style.strokeDashoffset = offset;
    }
    
    // Update recommendation based on today's progress
    updateStepsRecommendation(percentage, goalSteps - currentSteps);
}

function updateTodaysHeartRateWidget(heartRateData) {
    let currentBPM = 0;
    
    // Prioritize today's data
    if (heartRateData.today && heartRateData.today.value > 0) {
        currentBPM = heartRateData.today.value;
        console.log(`📅 Using today's heart rate: ${currentBPM} BPM`);
    } else if (heartRateData.recent && heartRateData.recent.length > 0) {
        const recentHR = heartRateData.recent.filter(day => day.value > 0);
        if (recentHR.length > 0) {
            currentBPM = recentHR[recentHR.length - 1].value;
            console.log(`📊 Using most recent heart rate: ${currentBPM} BPM`);
        }
    }
    
    const hrNumberElement = document.querySelector('.heartrate-widget .stat-number');
    if (hrNumberElement) {
        hrNumberElement.textContent = currentBPM > 0 ? currentBPM : '--';
    }
    
    // Update heart rate chart with recent trend data
    if (heartRateData.recent && heartRateData.recent.length > 0) {
        const recentHR = heartRateData.recent.filter(day => day.value > 0);
        if (recentHR.length > 0) {
            console.log(`📈 Creating heart rate chart with ${recentHR.length} data points`);
            createHeartRateChartWithRealData(recentHR);
        }
    }
    
    // Update recommendation based on current heart rate
    updateHeartRateRecommendation(currentBPM);
}

function updateTodaysCaloriesWidget(caloriesData) {
    let currentCalories = 0;
    
    // Prioritize today's data
    if (caloriesData.today && caloriesData.today.value > 0) {
        currentCalories = caloriesData.today.value;
        console.log(`📅 Using today's calories: ${currentCalories}`);
    } else if (caloriesData.recent && caloriesData.recent.length > 0) {
        const recentCalories = caloriesData.recent.filter(day => day.value > 0);
        if (recentCalories.length > 0) {
            currentCalories = recentCalories[recentCalories.length - 1].value;
            console.log(`📊 Using most recent calories: ${currentCalories}`);
        }
    }
    
    const goalCalories = 2500;
    const percentage = Math.min(100, Math.round((currentCalories / goalCalories) * 100));
    
    console.log(`🔥 Calories update: ${currentCalories}/${goalCalories} (${percentage}%)`);
    
    const caloriesNumberElement = document.querySelector('.calorie-widget .stat-number');
    const caloriesProgressElement = document.querySelector('.calorie-widget .progress-text');
    
    if (caloriesNumberElement) {
        caloriesNumberElement.textContent = currentCalories.toLocaleString();
    }
    
    if (caloriesProgressElement) {
        caloriesProgressElement.textContent = `${percentage}% OF GOAL (${goalCalories.toLocaleString()})`;
    }
    
    // Update calories pie chart
    createCalorieChartWithRealData(percentage);
    
    // Update recommendation based on today's progress
    updateCaloriesRecommendation(percentage, goalCalories - currentCalories);
}

function enhanceWidgetsWithSummary(summaryData) {
    console.log('📋 Enhancing widgets with summary data...');
    
    // Update heart rate stats with averages
    if (summaryData.heartRate) {
        const restingElement = document.querySelector('.heart-stats .heart-stat:first-child .heart-value');
        const maxElement = document.querySelector('.heart-stats .heart-stat:last-child .heart-value');
        
        if (restingElement && summaryData.heartRate.lowest) {
            restingElement.textContent = `${summaryData.heartRate.lowest} BPM`;
            console.log(`✅ Updated resting HR: ${summaryData.heartRate.lowest} BPM`);
        }
        
        if (maxElement && summaryData.heartRate.highest) {
            maxElement.textContent = `${summaryData.heartRate.highest} BPM`;
            console.log(`✅ Updated max HR: ${summaryData.heartRate.highest} BPM`);
        }
    }
}

// ========================================
// RECOMMENDATION UPDATES
// ========================================

function updateStepsRecommendation(percentage, stepsRemaining) {
    const recElement = document.querySelector('.steps-widget .widget-recommendation');
    if (!recElement) return;
    
    const titleElement = recElement.querySelector('.rec-title');
    const textElement = recElement.querySelector('.rec-text');
    
    if (percentage >= 100) {
        titleElement.textContent = 'GOAL ACHIEVED!';
        textElement.textContent = 'GREAT JOB! YOU\'VE REACHED YOUR DAILY STEP GOAL';
        console.log('🏆 Steps goal achieved!');
    } else if (percentage >= 80) {
        titleElement.textContent = 'ALMOST THERE!';
        textElement.textContent = `TAKE A ${Math.ceil(stepsRemaining/100)*5}-MINUTE WALK TO REACH YOUR GOAL`;
        console.log(`🚶 Steps recommendation: ${Math.ceil(stepsRemaining/100)*5}-minute walk`);
    } else if (percentage >= 50) {
        titleElement.textContent = 'KEEP MOVING!';
        textElement.textContent = `${stepsRemaining.toLocaleString()} STEPS TO GO - YOU CAN DO IT!`;
        console.log(`🏃 Steps encouragement: ${stepsRemaining} steps remaining`);
    } else {
        titleElement.textContent = 'GET STARTED!';
        textElement.textContent = 'BEGIN WITH A SHORT 10-MINUTE WALK TO BUILD MOMENTUM';
        console.log('🚀 Steps motivation: Get started message');
    }
}

function updateHeartRateRecommendation(currentBPM) {
    const recElement = document.querySelector('.heartrate-widget .widget-recommendation');
    if (!recElement) return;
    
    const titleElement = recElement.querySelector('.rec-title');
    const textElement = recElement.querySelector('.rec-text');
    
    if (currentBPM > 100) {
        titleElement.textContent = 'ELEVATED HEART RATE';
        textElement.textContent = 'CONSIDER RESTING AND STAYING HYDRATED';
        console.log('⚠️ High heart rate detected');
    } else if (currentBPM > 80) {
        titleElement.textContent = 'STAY HYDRATED';
        textElement.textContent = 'YOUR HEART RATE IS SLIGHTLY ELEVATED - DRINK MORE WATER';
        console.log('💧 Moderate heart rate - hydration reminder');
    } else if (currentBPM > 0) {
        titleElement.textContent = 'HEALTHY RANGE';
        textElement.textContent = 'YOUR HEART RATE IS IN A GOOD RANGE TODAY';
        console.log('✅ Heart rate in healthy range');
    } else {
        titleElement.textContent = 'NO DATA';
        textElement.textContent = 'SYNC YOUR DEVICE TO SEE HEART RATE TRENDS';
        console.log('📱 No heart rate data available');
    }
}

function updateCaloriesRecommendation(percentage, caloriesRemaining) {
    const recElement = document.querySelector('.calorie-widget .widget-recommendation');
    if (!recElement) return;
    
    const titleElement = recElement.querySelector('.rec-title');
    const textElement = recElement.querySelector('.rec-text');
    
    if (percentage >= 100) {
        titleElement.textContent = 'GOAL REACHED!';
        textElement.textContent = 'EXCELLENT WORK ON YOUR CALORIE BURN TODAY!';
        console.log('🔥 Calories goal achieved!');
    } else if (percentage >= 75) {
        titleElement.textContent = 'ALMOST THERE!';
        textElement.textContent = 'ADD 15 MINUTES OF ACTIVITY TO REACH YOUR GOAL';
        console.log('🏃 Close to calories goal');
    } else if (percentage >= 50) {
        titleElement.textContent = 'BOOST YOUR BURN';
        textElement.textContent = 'ADD 20 MINUTES OF CARDIO TO REACH YOUR CALORIE GOAL';
        console.log('💪 Moderate progress on calories');
    } else {
        titleElement.textContent = 'GET ACTIVE';
        textElement.textContent = 'START WITH LIGHT EXERCISE TO INCREASE CALORIE BURN';
        console.log('🚀 Low calories - motivation needed');
    }
}

// ========================================
// GOOGLE FIT CONNECTION
// ========================================

function displayConnectGoogleFitPrompt(userId) {
    console.log('🔗 Displaying Google Fit connection prompt...');
    
    const promptDiv = document.getElementById('googleFitPrompt');
    const connectButton = document.getElementById('connectGoogleFitBtn');

    if (!promptDiv || !connectButton) {
        createDynamicGoogleFitPrompt(userId);
        return;
    }

    promptDiv.style.display = 'block';
    connectButton.onclick = async () => {
        try {
            console.log('🔄 Initiating Google Fit connection...');
            connectButton.disabled = true;
            connectButton.textContent = 'Connecting...';
            
            const response = await fetch(`${API_BASE_URL}/wearable/auth/google?userId=${userId}`, {
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.authUrl) {
                console.log('✅ Auth URL received, redirecting to Google...');
                localStorage.setItem('oauthUserId', userId);
                window.location.href = data.authUrl;
            } else {
                console.error('❌ No auth URL in response');
                showErrorToast('Failed to get Google Fit auth URL.');
                connectButton.disabled = false;
                connectButton.textContent = 'Connect Google Fit';
            }
        } catch (error) {
            console.error('❌ Error initiating Google Fit connection:', error);
            showErrorToast('Error connecting Google Fit.');
            connectButton.disabled = false;
            connectButton.textContent = 'Connect Google Fit';
        }
    };
}

function createDynamicGoogleFitPrompt(userId) {
    console.log('🔗 Creating dynamic Google Fit prompt...');
    
    const menuContent = document.querySelector('.menu-content');
    if (!menuContent) return;
    
    const promptHTML = `
        <div id="dynamicGoogleFitPrompt" class="widget-recommendation" style="margin: 20px 0; padding: 15px; background: #2a2a2a; border: 2px solid #4CAF50; border-radius: 8px;">
            <div class="rec-icon">🔗</div>
            <div class="rec-content">
                <span class="rec-title">CONNECT GOOGLE FIT</span>
                <span class="rec-text">Connect your Google Fit account to sync your health data automatically.</span>
                <button id="dynamicConnectGoogleFitBtn" class="pixel-button" style="width: auto; margin-top: 10px; background: #4CAF50; border: none; padding: 8px 16px; color: white; cursor: pointer;">
                    Connect Google Fit
                </button>
            </div>
        </div>
    `;
    
    menuContent.insertAdjacentHTML('beforeend', promptHTML);
    
    const dynamicButton = document.getElementById('dynamicConnectGoogleFitBtn');
    if (dynamicButton) {
        dynamicButton.onclick = async () => {
            try {
                console.log('🔄 Initiating Google Fit connection (dynamic)...');
                dynamicButton.disabled = true;
                dynamicButton.textContent = 'Connecting...';
                
                const response = await fetch(`${API_BASE_URL}/wearable/auth/google?userId=${userId}`, {
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const data = await response.json();
                
                if (data.authUrl) {
                    console.log('✅ Auth URL received, redirecting to Google...');
                    localStorage.setItem('oauthUserId', userId);
                    window.location.href = data.authUrl;
                } else {
                    console.error('❌ No auth URL in response');
                    showErrorToast('Failed to get Google Fit auth URL.');
                    dynamicButton.disabled = false;
                    dynamicButton.textContent = 'Connect Google Fit';
                }
            } catch (error) {
                console.error('❌ Error initiating Google Fit connection:', error);
                showErrorToast('Error connecting Google Fit.');
                dynamicButton.disabled = false;
                dynamicButton.textContent = 'Connect Google Fit';
            }
        };
    }
}

function handleOAuthCallback() {
    console.log('🔄 Handling OAuth callback...');
    
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const oauthSuccess = urlParams.get('oauth');
    
    if (error) {
        console.error('❌ OAuth authorization failed:', error);
        showErrorToast('OAuth authorization failed.');
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        return;
    }
    
    if (oauthSuccess === 'success') {
        console.log('✅ OAuth authorization successful!');
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        const promptDiv = document.getElementById('googleFitPrompt');
        const dynamicPromptDiv = document.getElementById('dynamicGoogleFitPrompt');
        
        if (promptDiv) promptDiv.style.display = 'none';
        if (dynamicPromptDiv) dynamicPromptDiv.style.display = 'none';
        
        showSuccessToast('Google Fit connected successfully!');
        
        console.log('🔄 Re-initializing dashboard with connected data...');
        setTimeout(() => {
            initializeDashboard();
        }, 1000);
        
        return;
    }
}

// ========================================
// CHART FUNCTIONS WITH REAL DATA
// ========================================

function createHeartRateChartWithRealData(heartRateData) {
    console.log('📈 Creating heart rate chart with real data...');
    
    const canvas = document.getElementById('heartRateChart');
    if (!canvas) {
        console.warn('⚠️ Heart rate chart canvas not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    const hrValues = heartRateData.map(day => day.value);
    const maxHR = Math.max(...hrValues, 100);
    const minHR = Math.min(...hrValues, 50);
    
    console.log(`📊 Heart rate range: ${minHR}-${maxHR} BPM (${hrValues.length} data points)`);
    
    canvas.width = 400; 
    canvas.height = 160;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    
    // Draw grid
    ctx.strokeStyle = '#333'; 
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
        const y = (canvas.height / 8) * i;
        ctx.beginPath(); 
        ctx.moveTo(0, y); 
        ctx.lineTo(canvas.width, y); 
        ctx.stroke();
    }
    for (let i = 0; i <= hrValues.length; i++) {
        const x = (canvas.width / hrValues.length) * i;
        ctx.beginPath(); 
        ctx.moveTo(x, 0); 
        ctx.lineTo(x, canvas.height); 
        ctx.stroke();
    }
    
    // Draw heart rate line with real data
    ctx.strokeStyle = '#D32F2F'; 
    ctx.lineWidth = 3;
    ctx.beginPath();
    hrValues.forEach((hr, index) => {
        const x = (canvas.width / (hrValues.length - 1)) * index;
        const y = canvas.height - ((hr - minHR) / (maxHR - minHR)) * canvas.height;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Draw data points
    ctx.fillStyle = '#D32F2F';
    hrValues.forEach((hr, index) => {
        const x = (canvas.width / (hrValues.length - 1)) * index;
        const y = canvas.height - ((hr - minHR) / (maxHR - minHR)) * canvas.height;
        ctx.fillRect(x - 3, y - 3, 6, 6);
    });
    
    console.log('✅ Heart rate chart created successfully');
}

function createCalorieChartWithRealData(percentage) {
    console.log(`🥧 Creating calorie pie chart with ${percentage}% progress...`);
    
    const canvas = document.getElementById('calorieChart');
    if (!canvas) {
        console.warn('⚠️ Calorie chart canvas not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    canvas.width = 180; 
    canvas.height = 180;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 60;
    const progress = percentage / 100;
    
    // Background circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 12;
    ctx.stroke();
    
    // Progress arc (pie chart style)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, (-Math.PI / 2) + (2 * Math.PI * progress));
    ctx.strokeStyle = '#FF5722';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Center text
    ctx.fillStyle = '#FF5722';
    ctx.font = '18px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(percentage)}%`, centerX, centerY);
    
    console.log('✅ Calorie pie chart created successfully');
}

function createSleepChart() {
    console.log('😴 Creating sleep quality chart...');
    
    const canvas = document.getElementById('sleepChart');
    if (!canvas) {
        console.warn('⚠️ Sleep chart canvas not found');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    canvas.width = 180; 
    canvas.height = 180;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 50;
    
    // Sleep donut chart with phases
    let currentAngle = -Math.PI / 2;
    
    // Deep sleep (dark blue)
    const deepAngle = 2 * Math.PI * 0.25;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + deepAngle);
    ctx.strokeStyle = '#1565C0';
    ctx.lineWidth = 20;
    ctx.stroke();
    currentAngle += deepAngle;
    
    // Light sleep (medium blue)
    const lightAngle = 2 * Math.PI * 0.55;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + lightAngle);
    ctx.strokeStyle = '#42A5F5';
    ctx.lineWidth = 20;
    ctx.stroke();
    currentAngle += lightAngle;
    
    // REM sleep (light blue)
    const remAngle = 2 * Math.PI * 0.20;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + remAngle);
    ctx.strokeStyle = '#81D4FA';
    ctx.lineWidth = 20;
    ctx.stroke();
    
    // Center text
    ctx.fillStyle = '#3F51B5';
    ctx.font = '16px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('90%', centerX, centerY - 5);
    ctx.font = '10px "Press Start 2P"';
    ctx.fillText('7.2H', centerX, centerY + 15);
    
    console.log('✅ Sleep chart created successfully');
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

function showErrorToast(message) {
    console.error("🚨 ERROR:", message);
    
    // Create and show toast notification
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">❌</span>
            <span class="toast-message">${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Remove toast after 4 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 4000);
}

function showSuccessToast(message) {
    console.log("✅ SUCCESS:", message);
    
    // Create and show success toast
    const toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">✅</span>
            <span class="toast-message">${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
}

function initializeGifIcon() {
    console.log('🎮 Initializing interactive steps icon...');
    
    const gifIcon = document.getElementById('stepsGifIcon');
    if (!gifIcon) {
        console.warn('⚠️ Steps gif icon not found');
        return;
    }

    gifIcon.addEventListener('click', function() {
        const walkingEmojis = ['🚶', '🏃', '🚶‍♂️', '🏃‍♂️', '👟', '🦶'];
        const currentEmoji = this.textContent;
        const currentIndex = walkingEmojis.indexOf(currentEmoji);
        const nextIndex = (currentIndex + 1) % walkingEmojis.length;
        this.textContent = walkingEmojis[nextIndex];
        
        this.classList.toggle('walking', walkingEmojis[nextIndex].includes('🏃'));
        console.log(`🎮 Steps icon changed to: ${walkingEmojis[nextIndex]}`);
    });
    
    console.log('✅ Interactive steps icon initialized');
}

// ========================================
// MAIN INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Dashboard loading started...');
    console.log('📅 Current date and time:', new Date().toISOString());
    
    // Show initial loading
    showGlobalLoading();
    
    // Initialize visual elements
    createStars();
    enhanceStars();
    
    // Initialize dashboard after brief delay for smooth loading
    setTimeout(() => {
        initializeDashboard();
    }, 800);
    
    // Add interactive effects to widgets
    const widgets = document.querySelectorAll('.widget');
    console.log(`🎨 Adding interactive effects to ${widgets.length} widgets...`);
    
    widgets.forEach((widget, index) => {
        widget.addEventListener('click', function() {
            console.log(`🖱️ Widget ${index + 1} clicked`);
            this.style.transform = 'scale(0.98) translateY(-8px)';
            setTimeout(() => { 
                this.style.transform = 'scale(1.02) translateY(-8px)'; 
            }, 100);
        });
    });

    // Initialize static charts and interactive elements
    createSleepChart();
    initializeGifIcon();
    
    console.log('✅ DOM content loaded and initialized');
});

async function initializeDashboard() {
    console.log('🏗️ Initializing dashboard...');
    
    try {
        // Check if this is an OAuth callback first
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('code') || urlParams.get('oauth') || urlParams.get('error')) {
            console.log('🔗 OAuth callback detected, handling...');
            handleOAuthCallback();
            return;
        }
        
        // Get and validate user ID
        const userId = getCurrentUserId();
        if (!userId) {
            console.error('❌ No user ID found, redirecting to authentication...');
            hideGlobalLoading();
            window.location.href = '../auth/auth.html';
            return;
        }
        
        console.log(`👤 Initializing dashboard for user: ${userId}`);
        
        // Load user profile
        const userData = await loadUserProfile();
        if (!userData) {
            console.error('❌ Failed to load user profile');
            hideGlobalLoading();
            return;
        }
        
        console.log('✅ User profile loaded, updating UI...');
        updateUserDataWidget(userData);
        
        // Check if Google Fit is connected
        const isGoogleFitConnected = userData.fit_tokens && userData.fit_tokens.trim() !== '';
        console.log(`🔗 Google Fit connection status: ${isGoogleFitConnected ? 'Connected' : 'Not connected'}`);
        
        if (!isGoogleFitConnected) {
            console.log('🔗 Google Fit not connected, showing connection prompt...');
            hideGlobalLoading();
            setTimeout(() => {
                displayConnectGoogleFitPrompt(userId);
            }, 100);
            return;
        }
        
        // Google Fit is connected, proceed with data loading
        console.log('📊 Google Fit connected, proceeding with data sync...');
        
        // Check if sync is needed
        const syncNeeded = isSyncNeeded(userData.last_sync);
        
        if (syncNeeded) {
            console.log('🔄 Sync needed, fetching fresh data...');
            await fetchTodaysFitnessData(userId);
        } else {
            console.log('📚 Using recent data, loading from storage/cache...');
            
            // Load existing data focusing on today
            const [stepsData, heartRateData, caloriesData] = await Promise.all([
                getStoredOrFetchData(userId, 'steps', 3),  // Last 3 days for today's focus
                getStoredOrFetchData(userId, 'heartrate', 3),  
                getStoredOrFetchData(userId, 'calories', 3)
            ]);
            
            // Process data with today's focus
            const today = getTodayDate();
            const todaysData = {
                steps: getTodaysDataFromSet(stepsData, today),
                heartRate: getTodaysDataFromSet(heartRateData, today),
                calories: getTodaysDataFromSet(caloriesData, today)
            };
            
            updateDashboardWithTodaysData(todaysData);
        }
        
        console.log('✅ Dashboard initialization complete!');
        hideGlobalLoading();
        
    } catch (error) {
        console.error('❌ Critical error during dashboard initialization:', error);
        hideGlobalLoading();
        showErrorToast('Failed to initialize dashboard. Please refresh the page.');
    }
}