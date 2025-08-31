// stats.js - Cleaned and aligned with dashboard style

// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// ========================================
// GLOBAL STATE MANAGEMENT
// ========================================

let currentPeriod = 'daily';
let currentDate = new Date();
let comparisonMode = false;
let healthData = {
    steps: [],
    heartrate: [],
    sleep: [],
    calories: []
};

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

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function getDateRange(period, date) {
    const endDate = new Date(date);
    const startDate = new Date(date);
    
    switch (period) {
        case 'daily':
            startDate.setDate(endDate.getDate() - 6);
            break;
        case 'weekly':
            startDate.setDate(endDate.getDate() - 27);
            break;
        case 'monthly':
            startDate.setMonth(endDate.getMonth() - 5);
            startDate.setDate(1);
            endDate.setMonth(endDate.getMonth() + 1);
            endDate.setDate(0);
            break;
    }
    
    return {
        start: formatDate(startDate),
        end: formatDate(endDate)
    };
}

function getPeriodLabel(period, date) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    
    switch (period) {
        case 'daily':
            return date.toLocaleDateString('en-US', options).toUpperCase();
        case 'weekly':
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            return `WEEK OF ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}`;
        case 'monthly':
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }).toUpperCase();
        default:
            return 'TODAY';
    }
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

// ========================================
// LOADING STATE MANAGEMENT (SIMPLIFIED)
// ========================================

function showGlobalLoading() {
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
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            loadingOverlay.remove();
        }, 300);
    }
}

// ========================================
// TOAST NOTIFICATIONS (SIMPLIFIED)
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

// ========================================
// USER PROFILE MANAGEMENT
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
        updateNavigationUserInfo(userData.data);
        return userData.data;

    } catch (error) {
        console.error('Error loading user profile:', error);
        showErrorToast('Failed to load user profile');
        return null;
    }
}

function updateNavigationUserInfo(userData) {
    const userNameElements = document.querySelectorAll('.user-name');
    const userStatusElements = document.querySelectorAll('.user-status');
    const userAvatarElements = document.querySelectorAll('.user-avatar');
    const syncTimeElement = document.getElementById('navLastSyncTime');
    
    // Update user name
    if (userData.firstName && userData.lastName) {
        const fullName = `${userData.firstName.toUpperCase()} ${userData.lastName.toUpperCase()}`;
        userNameElements.forEach(element => {
            element.textContent = fullName;
        });
    }
    
    // Update user avatar
    if (userData.firstName && userData.lastName) {
        const initials = `${userData.firstName.charAt(0)}${userData.lastName.charAt(0)}`;
        userAvatarElements.forEach(element => {
            element.textContent = initials;
        });
    }
    
    // Update connection status
    const deviceName = userData.deviceName || 'GOOGLE FIT';
    userStatusElements.forEach(element => {
        element.textContent = `${deviceName} CONNECTED`;
        element.style.color = userData.fit_tokens ? '#4CAF50' : '#F44336';
    });
    
    // Update sync status
    if (syncTimeElement && userData.last_sync) {
        const syncTime = getTimeAgo(new Date(userData.last_sync));
        syncTimeElement.textContent = syncTime;
    }
}

// ========================================
// DATA FETCHING WITH PROPER HISTORICAL SUPPORT
// ========================================

async function fetchHealthData(dataType, startDate, endDate, userId) {
    console.log(`📊 Fetching ${dataType} data from ${startDate} to ${endDate}`);
    
    try {
        // First try to get fresh data from API (which also stores it)
        const apiResponse = await fetch(`${API_BASE_URL}/wearable/fitness-data?dataType=${dataType}&startDate=${startDate}&endDate=${endDate}&userId=${userId}`);
        
        if (apiResponse.ok) {
            const apiData = await apiResponse.json();
            if (apiData.data && apiData.data.length > 0) {
                console.log(`✅ Fresh ${dataType} data from API: ${apiData.data.length} records`);
                return apiData.data;
            }
        }
        
        // If API fails or returns no data, try stored data
        const storedResponse = await fetch(`${API_BASE_URL}/wearable/stored-data/${dataType}/${userId}?days=90`);
        
        if (storedResponse.ok) {
            const storedData = await storedResponse.json();
            if (storedData.count > 0) {
                console.log(`📚 Using stored ${dataType} data: ${storedData.count} records`);
                // Filter stored data to match requested date range
                return filterDataByDateRange(storedData.data, startDate, endDate);
            }
        }
        
    } catch (error) {
        console.error(`❌ Error fetching ${dataType} data:`, error);
    }
    
    console.warn(`⚠️ No ${dataType} data available for the requested period`);
    return [];
}

function filterDataByDateRange(data, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return data.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= start && itemDate <= end;
    });
}

async function loadAllHealthData() {
    const userId = getCurrentUserId();
    if (!userId) {
        showErrorToast('User not found. Please log in again.');
        return;
    }
    
    showGlobalLoading();
    
    try {
        const dateRange = getDateRange(currentPeriod, currentDate);
        console.log(`📅 Loading ${currentPeriod} data from ${dateRange.start} to ${dateRange.end}`);
        
        // Fetch all health data types in parallel
        const [stepsData, heartRateData, sleepData, caloriesData] = await Promise.all([
            fetchHealthData('steps', dateRange.start, dateRange.end, userId),
            fetchHealthData('heartrate', dateRange.start, dateRange.end, userId),
            fetchHealthData('sleep', dateRange.start, dateRange.end, userId),
            fetchHealthData('calories', dateRange.start, dateRange.end, userId)
        ]);
        
        // Store data globally
        healthData = {
            steps: stepsData || [],
            heartrate: heartRateData || [],
            sleep: sleepData || [],
            calories: caloriesData || []
        };
        
        console.log('📊 Health data loaded:', {
            steps: healthData.steps.length,
            heartrate: healthData.heartrate.length,
            sleep: healthData.sleep.length,
            calories: healthData.calories.length
        });
        
        // Process data based on current period
        const processedData = processDataForPeriod(healthData, currentPeriod);
        
        // Update all charts
        updateAllCharts(processedData);
        
        // Update comparison if enabled
        if (comparisonMode) {
            await updateComparison();
        }
        
        // Show data availability status
        updateDataAvailabilityStatus();
        
        hideGlobalLoading();
        showSuccessToast(`${currentPeriod} data loaded successfully`);
        
    } catch (error) {
        console.error('❌ Error loading health data:', error);
        showErrorToast('Failed to load health data. Please try again.');
        hideGlobalLoading();
    }
}

function updateDataAvailabilityStatus() {
    const dataTypes = ['steps', 'heartrate', 'sleep', 'calories'];
    
    dataTypes.forEach(dataType => {
        const data = healthData[dataType] || [];
        const validData = data.filter(d => d.value > 0);
        const coverage = validData.length;
        
        const widgetClass = getWidgetClassForDataType(dataType);
        updateDataCoverageIndicator(widgetClass, coverage, data.length);
    });
}

function getWidgetClassForDataType(dataType) {
    const mapping = {
        'steps': 'steps-chart-widget',
        'heartrate': 'heartrate-chart-widget',
        'sleep': 'sleep-chart-widget',
        'calories': 'calories-chart-widget'
    };
    return mapping[dataType];
}

function updateDataCoverageIndicator(widgetClass, coverage, total) {
    const widget = document.querySelector(`.${widgetClass}`);
    if (!widget) return;
    
    // Remove existing indicator
    const existingIndicator = widget.querySelector('.data-coverage-indicator');
    if (existingIndicator) existingIndicator.remove();
    
    // Create new indicator
    const indicator = document.createElement('div');
    indicator.className = 'data-coverage-indicator';
    
    let status, message, color;
    
    if (coverage === 0) {
        status = 'No Data';
        message = 'No data available for this period';
        color = '#F44336';
    } else if (coverage < total * 0.3) {
        status = 'Limited';
        message = `${coverage}/${total} days with data`;
        color = '#FF9800';
    } else if (coverage < total * 0.7) {
        status = 'Partial';
        message = `${coverage}/${total} days with data`;
        color = '#FFC107';
    } else {
        status = 'Good';
        message = `${coverage}/${total} days with data`;
        color = '#4CAF50';
    }
    
    indicator.innerHTML = `
        <div style="font-size: 6px; color: ${color}; text-align: center; margin-top: 8px; padding: 4px; border: 1px solid ${color}; border-radius: 3px; background: rgba(${color === '#4CAF50' ? '76,175,80' : color === '#FFC107' ? '255,193,7' : color === '#FF9800' ? '255,152,0' : '244,67,54'}, 0.1);">
            <div style="font-weight: bold;">${status.toUpperCase()}</div>
            <div style="font-size: 5px; margin-top: 2px;">${message}</div>
        </div>
    `;
    
    const widgetContent = widget.querySelector('.widget-content');
    if (widgetContent) {
        widgetContent.appendChild(indicator);
    }
}

function processDataForPeriod(data, period) {
    const processed = {
        steps: [],
        heartrate: [],
        sleep: [],
        calories: []
    };
    
    Object.keys(data).forEach(dataType => {
        const rawData = data[dataType];
        
        switch (period) {
            case 'daily':
                processed[dataType] = rawData;
                break;
            case 'weekly':
                processed[dataType] = aggregateDataByWeek(rawData);
                break;
            case 'monthly':
                processed[dataType] = aggregateDataByMonth(rawData);
                break;
        }
    });
    
    return processed;
}

function aggregateDataByWeek(data) {
    const weeklyData = {};
    
    data.forEach(item => {
        const date = new Date(item.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = formatDate(weekStart);
        
        if (!weeklyData[weekKey]) {
            weeklyData[weekKey] = {
                date: weekKey,
                values: [],
                dataType: item.dataType
            };
        }
        
        weeklyData[weekKey].values.push(item.value);
    });
    
    return Object.values(weeklyData).map(week => ({
        date: week.date,
        value: week.dataType === 'steps' || week.dataType === 'calories' 
            ? week.values.reduce((sum, val) => sum + val, 0)
            : Math.round(week.values.reduce((sum, val) => sum + val, 0) / week.values.length),
        dataType: week.dataType
    }));
}

function aggregateDataByMonth(data) {
    const monthlyData = {};
    
    data.forEach(item => {
        const date = new Date(item.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                date: monthKey,
                values: [],
                dataType: item.dataType
            };
        }
        
        monthlyData[monthKey].values.push(item.value);
    });
    
    return Object.values(monthlyData).map(month => ({
        date: month.date,
        value: month.dataType === 'steps' || month.dataType === 'calories' 
            ? month.values.reduce((sum, val) => sum + val, 0)
            : Math.round(month.values.reduce((sum, val) => sum + val, 0) / month.values.length),
        dataType: month.dataType
    }));
}

// ========================================
// CHART CREATION FUNCTIONS (SIMPLIFIED)
// ========================================

function createStepsChart(data, chartType = 'bar') {
    const canvas = document.getElementById('stepsChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = 600;
    canvas.height = 300;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    
    if (data.length === 0) {
        drawNoDataMessage(ctx, canvas.width, canvas.height);
        updateStepsStats([]);
        return;
    }
    
    const values = data.map(d => d.value).filter(v => v > 0);
    const labels = data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    
    if (values.length === 0) {
        drawNoDataMessage(ctx, canvas.width, canvas.height);
        updateStepsStats([]);
        return;
    }
    
    const maxValue = Math.max(...values);
    
    drawGrid(ctx, canvas.width, canvas.height, '#333');
    
    if (chartType === 'bar') {
        drawBarChart(ctx, canvas.width, canvas.height, values, labels, '#388E3C', maxValue);
    } else {
        drawLineChart(ctx, canvas.width, canvas.height, values, labels, '#388E3C', maxValue, Math.min(...values));
    }
    
    updateStepsStats(values);
}

function createHeartRateChart(data, chartType = 'line') {
    const canvas = document.getElementById('heartRateChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = 600;
    canvas.height = 300;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    
    if (data.length === 0) {
        drawNoDataMessage(ctx, canvas.width, canvas.height);
        updateHeartRateStats([]);
        return;
    }
    
    const values = data.map(d => d.value).filter(v => v > 0);
    const labels = data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    
    if (values.length === 0) {
        drawNoDataMessage(ctx, canvas.width, canvas.height);
        updateHeartRateStats([]);
        return;
    }
    
    const maxValue = Math.max(...values, 100);
    const minValue = Math.min(...values, 50);
    
    drawGrid(ctx, canvas.width, canvas.height, '#333');
    
    if (chartType === 'area') {
        drawAreaChart(ctx, canvas.width, canvas.height, values, labels, '#D32F2F', maxValue, minValue);
    } else {
        drawLineChart(ctx, canvas.width, canvas.height, values, labels, '#D32F2F', maxValue, minValue);
    }
    
    updateHeartRateStats(values);
}

function createSleepChart(data, chartType = 'stacked') {
    const canvas = document.getElementById('sleepChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = 600;
    canvas.height = 300;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    
    if (data.length === 0) {
        drawNoDataMessage(ctx, canvas.width, canvas.height);
        updateSleepStats([]);
        return;
    }
    
    const validData = data.filter(d => d.value > 0);
    
    if (validData.length === 0) {
        drawNoDataMessage(ctx, canvas.width, canvas.height);
        updateSleepStats([]);
        return;
    }
    
    if (chartType === 'donut') {
        drawSleepDonutChart(ctx, canvas.width, canvas.height, validData);
    } else {
        drawSleepStackedChart(ctx, canvas.width, canvas.height, validData);
    }
    
    updateSleepStats(validData);
}

function createCaloriesChart(data, chartType = 'pie') {
    const canvas = document.getElementById('caloriesChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = 600;
    canvas.height = 300;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    
    if (data.length === 0) {
        drawNoDataMessage(ctx, canvas.width, canvas.height);
        updateCaloriesStats([]);
        return;
    }
    
    const values = data.map(d => d.value).filter(v => v > 0);
    const labels = data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    
    if (values.length === 0) {
        drawNoDataMessage(ctx, canvas.width, canvas.height);
        updateCaloriesStats([]);
        return;
    }
    
    if (chartType === 'pie') {
        drawCaloriesPieChart(ctx, canvas.width, canvas.height, values, labels);
    } else {
        const maxValue = Math.max(...values);
        drawBarChart(ctx, canvas.width, canvas.height, values, labels, '#FFA000', maxValue);
    }
    
    updateCaloriesStats(values);
}

// ========================================
// CHART DRAWING HELPER FUNCTIONS
// ========================================

function drawGrid(ctx, width, height, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    
    for (let i = 0; i <= 8; i++) {
        const y = (height / 8) * i;
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(width - 20, y);
        ctx.stroke();
    }
    
    for (let i = 0; i <= 10; i++) {
        const x = 40 + ((width - 60) / 10) * i;
        ctx.beginPath();
        ctx.moveTo(x, 20);
        ctx.lineTo(x, height - 20);
        ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
}

function drawBarChart(ctx, width, height, values, labels, color, maxValue) {
    const chartWidth = width - 60;
    const chartHeight = height - 40;
    const barWidth = chartWidth / values.length;
    
    ctx.fillStyle = color;
    
    values.forEach((value, index) => {
        const barHeight = (value / maxValue) * chartHeight;
        const x = 40 + (index * barWidth) + (barWidth * 0.1);
        const y = height - 20 - barHeight;
        const actualBarWidth = barWidth * 0.8;
        
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color + '80');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, actualBarWidth, barHeight);
        
        ctx.fillStyle = '#fff';
        ctx.font = '8px "Press Start 2P"';
        ctx.textAlign = 'center';
        const displayValue = value > 1000 ? (value / 1000).toFixed(1) + 'K' : value.toString();
        ctx.fillText(displayValue, x + actualBarWidth/2, y - 5);
        
        ctx.fillStyle = '#ccc';
        ctx.font = '6px "Press Start 2P"';
        const label = labels[index] || '';
        ctx.fillText(label, x + actualBarWidth/2, height - 5);
    });
}

function drawLineChart(ctx, width, height, values, labels, color, maxValue, minValue) {
    const chartWidth = width - 60;
    const chartHeight = height - 40;
    const range = maxValue - minValue || 1;
    
    ctx.fillStyle = color + '20';
    ctx.beginPath();
    ctx.moveTo(40, height - 20);
    
    values.forEach((value, index) => {
        const x = 40 + (index / (values.length - 1)) * chartWidth;
        const y = height - 20 - ((value - minValue) / range) * chartHeight;
        ctx.lineTo(x, y);
    });
    
    ctx.lineTo(40 + chartWidth, height - 20);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    values.forEach((value, index) => {
        const x = 40 + (index / (values.length - 1)) * chartWidth;
        const y = height - 20 - ((value - minValue) / range) * chartHeight;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
    
    ctx.fillStyle = color;
    values.forEach((value, index) => {
        const x = 40 + (index / (values.length - 1)) * chartWidth;
        const y = height - 20 - ((value - minValue) / range) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = '7px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText(value.toString(), x, y - 8);
        ctx.fillStyle = color;
        
        if (labels[index]) {
            ctx.fillStyle = '#ccc';
            ctx.font = '6px "Press Start 2P"';
            ctx.fillText(labels[index], x, height - 5);
            ctx.fillStyle = color;
        }
    });
}

function drawAreaChart(ctx, width, height, values, labels, color, maxValue, minValue) {
    const chartWidth = width - 60;
    const chartHeight = height - 40;
    const range = maxValue - minValue || 1;
    
    const gradient = ctx.createLinearGradient(0, 20, 0, height - 20);
    gradient.addColorStop(0, color + '60');
    gradient.addColorStop(1, color + '10');
    ctx.fillStyle = gradient;
    
    ctx.beginPath();
    ctx.moveTo(40, height - 20);
    
    values.forEach((value, index) => {
        const x = 40 + (index / (values.length - 1)) * chartWidth;
        const y = height - 20 - ((value - minValue) / range) * chartHeight;
        ctx.lineTo(x, y);
    });
    
    ctx.lineTo(40 + chartWidth, height - 20);
    ctx.closePath();
    ctx.fill();
    
    drawLineChart(ctx, width, height, values, labels, color, maxValue, minValue);
}

function drawSleepStackedChart(ctx, width, height, data) {
    const chartWidth = width - 60;
    const chartHeight = height - 40;
    const barWidth = chartWidth / data.length;
    
    const maxSleep = Math.max(...data.map(d => d.value));
    
    data.forEach((dayData, index) => {
        const totalMinutes = dayData.value;
        const deepSleep = dayData.deep_sleep || Math.round(totalMinutes * 0.25);
        const lightSleep = dayData.light_sleep || Math.round(totalMinutes * 0.55);
        const remSleep = dayData.rem_sleep || Math.round(totalMinutes * 0.20);
        
        const x = 40 + (index * barWidth) + (barWidth * 0.1);
        const actualBarWidth = barWidth * 0.8;
        
        let currentY = height - 20;
        
        const deepHeight = (deepSleep / maxSleep) * chartHeight;
        ctx.fillStyle = '#1565C0';
        ctx.fillRect(x, currentY - deepHeight, actualBarWidth, deepHeight);
        currentY -= deepHeight;
        
        const lightHeight = (lightSleep / maxSleep) * chartHeight;
        ctx.fillStyle = '#42A5F5';
        ctx.fillRect(x, currentY - lightHeight, actualBarWidth, lightHeight);
        currentY -= lightHeight;
        
        const remHeight = (remSleep / maxSleep) * chartHeight;
        ctx.fillStyle = '#81D4FA';
        ctx.fillRect(x, currentY - remHeight, actualBarWidth, remHeight);
        
        ctx.fillStyle = '#fff';
        ctx.font = '7px "Press Start 2P"';
        ctx.textAlign = 'center';
        const hours = (totalMinutes / 60).toFixed(1);
        ctx.fillText(hours + 'H', x + actualBarWidth/2, currentY - remHeight - 5);
        
        ctx.fillStyle = '#ccc';
        ctx.font = '6px "Press Start 2P"';
        const date = new Date(dayData.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        ctx.fillText(date, x + actualBarWidth/2, height - 5);
    });
}

function drawSleepDonutChart(ctx, width, height, data) {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 4;
    
    const totalDays = data.length;
    const avgDeep = data.reduce((sum, d) => sum + (d.deep_sleep || d.value * 0.25), 0) / totalDays;
    const avgLight = data.reduce((sum, d) => sum + (d.light_sleep || d.value * 0.55), 0) / totalDays;
    const avgRem = data.reduce((sum, d) => sum + (d.rem_sleep || d.value * 0.20), 0) / totalDays;
    const total = avgDeep + avgLight + avgRem;
    
    let currentAngle = -Math.PI / 2;
    
    const deepAngle = (avgDeep / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + deepAngle);
    ctx.strokeStyle = '#1565C0';
    ctx.lineWidth = 20;
    ctx.stroke();
    currentAngle += deepAngle;
    
    const lightAngle = (avgLight / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + lightAngle);
    ctx.strokeStyle = '#42A5F5';
    ctx.lineWidth = 20;
    ctx.stroke();
    currentAngle += lightAngle;
    
    const remAngle = (avgRem / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + remAngle);
    ctx.strokeStyle = '#81D4FA';
    ctx.lineWidth = 20;
    ctx.stroke();
    
    ctx.fillStyle = '#fff';
    ctx.font = '16px "Press Start 2P"';
    ctx.textAlign = 'center';
    const avgHours = (total / 60).toFixed(1);
    ctx.fillText(`${avgHours}H`, centerX, centerY - 5);
    
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText('AVG SLEEP', centerX, centerY + 15);
}

function drawCaloriesPieChart(ctx, width, height, values, labels) {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 4;
    
    const total = values.reduce((sum, val) => sum + val, 0);
    const colors = ['#FF5722', '#FF7043', '#FF8A65', '#FFAB91', '#FFCCBC', '#FFF3E0'];
    
    let currentAngle = -Math.PI / 2;
    
    values.forEach((value, index) => {
        const sliceAngle = (value / total) * 2 * Math.PI;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.lineTo(centerX, centerY);
        ctx.fillStyle = colors[index % colors.length];
        ctx.fill();
        
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        const midAngle = currentAngle + sliceAngle / 2;
        const labelX = centerX + Math.cos(midAngle) * (radius + 40);
        const labelY = centerY + Math.sin(midAngle) * (radius + 40);
        
        ctx.fillStyle = '#fff';
        ctx.font = '7px "Press Start 2P"';
        ctx.textAlign = 'center';
        const percentage = Math.round((value / total) * 100);
        ctx.fillText(`${percentage}%`, labelX, labelY);
        ctx.fillText(`${value}`, labelX, labelY + 12);
        
        currentAngle += sliceAngle;
    });
    
    ctx.fillStyle = '#fff';
    ctx.font = '14px "Press Start 2P"';
    ctx.textAlign = 'center';
    const avgCalories = Math.round(total / values.length);
    ctx.fillText(`${avgCalories}`, centerX, centerY - 5);
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText('AVG/DAY', centerX, centerY + 15);
}

function drawNoDataMessage(ctx, width, height) {
    ctx.fillStyle = '#666';
    ctx.font = '12px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('NO DATA AVAILABLE', width / 2, height / 2 - 10);
    
    ctx.font = '8px "Press Start 2P"';
    ctx.fillStyle = '#888';
    ctx.fillText('CONNECT GOOGLE FIT TO VIEW DATA', width / 2, height / 2 + 10);
}

// ========================================
// STATS UPDATE FUNCTIONS
// ========================================

function updateStepsStats(values) {
    if (values.length === 0) {
        document.getElementById('stepsTotalValue').textContent = '0';
        document.getElementById('stepsAvgValue').textContent = '0';
        document.getElementById('stepsBestValue').textContent = '0';
        return;
    }
    
    const total = values.reduce((sum, val) => sum + val, 0);
    const average = Math.round(total / values.length);
    const best = Math.max(...values);
    
    document.getElementById('stepsTotalValue').textContent = total.toLocaleString();
    document.getElementById('stepsAvgValue').textContent = average.toLocaleString();
    document.getElementById('stepsBestValue').textContent = best.toLocaleString();
}

function updateHeartRateStats(values) {
    if (values.length === 0) {
        document.getElementById('hrAvgValue').textContent = '0 BPM';
        document.getElementById('hrRestingValue').textContent = '0 BPM';
        document.getElementById('hrMaxValue').textContent = '0 BPM';
        return;
    }
    
    const average = Math.round(values.reduce((sum, val) => sum + val, 0) / values.length);
    const resting = Math.min(...values);
    const max = Math.max(...values);
    
    document.getElementById('hrAvgValue').textContent = `${average} BPM`;
    document.getElementById('hrRestingValue').textContent = `${resting} BPM`;
    document.getElementById('hrMaxValue').textContent = `${max} BPM`;
}

function updateSleepStats(data) {
    if (data.length === 0) {
        document.getElementById('sleepAvgValue').textContent = '0H';
        document.getElementById('sleepEfficiencyValue').textContent = '0%';
        document.getElementById('deepSleepValue').textContent = '0H';
        return;
    }
    
    const totalMinutes = data.reduce((sum, d) => sum + d.value, 0);
    const avgMinutes = totalMinutes / data.length;
    const avgHours = (avgMinutes / 60).toFixed(1);
    
    const avgEfficiency = data.reduce((sum, d) => sum + (d.efficiency || 85), 0) / data.length;
    const avgDeepSleep = data.reduce((sum, d) => sum + (d.deep_sleep || d.value * 0.25), 0) / data.length;
    const deepHours = (avgDeepSleep / 60).toFixed(1);
    
    document.getElementById('sleepAvgValue').textContent = `${avgHours}H`;
    document.getElementById('sleepEfficiencyValue').textContent = `${Math.round(avgEfficiency)}%`;
    document.getElementById('deepSleepValue').textContent = `${deepHours}H`;
}

function updateCaloriesStats(values) {
    if (values.length === 0) {
        document.getElementById('caloriesTotalValue').textContent = '0';
        document.getElementById('caloriesAvgValue').textContent = '0';
        document.getElementById('caloriesBestValue').textContent = '0';
        return;
    }
    
    const total = values.reduce((sum, val) => sum + val, 0);
    const average = Math.round(total / values.length);
    const best = Math.max(...values);
    
    document.getElementById('caloriesTotalValue').textContent = total.toLocaleString();
    document.getElementById('caloriesAvgValue').textContent = average.toLocaleString();
    document.getElementById('caloriesBestValue').textContent = best.toLocaleString();
}

function updateAllCharts(data) {
    const stepsChartType = document.querySelector('.steps-chart-widget .chart-btn.active')?.dataset.chart || 'bar';
    const heartRateChartType = document.querySelector('.heartrate-chart-widget .chart-btn.active')?.dataset.chart || 'line';
    const sleepChartType = document.querySelector('.sleep-chart-widget .chart-btn.active')?.dataset.chart || 'stacked';
    const caloriesChartType = document.querySelector('.calories-chart-widget .chart-btn.active')?.dataset.chart || 'pie';
    
    createStepsChart(data.steps, stepsChartType);
    createHeartRateChart(data.heartrate, heartRateChartType);
    createSleepChart(data.sleep, sleepChartType);
    createCaloriesChart(data.calories, caloriesChartType);
}

// ========================================
// COMPARISON FUNCTIONS WITH REAL DATA
// ========================================

async function updateComparison() {
    if (!comparisonMode) return;
    
    console.log('📊 Fetching real comparison data...');
    showGlobalLoading();
    
    try {
        const currentStats = getCurrentPeriodStats();
        const previousStats = await fetchPreviousPeriodStats();
        
        updateComparisonDisplay(currentStats, previousStats);
        hideGlobalLoading();
        
    } catch (error) {
        console.error('❌ Error updating comparison:', error);
        hideGlobalLoading();
        showErrorToast('Failed to load comparison data');
    }
}

function getCurrentPeriodStats() {
    return {
        steps: parseInt(document.getElementById('stepsTotalValue').textContent.replace(/,/g, '')) || 0,
        heartRate: parseInt(document.getElementById('hrAvgValue').textContent.replace(' BPM', '')) || 0,
        sleep: parseFloat(document.getElementById('sleepAvgValue').textContent.replace('H', '')) || 0,
        calories: parseInt(document.getElementById('caloriesTotalValue').textContent.replace(/,/g, '')) || 0
    };
}

async function fetchPreviousPeriodStats() {
    const userId = getCurrentUserId();
    if (!userId) return generateFallbackStats();
    
    // Calculate previous period date range
    const previousDate = getPreviousDate(currentDate, currentPeriod);
    const previousRange = getDateRange(currentPeriod, previousDate);
    
    console.log(`📅 Fetching previous ${currentPeriod} data: ${previousRange.start} to ${previousRange.end}`);
    
    try {
        // Fetch previous period data in parallel
        const [prevStepsData, prevHeartRateData, prevSleepData, prevCaloriesData] = await Promise.all([
            fetchHealthData('steps', previousRange.start, previousRange.end, userId),
            fetchHealthData('heartrate', previousRange.start, previousRange.end, userId),
            fetchHealthData('sleep', previousRange.start, previousRange.end, userId),
            fetchHealthData('calories', previousRange.start, previousRange.end, userId)
        ]);
        
        // Process the previous period data
        const previousHealthData = {
            steps: prevStepsData || [],
            heartrate: prevHeartRateData || [],
            sleep: prevSleepData || [],
            calories: prevCaloriesData || []
        };
        
        const processedPrevious = processDataForPeriod(previousHealthData, currentPeriod);
        
        // Calculate totals/averages for comparison
        const previousStats = {
            steps: calculateTotalOrAverage(processedPrevious.steps, 'steps'),
            heartRate: calculateTotalOrAverage(processedPrevious.heartrate, 'heartrate'),
            sleep: calculateTotalOrAverage(processedPrevious.sleep, 'sleep'),
            calories: calculateTotalOrAverage(processedPrevious.calories, 'calories')
        };
        
        console.log('✅ Previous period stats calculated:', previousStats);
        return previousStats;
        
    } catch (error) {
        console.error('❌ Error fetching previous period data:', error);
        return generateFallbackStats();
    }
}

function calculateTotalOrAverage(data, dataType) {
    if (!data || data.length === 0) return 0;
    
    const values = data.map(d => d.value).filter(v => v > 0);
    if (values.length === 0) return 0;
    
    const total = values.reduce((sum, val) => sum + val, 0);
    
    // For steps and calories, sum the totals; for heart rate and sleep, use averages
    if (dataType === 'steps' || dataType === 'calories') {
        return total;
    } else {
        return Math.round(total / values.length);
    }
}

function getPreviousDate(date, period) {
    const previousDate = new Date(date);
    
    switch (period) {
        case 'daily':
            previousDate.setDate(date.getDate() - 1);
            break;
        case 'weekly':
            previousDate.setDate(date.getDate() - 7);
            break;
        case 'monthly':
            previousDate.setMonth(date.getMonth() - 1);
            break;
    }
    
    return previousDate;
}

function generateFallbackStats() {
    console.warn('⚠️ Using fallback comparison stats');
    const currentStats = getCurrentPeriodStats();
    const variance = 0.15;
    
    return {
        steps: Math.max(0, Math.round(currentStats.steps * (1 + (Math.random() - 0.5) * variance))),
        heartRate: Math.max(50, Math.round(currentStats.heartRate * (1 + (Math.random() - 0.5) * 0.1))),
        sleep: Math.max(4, parseFloat((currentStats.sleep * (1 + (Math.random() - 0.5) * 0.2)).toFixed(1))),
        calories: Math.max(0, Math.round(currentStats.calories * (1 + (Math.random() - 0.5) * variance)))
    };
}

function updateComparisonDisplay(current, previous) {
    document.getElementById('stepsCurrentComp').textContent = current.steps.toLocaleString();
    document.getElementById('stepsPreviousComp').textContent = previous.steps.toLocaleString();
    updateComparisonChange('stepsChange', current.steps, previous.steps);
    
    document.getElementById('hrCurrentComp').textContent = `${current.heartRate} BPM`;
    document.getElementById('hrPreviousComp').textContent = `${previous.heartRate} BPM`;
    updateComparisonChange('hrChange', current.heartRate, previous.heartRate);
    
    document.getElementById('sleepCurrentComp').textContent = `${current.sleep.toFixed(1)}H`;
    document.getElementById('sleepPreviousComp').textContent = `${previous.sleep.toFixed(1)}H`;
    updateComparisonChange('sleepChange', current.sleep, previous.sleep);
    
    document.getElementById('caloriesCurrentComp').textContent = current.calories.toLocaleString();
    document.getElementById('caloriesPreviousComp').textContent = previous.calories.toLocaleString();
    updateComparisonChange('caloriesChange', current.calories, previous.calories);
}

function updateComparisonChange(elementId, current, previous) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    if (previous === 0) {
        element.textContent = current > 0 ? '+100%' : '0%';
        element.className = 'comparison-change positive';
        return;
    }
    
    const change = ((current - previous) / previous) * 100;
    const changeText = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    
    element.textContent = changeText;
    element.className = 'comparison-change';
    
    if (change > 0) {
        element.classList.add('positive');
    } else if (change < 0) {
        element.classList.add('negative');
    } else {
        element.classList.add('neutral');
    }
}

// ========================================
// ENHANCED PERIOD NAVIGATION WITH HISTORICAL CONTEXT
// ========================================

function updatePeriodDisplay() {
    const periodLabel = getPeriodLabel(currentPeriod, currentDate);
    const periodElement = document.getElementById('currentPeriod');
    
    if (periodElement) {
        // Add historical context to the period display
        const today = new Date();
        const isCurrentPeriod = isCurrentTimePeriod(currentDate, currentPeriod, today);
        
        if (isCurrentPeriod) {
            periodElement.textContent = periodLabel + ' (CURRENT)';
            periodElement.style.color = '#4CAF50';
        } else {
            const daysAgo = calculateDaysAgo(currentDate, today);
            periodElement.textContent = periodLabel + ` (${daysAgo} AGO)`;
            periodElement.style.color = '#FFA000';
        }
    }
    
    // Update navigation buttons with better UX
    const nextBtn = document.getElementById('nextPeriod');
    const prevBtn = document.getElementById('prevPeriod');
    const today = new Date();
    
    // Disable next button if we're at current period
    if (nextBtn) {
        const canGoNext = canNavigateNext(currentDate, currentPeriod, today);
        nextBtn.disabled = !canGoNext;
        
        if (canGoNext) {
            const nextPeriodName = getPeriodName(currentPeriod);
            nextBtn.title = `Next ${nextPeriodName}`;
        } else {
            nextBtn.title = 'Already at current period';
        }
    }
    
    // Update previous button with context
    if (prevBtn) {
        const prevPeriodName = getPeriodName(currentPeriod);
        prevBtn.title = `Previous ${prevPeriodName}`;
        
        // Show how far back we can go (optional UX enhancement)
        const maxHistoryDays = 365; // 1 year of history
        const currentDaysBack = calculateDaysAgo(currentDate, today);
        
        if (currentDaysBack >= maxHistoryDays) {
            prevBtn.disabled = true;
            prevBtn.title = 'Reached maximum history limit (1 year)';
        } else {
            prevBtn.disabled = false;
        }
    }
}

function isCurrentTimePeriod(date, period, today) {
    switch (period) {
        case 'daily':
            return formatDate(date) === formatDate(today);
        case 'weekly':
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            const todayWeekStart = new Date(today);
            todayWeekStart.setDate(today.getDate() - today.getDay());
            return formatDate(weekStart) === formatDate(todayWeekStart);
        case 'monthly':
            return date.getMonth() === today.getMonth() && 
                   date.getFullYear() === today.getFullYear();
        default:
            return false;
    }
}

function canNavigateNext(date, period, today) {
    switch (period) {
        case 'daily':
            return formatDate(date) < formatDate(today);
        case 'weekly':
            const nextWeek = new Date(date);
            nextWeek.setDate(date.getDate() + 7);
            return nextWeek <= today;
        case 'monthly':
            const nextMonth = new Date(date);
            nextMonth.setMonth(date.getMonth() + 1);
            return nextMonth <= today;
        default:
            return false;
    }
}

function calculateDaysAgo(pastDate, currentDate) {
    const diffTime = Math.abs(currentDate - pastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '0 DAYS';
    if (diffDays === 1) return '1 DAY';
    if (diffDays < 7) return `${diffDays} DAYS`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} WEEKS`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} MONTHS`;
    return `${Math.floor(diffDays / 365)} YEARS`;
}

function getPeriodName(period) {
    const names = {
        'daily': 'Day',
        'weekly': 'Week', 
        'monthly': 'Month'
    };
    return names[period] || 'Period';
}

function navigatePeriod(direction) {
    console.log(`🔄 Navigating ${direction} for ${currentPeriod} period`);
    
    const newDate = new Date(currentDate);
    
    switch (currentPeriod) {
        case 'daily':
            newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
            break;
        case 'weekly':
            newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
            break;
        case 'monthly':
            newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
            break;
    }
    
    currentDate = newDate;
    updatePeriodDisplay();
    
    // Show what period we're loading
    const periodName = getPeriodLabel(currentPeriod, currentDate);
    showSuccessToast(`Loading ${periodName.toLowerCase()}`);
    
    loadAllHealthData();
}

function changePeriod(newPeriod) {
    console.log(`🔄 Changing period from ${currentPeriod} to ${newPeriod}`);
    
    // Store previous period data for smooth transitions
    const previousData = { ...healthData };
    
    currentPeriod = newPeriod;
    currentDate = new Date(); // Reset to current date when changing period
    
    // Update active button
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.period === newPeriod) {
            btn.classList.add('active');
        }
    });
    
    updatePeriodDisplay();
    
    // Show immediate feedback
    const periodNames = {
        'daily': 'daily view',
        'weekly': 'weekly view',
        'monthly': 'monthly view'
    };
    
    showSuccessToast(`Switched to ${periodNames[newPeriod]}`);
    loadAllHealthData();
}

function toggleComparison() {
    comparisonMode = !comparisonMode;
    
    const comparisonPanel = document.getElementById('comparisonPanel');
    if (comparisonMode) {
        comparisonPanel.style.display = 'block';
        updateComparison();
    } else {
        comparisonPanel.style.display = 'none';
    }
}

function changeChartType(widgetClass, chartType) {
    const widget = document.querySelector(`.${widgetClass}`);
    widget.querySelectorAll('.chart-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.chart === chartType) {
            btn.classList.add('active');
        }
    });
    
    const dataType = widgetClass.replace('-chart-widget', '').replace('heartrate', 'heartrate');
    const data = healthData[dataType] || [];
    const processedData = processDataForPeriod({ [dataType]: data }, currentPeriod);
    
    switch (widgetClass) {
        case 'steps-chart-widget':
            createStepsChart(processedData[dataType], chartType);
            break;
        case 'heartrate-chart-widget':
            createHeartRateChart(processedData[dataType], chartType);
            break;
        case 'sleep-chart-widget':
            createSleepChart(processedData[dataType], chartType);
            break;
        case 'calories-chart-widget':
            createCaloriesChart(processedData[dataType], chartType);
            break;
    }
}

// ========================================
// EVENT LISTENERS AND INITIALIZATION
// ========================================

function setupEventListeners() {
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            changePeriod(btn.dataset.period);
        });
    });
    
    document.getElementById('prevPeriod')?.addEventListener('click', () => {
        navigatePeriod('prev');
    });
    
    document.getElementById('nextPeriod')?.addEventListener('click', () => {
        navigatePeriod('next');
    });
    
    document.getElementById('comparisonMode')?.addEventListener('change', (e) => {
        toggleComparison();
    });
    
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const widget = btn.closest('.stat-widget');
            const widgetClass = widget.className.split(' ').find(cls => cls.includes('-chart-widget'));
            const chartType = btn.dataset.chart;
            changeChartType(widgetClass, chartType);
        });
    });
}

// ========================================
// MAIN INITIALIZATION (SIMPLIFIED)
// ========================================

async function initializeStats(forceSync = false) {
    try {
        const userId = getCurrentUserId();
        if (!userId) {
            hideGlobalLoading();
            window.location.href = '../auth/auth.html';
            return;
        }
        
        const userData = await loadUserProfile();
        if (!userData) {
            hideGlobalLoading();
            return;
        }
        
        const isGoogleFitConnected = userData.fit_tokens && userData.fit_tokens.trim() !== '';
        
        if (!isGoogleFitConnected) {
            hideGlobalLoading();
            showErrorToast('Please connect Google Fit to view statistics');
            return;
        }
        
        await loadAllHealthData();
        hideGlobalLoading();
        
    } catch (error) {
        console.error('Stats initialization error:', error);
        hideGlobalLoading();
        showErrorToast('Failed to initialize statistics. Please refresh the page.');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    showGlobalLoading();
    
    createStars();
    setupEventListeners();
    updatePeriodDisplay();
    
    setTimeout(() => {
        initializeStats();
    }, 500);
});

// ========================================
// KEYBOARD SHORTCUTS (SIMPLIFIED)
// ========================================

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    switch (e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            navigatePeriod('prev');
            break;
        case 'ArrowRight':
            e.preventDefault();
            navigatePeriod('next');
            break;
        case '1':
            e.preventDefault();
            changePeriod('daily');
            break;
        case '2':
            e.preventDefault();
            changePeriod('weekly');
            break;
        case '3':
            e.preventDefault();
            changePeriod('monthly');
            break;
        case 'c':
        case 'C':
            e.preventDefault();
            document.getElementById('comparisonMode')?.click();
            break;
        case 'r':
        case 'R':
            e.preventDefault();
            showGlobalLoading();
            initializeStats(true);
            showSuccessToast('Data refreshed');
            break;
    }
});