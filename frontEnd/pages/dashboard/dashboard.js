// dashboard.js - Enhanced with 100% progress celebrations

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
    return today;
}

// Fetch user goals for comparison
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
        
        // Transform goals into a more usable format
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

// ========================================
// CELEBRATION EFFECTS
// ========================================

function addCelebrationEffect(widgetSelector, percentage) {
    const widget = document.querySelector(widgetSelector);
    if (!widget || percentage < 100) return;
    
    // Remove existing celebration effects
    const existingPixels = widget.querySelectorAll('.celebration-pixel');
    existingPixels.forEach(pixel => pixel.remove());
    
    // Add golden glow to percentage text specifically
    const progressText = widget.querySelector('.progress-text');
    if (progressText) {
        progressText.style.color = '#FFD700';
        progressText.style.textShadow = '0 0 10px #FFD700, 0 0 20px #FFA500';
        progressText.style.fontSize = '10px';
        progressText.style.fontWeight = 'bold';
    }
    
    // Add pixel celebration
    createPixelCelebration(widget);
}

function createPixelCelebration(widget) {
    const pixelCount = 12;
    
    for (let i = 0; i < pixelCount; i++) {
        const pixel = document.createElement('div');
        pixel.className = 'celebration-pixel';
        pixel.style.position = 'absolute';
        pixel.style.width = '4px';
        pixel.style.height = '4px';
        pixel.style.backgroundColor = '#FFD700';
        pixel.style.pointerEvents = 'none';
        pixel.style.zIndex = '100';
        pixel.style.animation = `pixelCelebration 3s ease-out ${i * 0.2}s infinite`;
        
        // Random positioning around the widget
        pixel.style.left = Math.random() * 100 + '%';
        pixel.style.top = Math.random() * 100 + '%';
        
        widget.appendChild(pixel);
    }
    
    // Add CSS animation if not already present
    if (!document.getElementById('celebrationStyles')) {
        const style = document.createElement('style');
        style.id = 'celebrationStyles';
        style.textContent = `
            @keyframes pixelCelebration {
                0% { 
                    opacity: 0; 
                    transform: scale(1) translateY(0px);
                    background-color: #FFD700;
                }
                25% { 
                    opacity: 1; 
                    transform: scale(2) translateY(-10px);
                    background-color: #FFA500;
                }
                50% { 
                    opacity: 1; 
                    transform: scale(1.5) translateY(-20px);
                    background-color: #FFD700;
                }
                75% { 
                    opacity: 0.8; 
                    transform: scale(1) translateY(-15px);
                    background-color: #FFFF00;
                }
                100% { 
                    opacity: 0; 
                    transform: scale(0.5) translateY(-30px);
                    background-color: #FFD700;
                }
            }
            
            .goal-stat.achieved {
                color: #FFD700 !important;
                text-shadow: 0 0 8px #FFD700 !important;
                font-size: 8px !important;
                animation: pixelGlow 1.5s ease-in-out infinite alternate;
            }
            
            @keyframes pixelGlow {
                0% { 
                    text-shadow: 0 0 8px #FFD700;
                    transform: scale(1);
                }
                100% { 
                    text-shadow: 0 0 15px #FFD700, 0 0 25px #FFA500;
                    transform: scale(1.05);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// ========================================
// LOADING STATE MANAGEMENT
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
                <div class="loading-subtext">CONNECTING TO YOUR WEARABLE DEVICE</div>
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
// EMPTY STATES
// ========================================

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

// ========================================
// STARS ANIMATION
// ========================================
function createStars() {
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
}

function enhanceStars() {
    const stars = document.querySelectorAll('.star');
    stars.forEach((star, index) => {
        star.style.animationDuration = `${(index % 3 === 0 ? 4 : (index % 2 === 0 ? 2.5 : 3))}s`;
    });
}

// ========================================
// USER PROFILE AND DATA MANAGEMENT
// ========================================

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

// ========================================
// API RESPONSE HANDLING
// ========================================

async function handleApiResponse(response, dataType) {
    if (!response.ok) {
        if (response.status === 401) {
            const errorData = await response.json().catch(() => ({}));
            if (errorData.redirectToAuth) {
                console.log(`Google Fit authentication required for ${dataType}`);
                showErrorToast('Google Fit authentication required. Redirecting...');
                
                setTimeout(() => {
                    window.location.href = errorData.authUrl;
                }, 2000);
                
                return null;
            }
        }
        return null;
    }
    
    const data = await response.json();
    
    if (data.stored > 0) {
        console.log(`New ${dataType} data synced: ${data.stored} records`);
        showSuccessToast(`Synced ${data.stored} new ${dataType} records`);
    }
    
    return data;
}

// ========================================
// FITNESS DATA MANAGEMENT
// ========================================

async function loadCachedData(userId) {
    try {
        const [stepsData, heartRateData, caloriesData, goalsMap] = await Promise.all([
            getStoredOrFetchData(userId, 'steps', 3),
            getStoredOrFetchData(userId, 'heartrate', 3),
            getStoredOrFetchData(userId, 'calories', 3),
            fetchUserGoalsWithProgress()
        ]);
        
        const today = getTodayDate();
        const todaysData = {
            steps: getTodaysDataFromSet(stepsData, today),
            heartRate: getTodaysDataFromSet(heartRateData, today),
            calories: getTodaysDataFromSet(caloriesData, today)
        };
        
        updateDashboardWithTodaysData(todaysData, goalsMap);
    } catch (error) {
        console.error('Failed to load cached data:', error);
        // Show empty states if even cached data fails
        showEmptyState('.steps-widget', 'STEPS', 'UNABLE TO LOAD DATA - CHECK CONNECTION');
        showEmptyState('.heartrate-widget', 'HEART RATE', 'UNABLE TO LOAD DATA - CHECK CONNECTION');
        showEmptyState('.calorie-widget', 'CALORIES', 'UNABLE TO LOAD DATA - CHECK CONNECTION');
    }
}

async function fetchTodaysFitnessData(userId) {
    const today = getTodayDate();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    showWidgetLoading('.steps-widget', 'Syncing steps...');
    showWidgetLoading('.heartrate-widget', 'Reading heart rate...');
    showWidgetLoading('.calorie-widget', 'Calculating calories...');
    
    try {
        const [stepsResponse, heartRateResponse, caloriesResponse, summaryResponse, goalsMap] = await Promise.all([
            fetch(`${API_BASE_URL}/wearable/fitness-data?dataType=steps&startDate=${yesterday}&endDate=${today}&userId=${userId}`),
            fetch(`${API_BASE_URL}/wearable/fitness-data?dataType=heartrate&startDate=${yesterday}&endDate=${today}&userId=${userId}`),
            fetch(`${API_BASE_URL}/wearable/fitness-data?dataType=calories&startDate=${yesterday}&endDate=${today}&userId=${userId}`),
            fetch(`${API_BASE_URL}/wearable/health-summary?userId=${userId}`),
            fetchUserGoalsWithProgress()
        ]);

        const [stepsData, heartRateData, caloriesData, summaryData] = await Promise.all([
            handleApiResponse(stepsResponse, 'steps'),
            handleApiResponse(heartRateResponse, 'heartrate'),
            handleApiResponse(caloriesResponse, 'calories'),
            summaryResponse.ok ? summaryResponse.json() : null
        ]);

        // Focus on today's data specifically
        const todaysData = {
            steps: getTodaysDataFromSet(stepsData, today),
            heartRate: getTodaysDataFromSet(heartRateData, today),
            calories: getTodaysDataFromSet(caloriesData, today),
            summary: summaryData
        };

        updateDashboardWithTodaysData(todaysData, goalsMap);

        hideWidgetLoading('.steps-widget');
        hideWidgetLoading('.heartrate-widget');
        hideWidgetLoading('.calorie-widget');

    } catch (error) {
        console.error('Error fetching fitness data:', error);
        
        hideWidgetLoading('.steps-widget');
        hideWidgetLoading('.heartrate-widget');
        hideWidgetLoading('.calorie-widget');
        
        // Re-throw the error so it can be caught by the calling function
        throw error;
    }
}

function getTodaysDataFromSet(dataSet, todayDate) {
    if (!dataSet || !dataSet.data || dataSet.data.length === 0) {
        return null;
    }
    
    const todaysEntry = dataSet.data.find(entry => entry.date === todayDate);
    const recentEntries = dataSet.data.slice(-7);
    
    // If no today's data, use the latest available entry as fallback
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

// ========================================
// UI UPDATE FUNCTIONS
// ========================================

function updateUserDataWidget(userData) {
    // Update user name with real data
    const userNameElements = document.querySelectorAll('.user-name');
    userNameElements.forEach(element => {
        if (userData.firstName && userData.lastName) {
            const fullName = `${userData.firstName.toUpperCase()} ${userData.lastName.toUpperCase()}`;
            element.textContent = fullName;
        }
    });

    const userEmailElement = document.querySelector('.user-email');
    if (userEmailElement && userData.email) {
        userEmailElement.textContent = userData.email;
    }
    
    // Update user avatar with real initials
    const userAvatarElements = document.querySelectorAll('.user-avatar');
    userAvatarElements.forEach(element => {
        if (userData.firstName && userData.lastName) {
            const initials = `${userData.firstName.charAt(0)}${userData.lastName.charAt(0)}`;
            element.textContent = initials;
        }
    });
    
    // Update device info with device name
    const deviceNameElement = document.querySelector('.device-name-main');
    const deviceStatusElement = document.querySelector('.device-status-main');
    const userStatusElements = document.querySelectorAll('.user-status');
    
    const deviceName = userData.deviceName || 'GOOGLE FIT';
    
    if (deviceNameElement) {
        deviceNameElement.textContent = deviceName;
    }
    
    if (deviceStatusElement) {
        const lastSync = userData.last_sync;
        if (lastSync) {
            const syncTime = getTimeAgo(new Date(lastSync));
            const isRecent = new Date(lastSync) > new Date(Date.now() - 15 * 60 * 1000);
            const syncStatus = isRecent ? `LIVE - ${syncTime}` : `SYNCED ${syncTime}`;
            deviceStatusElement.textContent = syncStatus;
            deviceStatusElement.style.color = isRecent ? '#4CAF50' : '#FFA500';
        } else {
            deviceStatusElement.textContent = 'NEVER SYNCED';
            deviceStatusElement.style.color = '#F44336';
        }
    }
    
    // Update nav user status with device name
    userStatusElements.forEach(element => {
        element.textContent = `${deviceName} CONNECTED`;
    });
}

function updateDashboardWithTodaysData(todaysData, goalsMap = {}) {
    console.log('Dashboard data update:', {
        hasSteps: !!todaysData.steps,
        hasHeartRate: !!todaysData.heartRate,
        hasCalories: !!todaysData.calories,
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
    
    if (todaysData.summary && todaysData.summary.summary) {
        enhanceWidgetsWithSummary(todaysData.summary.summary);
    }
    
    updateUserDataWidgetWithGoals(goalsMap, todaysData);
}

function updateTodaysStepsWidget(stepsData, goalsMap = {}) {
    let currentSteps = 0;
    let isUsingFallback = false;
    
    if (stepsData.today && stepsData.today.value > 0) {
        currentSteps = stepsData.today.value;
        isUsingFallback = stepsData.isLatestFallback;
    } else if (stepsData.recent && stepsData.recent.length > 0) {
        const recentSteps = stepsData.recent.filter(day => day.value > 0);
        if (recentSteps.length > 0) {
            currentSteps = recentSteps[recentSteps.length - 1].value;
            isUsingFallback = true;
        }
    }
    
    if (currentSteps === 0) {
        showEmptyState('.steps-widget', 'STEPS', 'NO STEP DATA AVAILABLE');
        return;
    }
    
    const goalSteps = goalsMap.steps?.target || 10000;
    const percentage = Math.min(100, Math.round((currentSteps / goalSteps) * 100));
    
    const stepsNumberElement = document.querySelector('.steps-widget .stat-number');
    const stepsProgressElement = document.querySelector('.steps-widget .progress-text');
    
    if (stepsNumberElement) {
        stepsNumberElement.textContent = currentSteps.toLocaleString();
    }
    
    if (stepsProgressElement) {
        const progressText = `${percentage}% OF GOAL (${goalSteps.toLocaleString()})`;
        const fallbackText = isUsingFallback ? ' (LATEST DATA)' : '';
        stepsProgressElement.textContent = progressText + fallbackText;
    }
    
    // Create pixelated steps progress circle
    createPixelatedStepsCircle(percentage);
    
    // Add celebration effect if 100%
    if (percentage >= 100) {
        addCelebrationEffect('.steps-widget', percentage);
    }
    
    updateStepsRecommendation(percentage, goalSteps - currentSteps, goalSteps);
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
    }
    
    if (hrProgressElement && isUsingFallback) {
        hrProgressElement.textContent = `${hrProgressElement.textContent} (LATEST DATA)`;
    }
    
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
    }
    
    if (caloriesProgressElement) {
        const progressText = `${percentage}% OF GOAL (${goalCalories.toLocaleString()})`;
        const fallbackText = isUsingFallback ? ' (LATEST DATA)' : '';
        caloriesProgressElement.textContent = progressText + fallbackText;
    }
    
    // Add celebration effect if 100%
    if (percentage >= 100) {
        addCelebrationEffect('.calorie-widget', percentage);
    }
    
    createCalorieChartWithRealData(percentage);
    updateCaloriesRecommendation(percentage, goalCalories - currentCalories, goalCalories);
}

function enhanceWidgetsWithSummary(summaryData) {
    if (summaryData.heartRate) {
        const restingElement = document.querySelector('.heart-stats .heart-stat:first-child .heart-value');
        const maxElement = document.querySelector('.heart-stats .heart-stat:last-child .heart-value');
        
        if (restingElement && summaryData.heartRate.lowest) {
            restingElement.textContent = `${summaryData.heartRate.lowest} BPM`;
        }
        
        if (maxElement && summaryData.heartRate.highest) {
            maxElement.textContent = `${summaryData.heartRate.highest} BPM`;
        }
    }
}

function updateUserDataWidgetWithGoals(goalsMap, todaysData) {
    const goalStatsElement = document.querySelector('.goal-stats');
    if (!goalStatsElement) return;
    
    const goalStats = [];
    
    // Calculate steps progress
    if (todaysData.steps && (todaysData.steps.today || todaysData.steps.recent?.length > 0)) {
        const currentSteps = todaysData.steps.today?.value || 
            (todaysData.steps.recent?.filter(d => d.value > 0).pop()?.value || 0);
        const goalSteps = goalsMap.steps?.target || 10000;
        const stepsProgress = Math.min(100, Math.round((currentSteps / goalSteps) * 100));
        
        let stepClass = 'needs-work';
        if (stepsProgress >= 100) stepClass = 'achieved';
        else if (stepsProgress >= 80) stepClass = 'close';
        
        goalStats.push({
            text: `STEPS: ${stepsProgress}%`,
            class: stepClass
        });
    }
    
    // Calculate calories progress
    if (todaysData.calories && (todaysData.calories.today || todaysData.calories.recent?.length > 0)) {
        const currentCalories = todaysData.calories.today?.value || 
            (todaysData.calories.recent?.filter(d => d.value > 0).pop()?.value || 0);
        const goalCalories = goalsMap.calories?.target || 2500;
        const caloriesProgress = Math.min(100, Math.round((currentCalories / goalCalories) * 100));
        
        let calorieClass = 'needs-work';
        if (caloriesProgress >= 100) calorieClass = 'achieved';
        else if (caloriesProgress >= 75) calorieClass = 'close';
        
        goalStats.push({
            text: `CALORIES: ${caloriesProgress}%`,
            class: calorieClass
        });
    }
    
    // Add sleep progress if available
    if (goalsMap.sleep?.target) {
        goalStats.push({
            text: `SLEEP: 90%`,
            class: 'achieved'
        });
    }
    
    goalStatsElement.innerHTML = goalStats.map(stat => 
        `<span class="goal-stat ${stat.class}">${stat.text}</span>`
    ).join('');
}

// ========================================
// RECOMMENDATION UPDATES
// ========================================

function updateStepsRecommendation(percentage, stepsRemaining, goalSteps) {
    const recElement = document.querySelector('.steps-widget .widget-recommendation');
    if (!recElement) return;
    
    const titleElement = recElement.querySelector('.rec-title');
    const textElement = recElement.querySelector('.rec-text');
    
    if (percentage >= 100) {
        titleElement.textContent = 'GOAL ACHIEVED!';
        textElement.textContent = 'GREAT JOB! YOU\'VE REACHED YOUR DAILY STEP GOAL';
    } else if (percentage >= 80) {
        const walkMinutes = Math.ceil(stepsRemaining / 100) * 5;
        titleElement.textContent = 'ALMOST THERE!';
        textElement.textContent = `TAKE A ${walkMinutes}-MINUTE WALK TO REACH YOUR GOAL`;
    } else if (percentage >= 50) {
        titleElement.textContent = 'KEEP MOVING!';
        textElement.textContent = `${stepsRemaining.toLocaleString()} STEPS TO GO - YOU CAN DO IT!`;
    } else {
        titleElement.textContent = 'GET STARTED!';
        textElement.textContent = 'BEGIN WITH A SHORT 10-MINUTE WALK TO BUILD MOMENTUM';
    }
}

function updateHeartRateRecommendation(currentBPM, targetBPM = null) {
    const recElement = document.querySelector('.heartrate-widget .widget-recommendation');
    if (!recElement) return;
    
    const titleElement = recElement.querySelector('.rec-title');
    const textElement = recElement.querySelector('.rec-text');
    
    if (targetBPM && currentBPM > 0) {
        if (currentBPM <= targetBPM) {
            titleElement.textContent = 'TARGET ACHIEVED';
            textElement.textContent = `YOUR HEART RATE IS WITHIN YOUR TARGET OF ${targetBPM} BPM`;
        } else {
            titleElement.textContent = 'ABOVE TARGET';
            textElement.textContent = `CONSIDER RESTING - TARGET IS ${targetBPM} BPM`;
        }
    } else {
        if (currentBPM > 100) {
            titleElement.textContent = 'ELEVATED HEART RATE';
            textElement.textContent = 'CONSIDER RESTING AND STAYING HYDRATED';
        } else if (currentBPM > 80) {
            titleElement.textContent = 'STAY HYDRATED';
            textElement.textContent = 'YOUR HEART RATE IS SLIGHTLY ELEVATED - DRINK MORE WATER';
        } else if (currentBPM > 0) {
            titleElement.textContent = 'HEALTHY RANGE';
            textElement.textContent = 'YOUR HEART RATE IS IN A GOOD RANGE TODAY';
        } else {
            titleElement.textContent = 'NO DATA';
            textElement.textContent = 'SYNC YOUR DEVICE TO SEE HEART RATE TRENDS';
        }
    }
}

function updateCaloriesRecommendation(percentage, caloriesRemaining, goalCalories) {
    const recElement = document.querySelector('.calorie-widget .widget-recommendation');
    if (!recElement) return;
    
    const titleElement = recElement.querySelector('.rec-title');
    const textElement = recElement.querySelector('.rec-text');
    
    if (percentage >= 100) {
        titleElement.textContent = 'GOAL REACHED!';
        textElement.textContent = 'EXCELLENT WORK ON YOUR CALORIE BURN TODAY!';
    } else if (percentage >= 75) {
        titleElement.textContent = 'ALMOST THERE!';
        textElement.textContent = 'ADD 15 MINUTES OF ACTIVITY TO REACH YOUR GOAL';
    } else if (percentage >= 50) {
        titleElement.textContent = 'BOOST YOUR BURN';
        textElement.textContent = 'ADD 20 MINUTES OF CARDIO TO REACH YOUR CALORIE GOAL';
    } else {
        titleElement.textContent = 'GET ACTIVE';
        textElement.textContent = 'START WITH LIGHT EXERCISE TO INCREASE CALORIE BURN';
    }
}

// ========================================
// GOOGLE FIT CONNECTION
// ========================================

function displayConnectGoogleFitPrompt(userId) {
    const promptDiv = document.getElementById('googleFitPrompt');
    const connectButton = document.getElementById('connectGoogleFitBtn');

    if (!promptDiv || !connectButton) {
        createDynamicGoogleFitPrompt(userId);
        return;
    }

    promptDiv.style.display = 'block';
    connectButton.onclick = async () => {
        try {
            connectButton.disabled = true;
            connectButton.textContent = 'Connecting...';
            
            const response = await fetch(`${API_BASE_URL}/wearable/auth/google?userId=${userId}`, {
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.authUrl) {
                localStorage.setItem('oauthUserId', userId);
                window.location.href = data.authUrl;
            } else {
                showErrorToast('Failed to get Google Fit auth URL.');
                connectButton.disabled = false;
                connectButton.textContent = 'Connect Google Fit';
            }
        } catch (error) {
            console.error('Error connecting Google Fit:', error);
            showErrorToast('Error connecting Google Fit.');
            connectButton.disabled = false;
            connectButton.textContent = 'Connect Google Fit';
        }
    };
}

function createDynamicGoogleFitPrompt(userId) {
    const menuContent = document.querySelector('.menu-content');
    if (!menuContent) return;
    
    const promptHTML = `
        <div id="dynamicGoogleFitPrompt" class="widget-recommendation" style="margin: 20px 0; padding: 15px; background: #2a2a2a; border: 2px solid #4CAF50; border-radius: 8px;">
            <div class="rec-icon">🔗</div>
            <div class="rec-content">
                <span class="rec-title">CONNECT GOOGLE FIT</span>
                <span class="rec-text">Connect your Google Fit account to sync your health data automatically.</span>
                <button id="dynamicConnectGoogleFitBtn" class="button" style="width: auto; margin-top: 10px; background: #4CAF50; border: none; padding: 8px 16px; color: white; cursor: pointer;">
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
                dynamicButton.disabled = true;
                dynamicButton.textContent = 'Connecting...';
                
                const response = await fetch(`${API_BASE_URL}/wearable/auth/google?userId=${userId}`, {
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const data = await response.json();
                
                if (data.authUrl) {
                    localStorage.setItem('oauthUserId', userId);
                    window.location.href = data.authUrl;
                } else {
                    showErrorToast('Failed to get Google Fit auth URL.');
                    dynamicButton.disabled = false;
                    dynamicButton.textContent = 'Connect Google Fit';
                }
            } catch (error) {
                console.error('Error connecting Google Fit:', error);
                showErrorToast('Error connecting Google Fit.');
                dynamicButton.disabled = false;
                dynamicButton.textContent = 'Connect Google Fit';
            }
        };
    }
}

function handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const oauthSuccess = urlParams.get('oauth');
    
    if (error) {
        console.error('OAuth authorization failed:', error);
        showErrorToast('OAuth authorization failed.');
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        return;
    }
    
    if (oauthSuccess === 'success') {
        console.log('Google Fit connected successfully');
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        const promptDiv = document.getElementById('googleFitPrompt');
        const dynamicPromptDiv = document.getElementById('dynamicGoogleFitPrompt');
        
        if (promptDiv) promptDiv.style.display = 'none';
        if (dynamicPromptDiv) dynamicPromptDiv.style.display = 'none';
        
        showSuccessToast('Google Fit connected successfully!');
        
        setTimeout(() => {
            initializeDashboard(true); // Force sync after OAuth
        }, 1000);
        
        return;
    }
}

// ========================================
// CHART FUNCTIONS WITH REAL DATA
// ========================================

function createHeartRateChartWithRealData(heartRateData) {
    const canvas = document.getElementById('heartRateChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const hrValues = heartRateData.map(day => day.value);
    const maxHR = Math.max(...hrValues, 100);
    const minHR = Math.min(...hrValues, 50);
    
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
}

// ========================================
// PIXELATED STEPS CIRCLE
// ========================================

function createPixelatedStepsCircle(percentage) {
    const container = document.querySelector('.steps-widget .circular-progress-container');
    if (!container) return;
    
    // Clear existing canvas if any
    const existingCanvas = container.querySelector('#stepsCanvas');
    if (existingCanvas) {
        existingCanvas.remove();
    }
    
    // Create new canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'stepsCanvas';
    canvas.width = 140;
    canvas.height = 140;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.imageRendering = 'pixelated';
    canvas.style.imageRendering = '-moz-crisp-edges';
    canvas.style.imageRendering = 'crisp-edges';
    
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const outerRadius = 60;
    const innerRadius = 45;
    const progress = percentage / 100;
    
    // Draw pixelated background ring
    drawPixelatedRing(ctx, centerX, centerY, outerRadius, innerRadius, '#333', 2 * Math.PI);
    
    // Draw pixelated progress ring
    const progressAngle = 2 * Math.PI * progress;
    drawPixelatedRing(ctx, centerX, centerY, outerRadius, innerRadius, '#388E3C', progressAngle, -Math.PI / 2);
    
    // Add pixel effects for high percentages
    if (percentage > 80) {
        drawPixelStepEffects(ctx, centerX, centerY, outerRadius + 5, Math.floor(percentage / 25));
    }
    
    container.appendChild(canvas);
}

function drawPixelatedRing(ctx, centerX, centerY, outerRadius, innerRadius, color, angle, startAngle = 0) {
    const pixelSize = 4;
    ctx.fillStyle = color;
    
    for (let a = 0; a < angle; a += 0.04) {
        const currentAngle = startAngle + a;
        for (let r = innerRadius; r < outerRadius; r += pixelSize) {
            const x = centerX + Math.cos(currentAngle) * r;
            const y = centerY + Math.sin(currentAngle) * r;
            ctx.fillRect(Math.floor(x/pixelSize) * pixelSize, Math.floor(y/pixelSize) * pixelSize, pixelSize, pixelSize);
        }
    }
}

function drawPixelStepEffects(ctx, centerX, centerY, radius, effectCount) {
    const colors = ['#388E3C', '#66BB6A', '#4CAF50'];
    
    for (let i = 0; i < effectCount; i++) {
        const angle = (2 * Math.PI / effectCount) * i;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        ctx.fillStyle = colors[i % colors.length];
        
        // Draw clean step pixels in a pattern
        for (let j = 0; j < 3; j++) {
            const stepX = x + (j - 1) * 4;
            const stepY = y - j * 2;
            ctx.fillRect(Math.floor(stepX), Math.floor(stepY), 3, 3);
        }
    }
}

// ========================================
// UPDATED CHART FUNCTIONS - CLEANER PIXEL STYLE
// ========================================

function createCalorieChartWithRealData(percentage) {
    const canvas = document.getElementById('calorieChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    canvas.width = 180; 
    canvas.height = 180;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 65;
    const progress = percentage / 100;
    
    // Draw pixelated background circle
    drawPixelatedCircle(ctx, centerX, centerY, radius, '#333', 6);
    
    // Draw pixelated progress arc
    const progressAngle = 2 * Math.PI * progress;
    drawPixelatedArc(ctx, centerX, centerY, radius, progressAngle, '#FF5722', 6);
    
    // Add pixel flame effects for high percentages
    if (percentage > 75) {
        drawPixelFlameEffects(ctx, centerX, centerY, radius + 10, Math.floor(percentage / 20));
    }
    
    // Center text without background boxes
    ctx.fillStyle = percentage >= 100 ? '#FFD700' : '#FF5722';
    ctx.font = '14px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(percentage)}%`, centerX, centerY + 5);
}

function createSleepChart() {
    const canvas = document.getElementById('sleepChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    canvas.width = 180; 
    canvas.height = 180;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const outerRadius = 65;
    const innerRadius = 35;
    
    // Sleep phase data with cleaner colors
    const phases = [
        { percentage: 0.30, color: '#1565C0', name: 'DEEP' },   // Deep sleep - darker blue
        { percentage: 0.50, color: '#42A5F5', name: 'LIGHT' },  // Light sleep - medium blue  
        { percentage: 0.20, color: '#81D4FA', name: 'REM' }     // REM sleep - light blue
    ];
    
    let currentAngle = -Math.PI / 2; // Start from top
    
    // Draw each sleep phase as clean pixel segments
    phases.forEach((phase, index) => {
        const phaseAngle = 2 * Math.PI * phase.percentage;
        drawPixelatedDonutSegment(ctx, centerX, centerY, outerRadius, innerRadius, phase.color, phaseAngle, currentAngle);
        currentAngle += phaseAngle;
    });
    
    // Add subtle pixel decorations around the donut
    drawSleepPixelStars(ctx, centerX, centerY, outerRadius + 8);
    
    // Center text without background boxes
    ctx.fillStyle = '#E3F2FD';
    ctx.font = '12px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('90%', centerX, centerY - 2);
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText('7.2H', centerX, centerY + 12);
}

// Helper functions for cleaner pixel rendering
function drawPixelatedCircle(ctx, centerX, centerY, radius, color, pixelSize) {
    ctx.fillStyle = color;
    
    for (let angle = 0; angle < 2 * Math.PI; angle += 0.02) {
        for (let r = radius - pixelSize; r <= radius; r += pixelSize) {
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            ctx.fillRect(Math.floor(x), Math.floor(y), pixelSize, pixelSize);
        }
    }
}

function drawPixelatedArc(ctx, centerX, centerY, radius, angle, color, pixelSize) {
    ctx.fillStyle = color;
    
    for (let a = 0; a < angle; a += 0.02) {
        const currentAngle = -Math.PI / 2 + a; // Start from top
        for (let r = radius - pixelSize; r <= radius; r += pixelSize) {
            const x = centerX + Math.cos(currentAngle) * r;
            const y = centerY + Math.sin(currentAngle) * r;
            ctx.fillRect(Math.floor(x), Math.floor(y), pixelSize, pixelSize);
        }
    }
}

function drawPixelatedDonutSegment(ctx, centerX, centerY, outerRadius, innerRadius, color, angle, startAngle) {
    ctx.fillStyle = color;
    const pixelSize = 3;
    
    for (let a = 0; a < angle; a += 0.015) {
        const currentAngle = startAngle + a;
        for (let r = innerRadius; r < outerRadius; r += pixelSize) {
            const x = centerX + Math.cos(currentAngle) * r;
            const y = centerY + Math.sin(currentAngle) * r;
            
            // Create clean pixel blocks
            ctx.fillRect(Math.floor(x/pixelSize) * pixelSize, Math.floor(y/pixelSize) * pixelSize, pixelSize, pixelSize);
        }
    }
}

function drawPixelFlameEffects(ctx, centerX, centerY, radius, flameCount) {
    const colors = ['#FF5722', '#FFA000', '#FFD700'];
    
    for (let i = 0; i < flameCount; i++) {
        const angle = (2 * Math.PI / flameCount) * i;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        ctx.fillStyle = colors[i % colors.length];
        
        // Draw clean flame pixels in a pattern
        for (let j = 0; j < 3; j++) {
            const flameX = x + (j - 1) * 4;
            const flameY = y - j * 2;
            ctx.fillRect(Math.floor(flameX), Math.floor(flameY), 3, 3);
        }
    }
}

function drawSleepPixelStars(ctx, centerX, centerY, radius) {
    const starColor = '#E3F2FD';
    ctx.fillStyle = starColor;
    
    // Draw small pixel stars around the sleep chart
    for (let i = 0; i < 6; i++) {
        const angle = (2 * Math.PI / 6) * i;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        // Draw a simple pixel star pattern
        ctx.fillRect(Math.floor(x) - 1, Math.floor(y), 3, 1); // horizontal line
        ctx.fillRect(Math.floor(x), Math.floor(y) - 1, 1, 3); // vertical line
    }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

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
    }, 3000);
}

function refreshData() {
    console.log('🔄 Manual refresh triggered - forcing fresh sync');
    showGlobalLoading();
    setTimeout(() => {
        initializeDashboard(true); // Force sync
    }, 500);
}

// ========================================
// MAIN INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    showGlobalLoading();
    
    createStars();
    enhanceStars();
    
    setTimeout(() => {
        initializeDashboard(true); // Force sync on page load
    }, 800);
    
    const widgets = document.querySelectorAll('.widget');
    
    widgets.forEach((widget, index) => {
        widget.addEventListener('click', function() {
            this.style.transform = 'scale(0.98) translateY(-8px)';
            setTimeout(() => { 
                this.style.transform = 'scale(1.02) translateY(-8px)'; 
            }, 100);
        });
    });

    createSleepChart();
});

async function initializeDashboard(forceSync = false) {
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
        
        console.log('Dashboard initializing for user:', userId);
        
        const userData = await loadUserProfile();
        if (!userData) {
            hideGlobalLoading();
            return;
        }
        
        console.log('User profile loaded, Google Fit connected:', !!(userData.fit_tokens && userData.fit_tokens.trim()));
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
        
        console.log('Dashboard initialization complete');
        hideGlobalLoading();
        
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        hideGlobalLoading();
        showErrorToast('Failed to initialize dashboard. Please refresh the page.');
    }
}