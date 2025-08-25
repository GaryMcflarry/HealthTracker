// stats.js - Enhanced Health Statistics Dashboard

// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// ========================================
// GLOBAL STATE MANAGEMENT
// ========================================

let currentPeriod = 'daily';
let currentDate = new Date();
let comparisonMode = false;
let chartInstances = {};

// Chart data storage
let healthData = {
    steps: [],
    heartrate: [],
    sleep: [],
    calories: []
};

// Data availability tracking
let dataAvailability = {
    steps: 'no-data',
    heartrate: 'no-data',
    sleep: 'no-data',
    calories: 'no-data'
};

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
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    };
    
    switch (period) {
        case 'daily':
            return date.toLocaleDateString('en-US', options).toUpperCase();
        case 'weekly':
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            return `WEEK OF ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}`;
        case 'monthly':
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }).toUpperCase();
        default:
            return 'TODAY';
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

// ========================================
// ENHANCED DATA FETCHING FUNCTIONS
// ========================================

async function fetchHealthData(dataType, startDate, endDate, userId) {
    console.log(`📊 Fetching ${dataType} data from ${startDate} to ${endDate}`);
    
    try {
        // Try stored data first
        const storedResponse = await fetch(`${API_BASE_URL}/wearable/stored-data/${dataType}/${userId}?days=30`);
        
        if (storedResponse.ok) {
            const storedData = await storedResponse.json();
            if (storedData.count > 0) {
                console.log(`✅ Found ${storedData.count} stored ${dataType} records`);
                updateDataAvailability(dataType, storedData.count);
                return storedData.data;
            }
        }
        
        // Fallback to API fetch
        console.log(`🌐 Fetching ${dataType} from API...`);
        const apiResponse = await fetch(`${API_BASE_URL}/wearable/fitness-data?dataType=${dataType}&startDate=${startDate}&endDate=${endDate}&userId=${userId}`);
        
        if (apiResponse.ok) {
            const apiData = await apiResponse.json();
            console.log(`✅ Fetched ${apiData.count || 0} ${dataType} records from API`);
            updateDataAvailability(dataType, apiData.count || 0);
            return apiData.data || [];
        }
        
    } catch (error) {
        console.error(`❌ Error fetching ${dataType} data:`, error);
    }
    
    console.warn(`⚠️ No ${dataType} data available`);
    updateDataAvailability(dataType, 0);
    return [];
}

function updateDataAvailability(dataType, count) {
    if (count === 0) {
        dataAvailability[dataType] = 'no-data';
    } else if (count < 3) {
        dataAvailability[dataType] = 'low-coverage';
    } else if (count < 7) {
        dataAvailability[dataType] = 'medium-coverage';
    } else {
        dataAvailability[dataType] = 'good-coverage';
    }
}

// ========================================
// ENHANCED CHART CREATION FUNCTIONS
// ========================================

function createStepsChart(data, chartType = 'bar') {
    console.log(`📊 Creating steps ${chartType} chart with ${data.length} data points`);
    
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
        updateDataIndicator('steps-chart-widget', 'no-data');
        return;
    }
    
    const values = data.map(d => d.value).filter(v => v > 0);
    const labels = data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    
    if (values.length === 0) {
        drawNoDataMessage(ctx, canvas.width, canvas.height);
        updateStepsStats([]);
        updateDataIndicator('steps-chart-widget', 'no-data');
        return;
    }
    
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    
    // Draw grid
    drawGrid(ctx, canvas.width, canvas.height, '#333');
    
    if (chartType === 'bar') {
        drawBarChart(ctx, canvas.width, canvas.height, values, labels, '#388E3C', maxValue);
    } else {
        drawLineChart(ctx, canvas.width, canvas.height, values, labels, '#388E3C', maxValue, minValue);
    }
    
    // Update stats
    updateStepsStats(values);
    updateDataIndicator('steps-chart-widget', dataAvailability.steps);
}

function createHeartRateChart(data, chartType = 'line') {
    console.log(`💓 Creating heart rate ${chartType} chart with ${data.length} data points`);
    
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
        updateDataIndicator('heartrate-chart-widget', 'no-data');
        return;
    }
    
    const values = data.map(d => d.value).filter(v => v > 0);
    const labels = data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    
    if (values.length === 0) {
        drawNoDataMessage(ctx, canvas.width, canvas.height);
        updateHeartRateStats([]);
        updateDataIndicator('heartrate-chart-widget', 'no-data');
        return;
    }
    
    const maxValue = Math.max(...values, 100);
    const minValue = Math.min(...values, 50);
    
    // Draw grid
    drawGrid(ctx, canvas.width, canvas.height, '#333');
    
    if (chartType === 'area') {
        drawAreaChart(ctx, canvas.width, canvas.height, values, labels, '#D32F2F', maxValue, minValue);
    } else {
        drawLineChart(ctx, canvas.width, canvas.height, values, labels, '#D32F2F', maxValue, minValue);
    }
    
    // Update stats
    updateHeartRateStats(values);
    updateDataIndicator('heartrate-chart-widget', dataAvailability.heartrate);
}

function createSleepChart(data, chartType = 'stacked') {
    console.log(`😴 Creating sleep ${chartType} chart with ${data.length} data points`);
    
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
        updateDataIndicator('sleep-chart-widget', 'no-data');
        return;
    }
    
    const validData = data.filter(d => d.value > 0);
    
    if (validData.length === 0) {
        drawNoDataMessage(ctx, canvas.width, canvas.height);
        updateSleepStats([]);
        updateDataIndicator('sleep-chart-widget', 'no-data');
        return;
    }
    
    if (chartType === 'donut') {
        drawSleepDonutChart(ctx, canvas.width, canvas.height, validData);
    } else {
        drawSleepStackedChart(ctx, canvas.width, canvas.height, validData);
    }
    
    // Update stats
    updateSleepStats(validData);
    updateDataIndicator('sleep-chart-widget', dataAvailability.sleep);
}

function createCaloriesChart(data, chartType = 'pie') {
    console.log(`🔥 Creating calories ${chartType} chart with ${data.length} data points`);
    
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
        updateDataIndicator('calories-chart-widget', 'no-data');
        return;
    }
    
    const values = data.map(d => d.value).filter(v => v > 0);
    const labels = data.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    
    if (values.length === 0) {
        drawNoDataMessage(ctx, canvas.width, canvas.height);
        updateCaloriesStats([]);
        updateDataIndicator('calories-chart-widget', 'no-data');
        return;
    }
    
    if (chartType === 'pie') {
        drawCaloriesPieChart(ctx, canvas.width, canvas.height, values, labels);
    } else {
        const maxValue = Math.max(...values);
        drawBarChart(ctx, canvas.width, canvas.height, values, labels, '#FFA000', maxValue);
    }
    
    // Update stats
    updateCaloriesStats(values);
    updateDataIndicator('calories-chart-widget', dataAvailability.calories);
}

// ========================================
// ENHANCED CHART DRAWING HELPER FUNCTIONS
// ========================================

function drawGrid(ctx, width, height, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    
    // Horizontal lines
    for (let i = 0; i <= 8; i++) {
        const y = (height / 8) * i;
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(width - 20, y);
        ctx.stroke();
    }
    
    // Vertical lines
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
        
        // Draw bar with gradient effect
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color + '80');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, actualBarWidth, barHeight);
        
        // Draw value on top of bar
        ctx.fillStyle = '#fff';
        ctx.font = '8px "Press Start 2P"';
        ctx.textAlign = 'center';
        const displayValue = value > 1000 ? (value / 1000).toFixed(1) + 'K' : value.toString();
        ctx.fillText(displayValue, x + actualBarWidth/2, y - 5);
        
        // Draw label at bottom
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
    
    // Draw area under line
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
    
    // Draw line
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
    
    // Draw data points with values
    ctx.fillStyle = color;
    values.forEach((value, index) => {
        const x = 40 + (index / (values.length - 1)) * chartWidth;
        const y = height - 20 - ((value - minValue) / range) * chartHeight;
        
        // Draw point
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw value above point
        ctx.fillStyle = '#fff';
        ctx.font = '7px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText(value.toString(), x, y - 8);
        ctx.fillStyle = color;
        
        // Draw label below
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
    
    // Draw filled area with gradient
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
    
    // Draw line on top
    drawLineChart(ctx, width, height, values, labels, color, maxValue, minValue);
}

function drawSleepStackedChart(ctx, width, height, data) {
    const chartWidth = width - 60;
    const chartHeight = height - 40;
    const barWidth = chartWidth / data.length;
    
    // Calculate max total sleep for scaling
    const maxSleep = Math.max(...data.map(d => d.value));
    
    data.forEach((dayData, index) => {
        const totalMinutes = dayData.value;
        const deepSleep = dayData.deep_sleep || Math.round(totalMinutes * 0.25);
        const lightSleep = dayData.light_sleep || Math.round(totalMinutes * 0.55);
        const remSleep = dayData.rem_sleep || Math.round(totalMinutes * 0.20);
        
        const x = 40 + (index * barWidth) + (barWidth * 0.1);
        const actualBarWidth = barWidth * 0.8;
        
        let currentY = height - 20;
        
        // Deep sleep (bottom)
        const deepHeight = (deepSleep / maxSleep) * chartHeight;
        ctx.fillStyle = '#1565C0';
        ctx.fillRect(x, currentY - deepHeight, actualBarWidth, deepHeight);
        currentY -= deepHeight;
        
        // Light sleep (middle)
        const lightHeight = (lightSleep / maxSleep) * chartHeight;
        ctx.fillStyle = '#42A5F5';
        ctx.fillRect(x, currentY - lightHeight, actualBarWidth, lightHeight);
        currentY -= lightHeight;
        
        // REM sleep (top)
        const remHeight = (remSleep / maxSleep) * chartHeight;
        ctx.fillStyle = '#81D4FA';
        ctx.fillRect(x, currentY - remHeight, actualBarWidth, remHeight);
        
        // Draw total hours on top
        ctx.fillStyle = '#fff';
        ctx.font = '7px "Press Start 2P"';
        ctx.textAlign = 'center';
        const hours = (totalMinutes / 60).toFixed(1);
        ctx.fillText(hours + 'H', x + actualBarWidth/2, currentY - remHeight - 5);
        
        // Draw date label
        ctx.fillStyle = '#ccc';
        ctx.font = '6px "Press Start 2P"';
        const date = new Date(dayData.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        ctx.fillText(date, x + actualBarWidth/2, height - 5);
    });
    
    // Draw legend
    drawSleepLegend(ctx, width, height);
}

function drawSleepDonutChart(ctx, width, height, data) {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 4;
    
    // Calculate average sleep phases
    const totalDays = data.length;
    const avgDeep = data.reduce((sum, d) => sum + (d.deep_sleep || d.value * 0.25), 0) / totalDays;
    const avgLight = data.reduce((sum, d) => sum + (d.light_sleep || d.value * 0.55), 0) / totalDays;
    const avgRem = data.reduce((sum, d) => sum + (d.rem_sleep || d.value * 0.20), 0) / totalDays;
    const total = avgDeep + avgLight + avgRem;
    
    let currentAngle = -Math.PI / 2;
    
    // Deep sleep
    const deepAngle = (avgDeep / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + deepAngle);
    ctx.strokeStyle = '#1565C0';
    ctx.lineWidth = 20;
    ctx.stroke();
    currentAngle += deepAngle;
    
    // Light sleep
    const lightAngle = (avgLight / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + lightAngle);
    ctx.strokeStyle = '#42A5F5';
    ctx.lineWidth = 20;
    ctx.stroke();
    currentAngle += lightAngle;
    
    // REM sleep
    const remAngle = (avgRem / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + remAngle);
    ctx.strokeStyle = '#81D4FA';
    ctx.lineWidth = 20;
    ctx.stroke();
    
    // Center text
    ctx.fillStyle = '#fff';
    ctx.font = '16px "Press Start 2P"';
    ctx.textAlign = 'center';
    const avgHours = (total / 60).toFixed(1);
    ctx.fillText(`${avgHours}H`, centerX, centerY - 5);
    
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText('AVG SLEEP', centerX, centerY + 15);
    
    // Draw percentages around the donut
    drawSleepPercentages(ctx, centerX, centerY, radius + 30, avgDeep, avgLight, avgRem, total);
}

function drawSleepPercentages(ctx, centerX, centerY, radius, deep, light, rem, total) {
    const deepPercent = Math.round((deep / total) * 100);
    const lightPercent = Math.round((light / total) * 100);
    const remPercent = Math.round((rem / total) * 100);
    
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'center';
    
    // Deep sleep percentage (bottom)
    ctx.fillStyle = '#1565C0';
    ctx.fillText(`DEEP ${deepPercent}%`, centerX, centerY + radius);
    
    // Light sleep percentage (right)
    ctx.fillStyle = '#42A5F5';
    ctx.fillText(`LIGHT ${lightPercent}%`, centerX + radius, centerY);
    
    // REM sleep percentage (left)
    ctx.fillStyle = '#81D4FA';
    ctx.fillText(`REM ${remPercent}%`, centerX - radius, centerY);
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
        
        // Draw slice border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw percentage and value outside the pie
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
    
    // Center text
    ctx.fillStyle = '#fff';
    ctx.font = '14px "Press Start 2P"';
    ctx.textAlign = 'center';
    const avgCalories = Math.round(total / values.length);
    ctx.fillText(`${avgCalories}`, centerX, centerY - 5);
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText('AVG/DAY', centerX, centerY + 15);
}

function drawSleepLegend(ctx, width, height) {
    const legendX = width - 120;
    const legendY = 20;
    
    ctx.font = '8px "Press Start 2P"';
    ctx.textAlign = 'left';
    
    // Deep sleep
    ctx.fillStyle = '#1565C0';
    ctx.fillRect(legendX, legendY, 12, 12);
    ctx.fillStyle = '#fff';
    ctx.fillText('DEEP', legendX + 16, legendY + 10);
    
    // Light sleep
    ctx.fillStyle = '#42A5F5';
    ctx.fillRect(legendX, legendY + 20, 12, 12);
    ctx.fillStyle = '#fff';
    ctx.fillText('LIGHT', legendX + 16, legendY + 30);
    
    // REM sleep
    ctx.fillStyle = '#81D4FA';
    ctx.fillRect(legendX, legendY + 40, 12, 12);
    ctx.fillStyle = '#fff';
    ctx.fillText('REM', legendX + 16, legendY + 50);
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
// ENHANCED STATS UPDATE FUNCTIONS
// ========================================

function updateStepsStats(values) {
    if (values.length === 0) {
        document.getElementById('stepsTotalValue').textContent = '0';
        document.getElementById('stepsAvgValue').textContent = '0';
        document.getElementById('stepsBestValue').textContent = '0';
        updateAdditionalStepsStats([]);
        return;
    }
    
    const total = values.reduce((sum, val) => sum + val, 0);
    const average = Math.round(total / values.length);
    const best = Math.max(...values);
    const worst = Math.min(...values);
    const goal = 10000; // Daily step goal
    const goalAchieved = values.filter(v => v >= goal).length;
    
    document.getElementById('stepsTotalValue').textContent = total.toLocaleString();
    document.getElementById('stepsAvgValue').textContent = average.toLocaleString();
    document.getElementById('stepsBestValue').textContent = best.toLocaleString();
    
    updateAdditionalStepsStats({
        worst,
        goalAchieved,
        totalDays: values.length,
        goal
    });
}

function updateHeartRateStats(values) {
    if (values.length === 0) {
        document.getElementById('hrAvgValue').textContent = '0 BPM';
        document.getElementById('hrRestingValue').textContent = '0 BPM';
        document.getElementById('hrMaxValue').textContent = '0 BPM';
        updateAdditionalHeartRateStats([]);
        return;
    }
    
    const average = Math.round(values.reduce((sum, val) => sum + val, 0) / values.length);
    const resting = Math.min(...values);
    const max = Math.max(...values);
    const range = max - resting;
    
    // Calculate heart rate zones (rough estimates)
    const zone1 = values.filter(v => v < average * 0.6).length; // Recovery
    const zone2 = values.filter(v => v >= average * 0.6 && v < average * 0.7).length; // Aerobic
    const zone3 = values.filter(v => v >= average * 0.7 && v < average * 0.8).length; // Anaerobic
    const zone4 = values.filter(v => v >= average * 0.8).length; // VO2 Max
    
    document.getElementById('hrAvgValue').textContent = `${average} BPM`;
    document.getElementById('hrRestingValue').textContent = `${resting} BPM`;
    document.getElementById('hrMaxValue').textContent = `${max} BPM`;
    
    updateAdditionalHeartRateStats({
        range,
        zone1,
        zone2,
        zone3,
        zone4,
        totalReadings: values.length
    });
}

function updateSleepStats(data) {
    if (data.length === 0) {
        document.getElementById('sleepAvgValue').textContent = '0H';
        document.getElementById('sleepEfficiencyValue').textContent = '0%';
        document.getElementById('deepSleepValue').textContent = '0H';
        updateAdditionalSleepStats([]);
        return;
    }
    
    const totalMinutes = data.reduce((sum, d) => sum + d.value, 0);
    const avgMinutes = totalMinutes / data.length;
    const avgHours = (avgMinutes / 60).toFixed(1);
    
    const avgEfficiency = data.reduce((sum, d) => sum + (d.efficiency || 85), 0) / data.length;
    const avgDeepSleep = data.reduce((sum, d) => sum + (d.deep_sleep || d.value * 0.25), 0) / data.length;
    const deepHours = (avgDeepSleep / 60).toFixed(1);
    
    // Additional calculations
    const bestSleep = Math.max(...data.map(d => d.value));
    const worstSleep = Math.min(...data.map(d => d.value));
    const optimalSleepDays = data.filter(d => d.value >= 420 && d.value <= 540).length; // 7-9 hours
    const avgLightSleep = data.reduce((sum, d) => sum + (d.light_sleep || d.value * 0.55), 0) / data.length;
    const avgRemSleep = data.reduce((sum, d) => sum + (d.rem_sleep || d.value * 0.20), 0) / data.length;
    
    document.getElementById('sleepAvgValue').textContent = `${avgHours}H`;
    document.getElementById('sleepEfficiencyValue').textContent = `${Math.round(avgEfficiency)}%`;
    document.getElementById('deepSleepValue').textContent = `${deepHours}H`;
    
    updateAdditionalSleepStats({
        bestSleep: (bestSleep / 60).toFixed(1),
        worstSleep: (worstSleep / 60).toFixed(1),
        optimalSleepDays,
        totalDays: data.length,
        avgLightSleep: (avgLightSleep / 60).toFixed(1),
        avgRemSleep: (avgRemSleep / 60).toFixed(1)
    });
}

function updateCaloriesStats(values) {
    if (values.length === 0) {
        document.getElementById('caloriesTotalValue').textContent = '0';
        document.getElementById('caloriesAvgValue').textContent = '0';
        document.getElementById('caloriesBestValue').textContent = '0';
        updateAdditionalCaloriesStats([]);
        return;
    }
    
    const total = values.reduce((sum, val) => sum + val, 0);
    const average = Math.round(total / values.length);
    const best = Math.max(...values);
    const worst = Math.min(...values);
    const goal = 2000; // Daily calorie goal
    const goalAchieved = values.filter(v => v >= goal).length;
    
    document.getElementById('caloriesTotalValue').textContent = total.toLocaleString();
    document.getElementById('caloriesAvgValue').textContent = average.toLocaleString();
    document.getElementById('caloriesBestValue').textContent = best.toLocaleString();
    
    updateAdditionalCaloriesStats({
        worst,
        goalAchieved,
        totalDays: values.length,
        goal,
        weeklyAvg: Math.round(total / Math.ceil(values.length / 7))
    });
}

// ========================================
// ADDITIONAL STATS FUNCTIONS
// ========================================

function updateAdditionalStepsStats(stats) {
    const container = document.querySelector('.steps-chart-widget .additional-stats');
    if (!container) return;
    
    if (stats.length === 0 || !stats.totalDays) {
        container.innerHTML = '<div class="no-additional-data">NO ADDITIONAL DATA</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="additional-stat-item">
            <div class="additional-stat-label">LOWEST</div>
            <div class="additional-stat-value">${stats.worst.toLocaleString()}</div>
        </div>
        <div class="additional-stat-item">
            <div class="additional-stat-label">GOAL HIT</div>
            <div class="additional-stat-value">${stats.goalAchieved}/${stats.totalDays}</div>
        </div>
        <div class="additional-stat-item">
            <div class="additional-stat-label">SUCCESS</div>
            <div class="additional-stat-value">${Math.round((stats.goalAchieved / stats.totalDays) * 100)}%</div>
        </div>
        <div class="additional-stat-item">
            <div class="additional-stat-label">GOAL</div>
            <div class="additional-stat-value">${stats.goal.toLocaleString()}</div>
        </div>
    `;
}

function updateAdditionalHeartRateStats(stats) {
    const container = document.querySelector('.heartrate-chart-widget .additional-stats');
    if (!container) return;
    
    if (stats.length === 0 || !stats.totalReadings) {
        container.innerHTML = '<div class="no-additional-data">NO ADDITIONAL DATA</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="additional-stat-item">
            <div class="additional-stat-label">RANGE</div>
            <div class="additional-stat-value">${stats.range} BPM</div>
        </div>
        <div class="additional-stat-item">
            <div class="additional-stat-label">RECOVERY</div>
            <div class="additional-stat-value">${stats.zone1}</div>
        </div>
        <div class="additional-stat-item">
            <div class="additional-stat-label">AEROBIC</div>
            <div class="additional-stat-value">${stats.zone2}</div>
        </div>
        <div class="additional-stat-item">
            <div class="additional-stat-label">INTENSE</div>
            <div class="additional-stat-value">${stats.zone3 + stats.zone4}</div>
        </div>
    `;
}

function updateAdditionalSleepStats(stats) {
    const container = document.querySelector('.sleep-chart-widget .additional-stats');
    if (!container) return;
    
    if (stats.length === 0 || !stats.totalDays) {
        container.innerHTML = '<div class="no-additional-data">NO ADDITIONAL DATA</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="additional-stat-item">
            <div class="additional-stat-label">BEST</div>
            <div class="additional-stat-value">${stats.bestSleep}H</div>
        </div>
        <div class="additional-stat-item">
            <div class="additional-stat-label">WORST</div>
            <div class="additional-stat-value">${stats.worstSleep}H</div>
        </div>
        <div class="additional-stat-item">
            <div class="additional-stat-label">OPTIMAL</div>
            <div class="additional-stat-value">${stats.optimalSleepDays}/${stats.totalDays}</div>
        </div>
        <div class="additional-stat-item">
            <div class="additional-stat-label">LIGHT</div>
            <div class="additional-stat-value">${stats.avgLightSleep}H</div>
        </div>
    `;
}

function updateAdditionalCaloriesStats(stats) {
    const container = document.querySelector('.calories-chart-widget .additional-stats');
    if (!container) return;
    
    if (stats.length === 0 || !stats.totalDays) {
        container.innerHTML = '<div class="no-additional-data">NO ADDITIONAL DATA</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="additional-stat-item">
            <div class="additional-stat-label">LOWEST</div>
            <div class="additional-stat-value">${stats.worst.toLocaleString()}</div>
        </div>
        <div class="additional-stat-item">
            <div class="additional-stat-label">GOAL HIT</div>
            <div class="additional-stat-value">${stats.goalAchieved}/${stats.totalDays}</div>
        </div>
        <div class="additional-stat-item">
            <div class="additional-stat-label">WEEKLY</div>
            <div class="additional-stat-value">${stats.weeklyAvg.toLocaleString()}</div>
        </div>
        <div class="additional-stat-item">
            <div class="additional-stat-label">GOAL</div>
            <div class="additional-stat-value">${stats.goal.toLocaleString()}</div>
        </div>
    `;
}

function updateDataIndicator(widgetClass, availability) {
    const widget = document.querySelector(`.${widgetClass}`);
    if (!widget) return;
    
    let existingIndicator = widget.querySelector('.data-availability');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    const indicator = document.createElement('div');
    indicator.className = `data-availability ${availability}`;
    
    const messages = {
        'good-coverage': 'GOOD DATA COVERAGE',
        'medium-coverage': 'PARTIAL DATA',
        'low-coverage': 'LIMITED DATA',
        'no-data': 'NO DATA AVAILABLE'
    };
    
    indicator.textContent = messages[availability] || 'UNKNOWN STATUS';
    
    const widgetContent = widget.querySelector('.widget-content');
    if (widgetContent) {
        widgetContent.appendChild(indicator);
    }
}

// ========================================
// COMPARISON FUNCTIONS (ENHANCED)
// ========================================

function updateComparison() {
    if (!comparisonMode) return;
    
    console.log('📊 Updating comparison data...');
    
    // Calculate previous period data
    const previousDate = getPreviousDate(currentDate, currentPeriod);
    const previousRange = getDateRange(currentPeriod, previousDate);
    
    // Get current stats
    const currentStats = getCurrentPeriodStats();
    
    // For demo purposes, generate previous stats
    // In production, you would fetch actual previous period data
    const previousStats = generatePreviousPeriodStats(currentStats);
    
    updateComparisonDisplay(currentStats, previousStats);
}

function getCurrentPeriodStats() {
    return {
        steps: parseInt(document.getElementById('stepsTotalValue').textContent.replace(/,/g, '')) || 0,
        heartRate: parseInt(document.getElementById('hrAvgValue').textContent.replace(' BPM', '')) || 0,
        sleep: parseFloat(document.getElementById('sleepAvgValue').textContent.replace('H', '')) || 0,
        calories: parseInt(document.getElementById('caloriesTotalValue').textContent.replace(/,/g, '')) || 0
    };
}

function generatePreviousPeriodStats(currentStats) {
    // Generate realistic previous period data for comparison
    const variance = 0.15; // 15% variance
    
    return {
        steps: Math.max(0, Math.round(currentStats.steps * (1 + (Math.random() - 0.5) * variance))),
        heartRate: Math.max(50, Math.round(currentStats.heartRate * (1 + (Math.random() - 0.5) * 0.1))),
        sleep: Math.max(4, parseFloat((currentStats.sleep * (1 + (Math.random() - 0.5) * 0.2)).toFixed(1))),
        calories: Math.max(0, Math.round(currentStats.calories * (1 + (Math.random() - 0.5) * variance)))
    };
}

function updateComparisonDisplay(current, previous) {
    // Steps comparison
    document.getElementById('stepsCurrentComp').textContent = current.steps.toLocaleString();
    document.getElementById('stepsPreviousComp').textContent = previous.steps.toLocaleString();
    updateComparisonChange('stepsChange', current.steps, previous.steps);
    
    // Heart rate comparison
    document.getElementById('hrCurrentComp').textContent = `${current.heartRate} BPM`;
    document.getElementById('hrPreviousComp').textContent = `${previous.heartRate} BPM`;
    updateComparisonChange('hrChange', current.heartRate, previous.heartRate);
    
    // Sleep comparison
    document.getElementById('sleepCurrentComp').textContent = `${current.sleep.toFixed(1)}H`;
    document.getElementById('sleepPreviousComp').textContent = `${previous.sleep.toFixed(1)}H`;
    updateComparisonChange('sleepChange', current.sleep, previous.sleep);
    
    // Calories comparison
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

function getPreviousDate(date, period) {
    const previousDate = new Date(date);
    
    switch (period) {
        case 'daily':
            previousDate.setDate(date.getDate() - 7);
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

// ========================================
// LOADING AND ERROR HANDLING
// ========================================

function showLoading() {
    console.log('⏳ Showing loading overlay...');
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

function hideLoading() {
    console.log('✅ Hiding loading overlay...');
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function showErrorToast(message) {
    console.error("🚨 ERROR:", message);
    
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
    console.log("✅ SUCCESS:", message);
    
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
// DATA LOADING AND PROCESSING
// ========================================

async function loadAllHealthData() {
    console.log('📊 Loading all health data...');
    
    const userId = getCurrentUserId();
    if (!userId) {
        console.error('❌ No user ID found');
        showErrorToast('User not found. Please log in again.');
        return;
    }
    
    showLoading();
    
    try {
        const dateRange = getDateRange(currentPeriod, currentDate);
        console.log(`📅 Loading data for period: ${currentPeriod}, range: ${dateRange.start} to ${dateRange.end}`);
        
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
        
        console.log('✅ All health data loaded successfully');
        
        // Process data based on current period
        const processedData = processDataForPeriod(healthData, currentPeriod);
        
        // Update all charts
        updateAllCharts(processedData);
        
        // Update comparison if enabled
        if (comparisonMode) {
            updateComparison();
        }
        
        hideLoading();
        
    } catch (error) {
        console.error('❌ Error loading health data:', error);
        showErrorToast('Failed to load health data. Please try again.');
        hideLoading();
    }
}

function processDataForPeriod(data, period) {
    console.log(`🔄 Processing data for ${period} view`);
    
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
    console.log('📅 Aggregating data by week...');
    
    const weeklyData = {};
    
    data.forEach(item => {
        const date = new Date(item.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
        const weekKey = formatDate(weekStart);
        
        if (!weeklyData[weekKey]) {
            weeklyData[weekKey] = {
                date: weekKey,
                values: [],
                dataType: item.dataType,
                sleepData: []
            };
        }
        
        weeklyData[weekKey].values.push(item.value);
        
        // Preserve sleep-specific data
        if (item.dataType === 'sleep') {
            weeklyData[weekKey].sleepData.push({
                deep_sleep: item.deep_sleep,
                light_sleep: item.light_sleep,
                rem_sleep: item.rem_sleep,
                efficiency: item.efficiency
            });
        }
    });
    
    // Convert to array and calculate averages/totals
    return Object.values(weeklyData).map(week => {
        const result = {
            date: week.date,
            value: week.dataType === 'steps' || week.dataType === 'calories' 
                ? week.values.reduce((sum, val) => sum + val, 0) // Total for steps/calories
                : Math.round(week.values.reduce((sum, val) => sum + val, 0) / week.values.length), // Average for others
            dataType: week.dataType
        };
        
        // Add sleep-specific aggregated data
        if (week.dataType === 'sleep' && week.sleepData.length > 0) {
            result.deep_sleep = Math.round(week.sleepData.reduce((sum, d) => sum + (d.deep_sleep || 0), 0) / week.sleepData.length);
            result.light_sleep = Math.round(week.sleepData.reduce((sum, d) => sum + (d.light_sleep || 0), 0) / week.sleepData.length);
            result.rem_sleep = Math.round(week.sleepData.reduce((sum, d) => sum + (d.rem_sleep || 0), 0) / week.sleepData.length);
            result.efficiency = Math.round(week.sleepData.reduce((sum, d) => sum + (d.efficiency || 85), 0) / week.sleepData.length);
        }
        
        return result;
    });
}

function aggregateDataByMonth(data) {
    console.log('📅 Aggregating data by month...');
    
    const monthlyData = {};
    
    data.forEach(item => {
        const date = new Date(item.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                date: monthKey,
                values: [],
                dataType: item.dataType,
                sleepData: []
            };
        }
        
        monthlyData[monthKey].values.push(item.value);
        
        // Preserve sleep-specific data
        if (item.dataType === 'sleep') {
            monthlyData[monthKey].sleepData.push({
                deep_sleep: item.deep_sleep,
                light_sleep: item.light_sleep,
                rem_sleep: item.rem_sleep,
                efficiency: item.efficiency
            });
        }
    });
    
    // Convert to array and calculate averages/totals
    return Object.values(monthlyData).map(month => {
        const result = {
            date: month.date,
            value: month.dataType === 'steps' || month.dataType === 'calories' 
                ? month.values.reduce((sum, val) => sum + val, 0) // Total for steps/calories
                : Math.round(month.values.reduce((sum, val) => sum + val, 0) / month.values.length), // Average for others
            dataType: month.dataType
        };
        
        // Add sleep-specific aggregated data
        if (month.dataType === 'sleep' && month.sleepData.length > 0) {
            result.deep_sleep = Math.round(month.sleepData.reduce((sum, d) => sum + (d.deep_sleep || 0), 0) / month.sleepData.length);
            result.light_sleep = Math.round(month.sleepData.reduce((sum, d) => sum + (d.light_sleep || 0), 0) / month.sleepData.length);
            result.rem_sleep = Math.round(month.sleepData.reduce((sum, d) => sum + (d.rem_sleep || 0), 0) / month.sleepData.length);
            result.efficiency = Math.round(month.sleepData.reduce((sum, d) => sum + (d.efficiency || 85), 0) / month.sleepData.length);
        }
        
        return result;
    });
}

function updateAllCharts(data) {
    console.log('📊 Updating all charts with processed data...');
    
    // Get current chart types from active buttons
    const stepsChartType = document.querySelector('.steps-chart-widget .chart-btn.active')?.dataset.chart || 'bar';
    const heartRateChartType = document.querySelector('.heartrate-chart-widget .chart-btn.active')?.dataset.chart || 'line';
    const sleepChartType = document.querySelector('.sleep-chart-widget .chart-btn.active')?.dataset.chart || 'stacked';
    const caloriesChartType = document.querySelector('.calories-chart-widget .chart-btn.active')?.dataset.chart || 'pie';
    
    // Update each chart
    createStepsChart(data.steps, stepsChartType);
    createHeartRateChart(data.heartrate, heartRateChartType);
    createSleepChart(data.sleep, sleepChartType);
    createCaloriesChart(data.calories, caloriesChartType);
    
    console.log('✅ All charts updated successfully');
}

// ========================================
// USER INTERFACE HANDLERS
// ========================================

function updatePeriodDisplay() {
    const periodLabel = getPeriodLabel(currentPeriod, currentDate);
    document.getElementById('currentPeriod').textContent = periodLabel;
    
    // Update navigation buttons
    const nextBtn = document.getElementById('nextPeriod');
    const today = new Date();
    
    // Disable next button if we're at current period
    if (currentPeriod === 'daily' && formatDate(currentDate) === formatDate(today)) {
        nextBtn.disabled = true;
    } else if (currentPeriod === 'weekly' && 
               currentDate.getTime() >= today.getTime() - (7 * 24 * 60 * 60 * 1000)) {
        nextBtn.disabled = true;
    } else if (currentPeriod === 'monthly' && 
               currentDate.getMonth() === today.getMonth() && 
               currentDate.getFullYear() === today.getFullYear()) {
        nextBtn.disabled = true;
    } else {
        nextBtn.disabled = false;
    }
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
    loadAllHealthData();
}

function changePeriod(newPeriod) {
    console.log(`🔄 Changing period from ${currentPeriod} to ${newPeriod}`);
    
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
    loadAllHealthData();
}

function toggleComparison() {
    comparisonMode = !comparisonMode;
    console.log(`🔄 Comparison mode: ${comparisonMode ? 'enabled' : 'disabled'}`);
    
    const comparisonPanel = document.getElementById('comparisonPanel');
    if (comparisonMode) {
        comparisonPanel.style.display = 'block';
        updateComparison();
    } else {
        comparisonPanel.style.display = 'none';
    }
}

function changeChartType(widgetClass, chartType) {
    console.log(`📊 Changing ${widgetClass} chart to ${chartType}`);
    
    // Update active button
    const widget = document.querySelector(`.${widgetClass}`);
    widget.querySelectorAll('.chart-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.chart === chartType) {
            btn.classList.add('active');
        }
    });
    
    // Recreate chart with new type
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

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Stats page loading started...');
    
    // Initialize stars background
    createStars();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize display
    updatePeriodDisplay();
    
    // Load initial data
    setTimeout(() => {
        loadAllHealthData();
    }, 500);
    
    console.log('✅ Stats page initialized successfully');
});

function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // Period selector buttons
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            changePeriod(btn.dataset.period);
        });
    });
    
    // Navigation buttons
    document.getElementById('prevPeriod')?.addEventListener('click', () => {
        navigatePeriod('prev');
    });
    
    document.getElementById('nextPeriod')?.addEventListener('click', () => {
        navigatePeriod('next');
    });
    
    // Comparison toggle
    document.getElementById('comparisonMode')?.addEventListener('change', (e) => {
        toggleComparison();
    });
    
    // Chart type buttons
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const widget = btn.closest('.stat-widget');
            const widgetClass = widget.className.split(' ').find(cls => cls.includes('-chart-widget'));
            const chartType = btn.dataset.chart;
            changeChartType(widgetClass, chartType);
        });
    });
    
    // Add hover effects to widgets
    document.querySelectorAll('.stat-widget').forEach(widget => {
        widget.addEventListener('mouseenter', () => {
            widget.style.transform = 'translateY(-8px) scale(1.02)';
        });
        
        widget.addEventListener('mouseleave', () => {
            widget.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Add refresh button functionality
    const refreshBtn = document.getElementById('refreshData');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadAllHealthData();
            showSuccessToast('Data refreshed successfully');
        });
    }
    
    console.log('✅ Event listeners set up successfully');
}

// ========================================
// UTILITY FUNCTIONS FOR USER PROFILE
// ========================================

async function loadUserProfile() {
    console.log('👤 Loading user profile for navigation...');
    
    const userId = getCurrentUserId();
    if (!userId) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`);
        if (response.ok) {
            const userData = await response.json();
            updateNavigationUserInfo(userData.data);
        }
    } catch (error) {
        console.error('❌ Error loading user profile:', error);
    }
}

function updateNavigationUserInfo(userData) {
    const userNameElement = document.querySelector('.user-name');
    const userStatusElement = document.querySelector('.user-status');
    const userAvatarElement = document.querySelector('.user-avatar');
    
    if (userNameElement && userData.firstName && userData.lastName) {
        const fullName = `${userData.firstName.toUpperCase()} ${userData.lastName.toUpperCase()}`;
        userNameElement.textContent = fullName;
    }
    
    if (userStatusElement) {
        const status = userData.fit_tokens ? 'GOOGLE FIT CONNECTED' : 'NOT CONNECTED';
        userStatusElement.textContent = status;
        
        // Update status color based on connection
        if (userData.fit_tokens) {
            userStatusElement.style.color = '#4CAF50';
        } else {
            userStatusElement.style.color = '#F44336';
        }
    }
    
    if (userAvatarElement && userData.firstName && userData.lastName) {
        const initials = `${userData.firstName.charAt(0)}${userData.lastName.charAt(0)}`;
        userAvatarElement.textContent = initials;
    }
}

// Load user profile on page load
document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
});

// ========================================
// RESPONSIVE CHART HANDLING
// ========================================

function handleResize() {
    console.log('📱 Handling window resize...');
    
    // Adjust canvas sizes for mobile
    const canvases = document.querySelectorAll('canvas');
    canvases.forEach(canvas => {
        const container = canvas.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        // Set responsive canvas size
        if (window.innerWidth <= 768) {
            canvas.width = Math.min(containerWidth - 20, 400);
            canvas.height = Math.min(containerHeight - 20, 250);
        } else {
            canvas.width = Math.min(containerWidth - 20, 600);
            canvas.height = Math.min(containerHeight - 20, 300);
        }
    });
    
    // Redraw all charts with current data
    if (healthData && Object.keys(healthData).length > 0) {
        const processedData = processDataForPeriod(healthData, currentPeriod);
        updateAllCharts(processedData);
    }
}

// Add resize listener with debounce
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleResize, 250);
});

// ========================================
// KEYBOARD SHORTCUTS
// ========================================

document.addEventListener('keydown', (e) => {
    // Only handle shortcuts when not typing in inputs
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
            loadAllHealthData();
            showSuccessToast('Data refreshed via keyboard shortcut');
            break;
    }
});

// ========================================
// TOAST NOTIFICATION SYSTEM
// ========================================

function createToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

function showToast(message, type = 'info', duration = 3000) {
    const container = createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }, duration);
    
    // Add click to dismiss
    toast.addEventListener('click', () => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    });
}

// Update existing toast functions to use new system
function showErrorToast(message) {
    console.error("🚨 ERROR:", message);
    showToast(message, 'error', 4000);
}

function showSuccessToast(message) {
    console.log("✅ SUCCESS:", message);
    showToast(message, 'success', 3000);
}

function showWarningToast(message) {
    console.warn("⚠️ WARNING:", message);
    showToast(message, 'warning', 3500);
}

// ========================================
// DATA EXPORT FUNCTIONALITY
// ========================================

function exportHealthData(format = 'json') {
    console.log(`📤 Exporting health data in ${format} format...`);
    
    if (!healthData || Object.keys(healthData).length === 0) {
        showWarningToast('No data available to export');
        return;
    }
    
    const exportData = {
        exportDate: new Date().toISOString(),
        period: currentPeriod,
        dateRange: getDateRange(currentPeriod, currentDate),
        data: healthData,
        summary: {
            steps: getCurrentPeriodStats().steps,
            heartRate: getCurrentPeriodStats().heartRate,
            sleep: getCurrentPeriodStats().sleep,
            calories: getCurrentPeriodStats().calories
        }
    };
    
    let content, filename, mimeType;
    
    switch (format) {
        case 'json':
            content = JSON.stringify(exportData, null, 2);
            filename = `health-data-${currentPeriod}-${formatDate(new Date())}.json`;
            mimeType = 'application/json';
            break;
        case 'csv':
            content = convertToCSV(exportData);
            filename = `health-data-${currentPeriod}-${formatDate(new Date())}.csv`;
            mimeType = 'text/csv';
            break;
        default:
            showErrorToast('Unsupported export format');
            return;
    }
    
    // Create and trigger download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSuccessToast(`Health data exported as ${filename}`);
}

function convertToCSV(exportData) {
    const csvRows = [];
    
    // Add header
    csvRows.push('Date,Steps,Heart Rate (BPM),Sleep (Hours),Calories');
    
    // Get all unique dates
    const allDates = new Set();
    Object.values(exportData.data).forEach(dataArray => {
        dataArray.forEach(item => allDates.add(item.date));
    });
    
    // Sort dates
    const sortedDates = Array.from(allDates).sort();
    
    // Create rows
    sortedDates.forEach(date => {
        const stepsItem = exportData.data.steps.find(item => item.date === date);
        const heartRateItem = exportData.data.heartrate.find(item => item.date === date);
        const sleepItem = exportData.data.sleep.find(item => item.date === date);
        const caloriesItem = exportData.data.calories.find(item => item.date === date);
        
        const row = [
            date,
            stepsItem ? stepsItem.value : 0,
            heartRateItem ? heartRateItem.value : 0,
            sleepItem ? (sleepItem.value / 60).toFixed(1) : 0,
            caloriesItem ? caloriesItem.value : 0
        ];
        
        csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
}

// ========================================
// OFFLINE SUPPORT
// ========================================

function checkOnlineStatus() {
    const isOnline = navigator.onLine;
    const statusIndicator = document.getElementById('connection-status');
    
    if (statusIndicator) {
        if (isOnline) {
            statusIndicator.textContent = 'ONLINE';
            statusIndicator.className = 'connection-status online';
        } else {
            statusIndicator.textContent = 'OFFLINE';
            statusIndicator.className = 'connection-status offline';
            showWarningToast('You are currently offline. Some features may be limited.');
        }
    }
}

// Listen for online/offline events
window.addEventListener('online', () => {
    checkOnlineStatus();
    showSuccessToast('Connection restored. Syncing data...');
    loadAllHealthData();
});

window.addEventListener('offline', () => {
    checkOnlineStatus();
    showWarningToast('Connection lost. Working in offline mode.');
});

// ========================================
// ACCESSIBILITY IMPROVEMENTS
// ========================================

function setupAccessibility() {
    // Add ARIA labels to charts
    document.querySelectorAll('canvas').forEach((canvas, index) => {
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `Health data chart ${index + 1}`);
    });
    
    // Add keyboard navigation for chart controls
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.setAttribute('tabindex', '0');
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                btn.click();
            }
        });
    });
    
    // Add focus indicators
    document.querySelectorAll('.period-btn, .nav-btn, .chart-btn').forEach(btn => {
        btn.addEventListener('focus', () => {
            btn.style.outline = '2px solid #FF6F00';
            btn.style.outlineOffset = '2px';
        });
        
        btn.addEventListener('blur', () => {
            btn.style.outline = 'none';
        });
    });
}

// ========================================
// PERFORMANCE MONITORING
// ========================================

function measurePerformance(label, fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.log(`⏱️ ${label} took ${(end - start).toFixed(2)}ms`);
    return result;
}

// ========================================
// FINAL INITIALIZATION
// ========================================

// Initialize accessibility features
document.addEventListener('DOMContentLoaded', () => {
    setupAccessibility();
    checkOnlineStatus();
});

// Add export functionality to UI if export button exists
document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('exportData');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const format = document.getElementById('exportFormat')?.value || 'json';
            exportHealthData(format);
        });
    }
});

// Service Worker registration for offline support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('✅ Service Worker registered successfully');
            })
            .catch(error => {
                console.log('❌ Service Worker registration failed:', error);
            });
    });
}

console.log('📊 Enhanced Stats.js loaded successfully with all features');

// ========================================
// DEBUGGING AND DEVELOPMENT HELPERS
// ========================================

// Development mode helpers (only in development)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.healthDebug = {
        getCurrentData: () => healthData,
        getDataAvailability: () => dataAvailability,
        forceRefresh: () => loadAllHealthData(),
        exportDebugInfo: () => {
            const debugInfo = {
                currentPeriod,
                currentDate: currentDate.toISOString(),
                comparisonMode,
                healthData,
                dataAvailability,
                userAgent: navigator.userAgent,
                screenSize: `${window.innerWidth}x${window.innerHeight}`,
                timestamp: new Date().toISOString()
            };
            console.log('🐛 Debug Info:', debugInfo);
            return debugInfo;
        }
    };
    
    console.log('🔧 Development mode: healthDebug object available in console');
}