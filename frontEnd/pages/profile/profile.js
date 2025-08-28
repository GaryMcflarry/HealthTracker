// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';
const USER_ID = localStorage.getItem('userId') || 1; // Default to user 1 for demo

// Goal Setting & Progress Tracking
class GoalManager {
    async loadGoals() {
        try {
            // For now, load default goals since API requires auth
            this.loadDefaultGoals();
        } catch (error) {
            console.error('Failed to load goals:', error);
            this.loadDefaultGoals();
        }
    }

    loadDefaultGoals() {
        // Set default values and update progress display - matching schema data types
        const defaultGoals = [
            { goalType: 'steps', targetValue: 10000, currentValue: 8200, progressPercentage: 82 },
            { goalType: 'calories', targetValue: 2500, currentValue: 1850, progressPercentage: 74 },
            { goalType: 'sleep', targetValue: 8, currentValue: 7.2, progressPercentage: 90 },
            { goalType: 'heart_rate', targetValue: 70, currentValue: 68, progressPercentage: 85 }
        ];
        
        this.updateGoalDisplay(defaultGoals);
    }

    async saveGoals() {
        const goals = this.getGoalInputs();
        try {
            // Store goals in localStorage for now since API requires auth
            localStorage.setItem('userGoals', JSON.stringify(goals));
            this.showSuccess('Goals saved successfully!');
            
            // Update progress display with new targets
            this.updateGoalTargets(goals);
        } catch (error) {
            console.error('Failed to save goals:', error);
            this.showError('Failed to save goals');
        }
    }

    getGoalInputs() {
        return [
            { 
                goalType: 'steps', 
                targetValue: parseInt(document.getElementById('steps-goal').value), 
                timeFrame: 'daily', 
                icon: '👟',
                dataType: 'steps_count'
            },
            { 
                goalType: 'calories', 
                targetValue: parseInt(document.getElementById('calories-goal').value), 
                timeFrame: 'daily', 
                icon: '🔥',
                dataType: 'calories'
            },
            { 
                goalType: 'sleep', 
                targetValue: parseFloat(document.getElementById('sleep-goal').value), 
                timeFrame: 'daily', 
                icon: '😴',
                dataType: 'sleep_hours'
            },
            { 
                goalType: 'heart_rate', 
                targetValue: parseInt(document.getElementById('heart-rate-goal').value), 
                timeFrame: 'daily', 
                icon: '❤️',
                dataType: 'heart_rate_bpm'
            }
        ];
    }

    updateGoalTargets(goals) {
        goals.forEach(goal => {
            const summaryElement = document.querySelector(`[data-goal="${goal.goalType}"] .summary-value`);
            if (summaryElement) {
                let displayValue = goal.targetValue;
                if (goal.goalType === 'steps') displayValue = `${goal.targetValue.toLocaleString()}/DAY`;
                else if (goal.goalType === 'calories') displayValue = `${goal.targetValue.toLocaleString()}/DAY`;
                else if (goal.goalType === 'sleep') displayValue = `${goal.targetValue} HOURS`;
                else if (goal.goalType === 'heart_rate') displayValue = `${goal.targetValue} BPM`;
                
                summaryElement.textContent = displayValue;
            }
        });
        
        // Update goals summary tab
        this.updateGoalsSummaryTab(goals);
    }

    updateGoalsSummaryTab(goals) {
        const summaryItems = document.querySelectorAll('.goal-summary-item .summary-value');
        goals.forEach(goal => {
            let targetElement = null;
            if (goal.goalType === 'steps') targetElement = summaryItems[0];
            else if (goal.goalType === 'calories') targetElement = summaryItems[1];
            else if (goal.goalType === 'sleep') targetElement = summaryItems[2];
            else if (goal.goalType === 'heart_rate') targetElement = summaryItems[3];
            
            if (targetElement) {
                let displayValue = goal.targetValue;
                if (goal.goalType === 'steps') displayValue = `${goal.targetValue.toLocaleString()}/DAY`;
                else if (goal.goalType === 'calories') displayValue = `${goal.targetValue.toLocaleString()}/DAY`;
                else if (goal.goalType === 'sleep') displayValue = `${goal.targetValue} HOURS`;
                else if (goal.goalType === 'heart_rate') displayValue = `${goal.targetValue} BPM`;
                
                targetElement.textContent = displayValue;
            }
        });
    }

    updateGoalDisplay(goals) {
        goals.forEach(goal => {
            const progressBar = document.querySelector(`[data-goal="${goal.goalType}"] .progress-fill`);
            const progressText = document.querySelector(`[data-goal="${goal.goalType}"] .progress-text`);
            
            if (progressBar) {
                progressBar.style.width = `${goal.progressPercentage}%`;
            }
            
            if (progressText) {
                if (goal.goalType === 'steps') {
                    progressText.textContent = `${goal.progressPercentage}% TODAY`;
                } else if (goal.goalType === 'calories') {
                    progressText.textContent = `${goal.progressPercentage}% TODAY`;
                } else if (goal.goalType === 'sleep') {
                    progressText.textContent = `${goal.progressPercentage}% LAST NIGHT`;
                } else if (goal.goalType === 'heart_rate') {
                    progressText.textContent = `${goal.progressPercentage}% TODAY`;
                }
            }
        });
    }

    showSuccess(message) {
        const btn = document.querySelector('.save-goals-btn');
        const originalText = btn.textContent;
        const originalColor = btn.style.backgroundColor;
        
        btn.textContent = 'SAVED!';
        btn.style.backgroundColor = '#4CAF50';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = originalColor;
        }, 2000);
    }

    showError(message) {
        alert(message);
    }

    // Dashboard integration - get goals for dashboard progress comparison
    getGoalsForDashboard() {
        const savedGoals = localStorage.getItem('userGoals');
        if (savedGoals) {
            return JSON.parse(savedGoals);
        }
        
        // Return default goals if none saved
        return [
            { goalType: 'steps', targetValue: 10000, dataType: 'steps_count', timeFrame: 'daily', icon: '👟' },
            { goalType: 'calories', targetValue: 2500, dataType: 'calories', timeFrame: 'daily', icon: '🔥' },
            { goalType: 'sleep', targetValue: 8, dataType: 'sleep_hours', timeFrame: 'daily', icon: '😴' },
            { goalType: 'heart_rate', targetValue: 70, dataType: 'heart_rate_bpm', timeFrame: 'daily', icon: '❤️' }
        ];
    }

    // Calculate progress for dashboard
    calculateGoalProgress(currentValue, targetValue) {
        if (!targetValue || targetValue === 0) return 0;
        const percentage = Math.round((currentValue / targetValue) * 100);
        return Math.min(percentage, 100); // Cap at 100%
    }
}

// Global function for dashboard access
window.getHealthGoals = function() {
    return goalManager.getGoalsForDashboard();
};

window.calculateGoalProgress = function(current, target) {
    return goalManager.calculateGoalProgress(current, target);
};

// User Profile Manager
class ProfileManager {
    async loadUserProfile() {
        console.log(`Loading profile for user ID: ${USER_ID}`);
        try {
            const response = await fetch(`${API_BASE_URL}/users/${USER_ID}`);
            console.log(`Response status: ${response.status}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('User data received:', data);
                this.populateUserForm(data.data);
            } else {
                // User doesn't exist, show empty form for new user creation
                console.log('User not found, showing empty form');
                this.populateUserForm(null);
            }
        } catch (error) {
            console.error('Failed to load user profile:', error);
            this.populateUserForm(null); // Show empty form on error
        }
    }

    async updateProfile() {
        const profileData = this.getProfileData();
        console.log('Updating profile with data:', profileData);
        
        try {
            const response = await fetch(`${API_BASE_URL}/users/${USER_ID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData)
            });
            
            console.log(`Update response status: ${response.status}`);
            
            if (response.ok) {
                const updatedData = await response.json();
                console.log('Profile updated successfully:', updatedData);
                this.showSuccess('Profile updated successfully!');
                // Refresh the form with updated data
                this.populateUserForm(updatedData.data);
            } else {
                const error = await response.json();
                console.error('Update failed:', error);
                this.showError(error.error || 'Failed to update profile');
            }
        } catch (error) {
            console.error('Failed to update profile:', error);
            this.showError('Failed to update profile');
        }
    }

    getProfileData() {
        return {
            email: document.getElementById('email')?.value || '',
            firstName: document.getElementById('firstName')?.value || '',
            lastName: document.getElementById('lastName')?.value || '',
            phoneNr: parseInt(document.getElementById('phoneNr')?.value) || null,
            gender: document.getElementById('gender')?.value || '',
            height: parseFloat(document.getElementById('height')?.value) || null,
            weight: parseFloat(document.getElementById('weight')?.value) || null,
            deviceName: document.getElementById('deviceName')?.value || ''
        };
    }

    populateUserForm(userData) {
        console.log('Populating form with userData:', userData);
        
        // Populate all form fields with null checks
        const emailField = document.getElementById('email');
        const firstNameField = document.getElementById('firstName');
        const lastNameField = document.getElementById('lastName');
        const phoneNrField = document.getElementById('phoneNr');
        const genderField = document.getElementById('gender');
        const heightField = document.getElementById('height');
        const weightField = document.getElementById('weight');
        const deviceNameField = document.getElementById('deviceName');

        if (emailField) emailField.value = userData?.email || '';
        if (firstNameField) firstNameField.value = userData?.firstName || '';
        if (lastNameField) lastNameField.value = userData?.lastName || '';
        if (phoneNrField) phoneNrField.value = userData?.phoneNr || '';
        if (genderField) genderField.value = userData?.gender || '';
        if (heightField) heightField.value = userData?.height || '';
        if (weightField) weightField.value = userData?.weight || '';
        if (deviceNameField) deviceNameField.value = userData?.deviceName || '';

        // Update user avatar and display name in navigation
        const userAvatar = document.querySelector('.user-avatar');
        const userName = document.querySelector('.user-name');
        const profileAvatar = document.querySelector('.profile-avatar-large .avatar-text');
        
        if (userData && userData.firstName && userData.lastName) {
            const initials = `${userData.firstName.charAt(0)}${userData.lastName.charAt(0)}`.toUpperCase();
            const fullName = `${userData.firstName} ${userData.lastName}`.toUpperCase();
            
            if (userAvatar) userAvatar.textContent = initials;
            if (userName) userName.textContent = fullName;
            if (profileAvatar) profileAvatar.textContent = initials;
        } else {
            // Default values for empty user
            if (userAvatar) userAvatar.textContent = 'U';
            if (userName) userName.textContent = 'NEW USER';
            if (profileAvatar) profileAvatar.textContent = 'U';
        }

        // Update device status
        const deviceName = document.querySelector('.device-name');
        const userStatus = document.querySelector('.user-status');
        if (userData?.deviceName) {
            if (deviceName) deviceName.textContent = userData.deviceName;
            if (userStatus) userStatus.textContent = `${userData.deviceName} CONNECTED`;
        } else {
            if (deviceName) deviceName.textContent = 'NO DEVICE';
            if (userStatus) userStatus.textContent = 'NO DEVICE CONNECTED';
        }

        console.log('Profile populated with:', userData);
    }

    showSuccess(message) {
        const btn = document.querySelector('.save-btn');
        const originalText = btn.textContent;
        const originalColor = btn.style.backgroundColor;
        
        btn.textContent = 'SAVED!';
        btn.style.backgroundColor = '#4CAF50';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = originalColor;
        }, 2000);
    }

    showError(message) {
        alert(message);
    }
}

// Initialize managers
const goalManager = new GoalManager();
const profileManager = new ProfileManager();

// Stars animation for profile page
function createStars() {
    const starsContainer = document.querySelector('.stars');
    const numberOfStars = 50;

    for (let i = 0; i < numberOfStars; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        
        // Random position
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        
        // Random size
        const size = Math.random() * 3 + 1;
        star.style.width = size + 'px';
        star.style.height = size + 'px';
        
        // Random animation delay
        star.style.animationDelay = Math.random() * 2 + 's';
        
        starsContainer.appendChild(star);
    }
}

// OAuth data handling for dashboard integration
function handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const oauthSuccess = urlParams.get('oauth');
    
    if (error) {
        console.error('OAuth authorization failed:', error);
        alert('OAuth authorization failed.');
        return;
    }
    
    if (oauthSuccess === 'success') {
        console.log('OAuth authorization successful!');
        
        // Clean up URL
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        // Show success message
        alert('Google Fit connected successfully! Your health data will now sync.');
        
        // Refresh last sync time
        loadLastSyncTime();
    }
}

// Load and display last sync time
async function loadLastSyncTime() {
    console.log('🔄 Loading last sync time...');
    
    const userData = localStorage.getItem('userData');
    if (!userData) {
        console.warn('⚠️ No user data found for sync time');
        return;
    }
    
    try {
        const user = JSON.parse(userData);
        const userId = user.userID;
        
        // Fetch fresh user data to get latest sync time
        const response = await fetch(`http://localhost:3000/api/users/${userId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch user data: ${response.status}`);
        }
        
        const result = await response.json();
        const lastSync = result.data.last_sync;
        
        const syncTimeElement = document.getElementById('navLastSyncTime');
        const syncIconElement = document.querySelector('.nav-sync-icon');
        
        if (lastSync) {
            const syncDate = new Date(lastSync);
            const timeAgo = getTimeAgo(syncDate);
            
            syncTimeElement.textContent = timeAgo;
            syncIconElement.textContent = '✅';
        } else {
            console.log('❌ No last sync time available');
            if (syncTimeElement) {
                syncTimeElement.textContent = 'NEVER';
            }
            if (syncIconElement) {
                syncIconElement.textContent = '❌';
            }
        }
        
    } catch (error) {
        console.error('❌ Error loading last sync time:', error);
        const syncTimeElement = document.getElementById('navLastSyncTime');
        const syncIconElement = document.querySelector('.nav-sync-icon');
        
        syncTimeElement.textContent = 'ERROR';
        syncIconElement.textContent = '❌';
    }
}

// Helper function to format time ago
function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'NOW';
    if (diffMins < 60) return `${diffMins}M`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}H`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}D`;
}

// Load user goals from backend
async function loadUserGoals() {
    console.log('🎯 Loading user goals...');
    
    const userData = localStorage.getItem('userData');
    if (!userData) {
        console.warn('⚠️ No user data found for goals');
        return;
    }
    
    try {
        const user = JSON.parse(userData);
        const userId = user.userID;
        
        const response = await fetch(`http://localhost:3000/api/goals`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch goals: ${response.status}`);
        }
        
        const result = await response.json();
        const goals = result.data || [];
        
        // Populate goal inputs with existing data
        goals.forEach(goal => {
            switch(goal.goal_type) {
                case 'steps':
                    const stepsInput = document.getElementById('stepsGoal');
                    if (stepsInput) stepsInput.value = goal.target_value;
                    break;
                case 'calories':
                    const caloriesInput = document.getElementById('caloriesGoal');
                    if (caloriesInput) caloriesInput.value = goal.target_value;
                    break;
                case 'sleep':
                    const sleepInput = document.getElementById('sleepGoal');
                    if (sleepInput) sleepInput.value = goal.target_value;
                    break;
                case 'heart_rate':
                    const heartRateInput = document.getElementById('heartRateGoal');
                    if (heartRateInput) heartRateInput.value = goal.target_value;
                    break;
            }
        });
        
        console.log('✅ Goals loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading goals:', error);
    }
}

// Save user goals to backend
async function saveUserGoals() {
    console.log('💾 Saving user goals...');
    
    const userData = localStorage.getItem('userData');
    if (!userData) {
        console.warn('⚠️ No user data found for saving goals');
        return;
    }
    
    try {
        const user = JSON.parse(userData);
        const userId = user.userID;
        
        // Get goal values from inputs
        const stepsGoal = document.getElementById('stepsGoal').value;
        const caloriesGoal = document.getElementById('caloriesGoal').value;
        const sleepGoal = document.getElementById('sleepGoal').value;
        const heartRateGoal = document.getElementById('heartRateGoal').value;
        
        const goals = [];
        
        if (stepsGoal) {
            goals.push({
                goalType: 'steps',
                targetValue: parseFloat(stepsGoal),
                icon: '👟'
            });
        }
        
        if (caloriesGoal) {
            goals.push({
                goalType: 'calories',
                targetValue: parseFloat(caloriesGoal),
                icon: '🔥'
            });
        }
        
        if (sleepGoal) {
            goals.push({
                goalType: 'sleep',
                targetValue: parseFloat(sleepGoal),
                icon: '😴'
            });
        }
        
        if (heartRateGoal) {
            goals.push({
                goalType: 'heart_rate',
                targetValue: parseFloat(heartRateGoal),
                icon: '❤️'
            });
        }
        
        // First, get existing goals to update them
        const existingResponse = await fetch(`http://localhost:3000/api/goals`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (existingResponse.ok) {
            const existingResult = await existingResponse.json();
            const existingGoals = existingResult.data || [];
            
            // Update existing goals or create new ones
            for (const newGoal of goals) {
                const existingGoal = existingGoals.find(g => g.goal_type === newGoal.goalType);
                
                if (existingGoal) {
                    // Update existing goal
                    const updateResponse = await fetch(`http://localhost:3000/api/goals/${existingGoal.id}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            target_value: newGoal.targetValue,
                            icon: newGoal.icon
                        })
                    });
                    
                    if (!updateResponse.ok) {
                        throw new Error(`Failed to update ${newGoal.goalType} goal`);
                    }
                } else {
                    // Create new goal
                    const createResponse = await fetch(`http://localhost:3000/api/goals`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('token')}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(newGoal)
                    });
                    
                    if (!createResponse.ok) {
                        throw new Error(`Failed to create ${newGoal.goalType} goal`);
                    }
                }
            }
        }
        
        console.log('✅ Goals saved successfully');
        alert('Goals saved successfully!');
        
    } catch (error) {
        console.error('❌ Error saving goals:', error);
        alert('Failed to save goals. Please try again.');
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Profile page initializing...');
    
    // Initialize stars animation
    createStars();
    
    // Load user profile data
    profileManager.loadUserProfile();
    
    // Initialize navigation
    // initializeNavigation();
    
    // Load last sync time after a short delay to ensure DOM is ready
    setTimeout(() => {
        loadLastSyncTime();
    }, 500);
    
    // Load user goals
    loadUserGoals();
    
    // Add event listener for save goals button
    const saveGoalsBtn = document.getElementById('saveGoalsBtn');
    if (saveGoalsBtn) {
        saveGoalsBtn.addEventListener('click', saveUserGoals);
    }
    
    console.log('✅ Profile page initialized successfully');
});

// Goal saving
document.querySelector('.save-goals-btn').addEventListener('click', () => {
    goalManager.saveGoals();
});

// Profile saving
document.querySelector('.save-btn').addEventListener('click', () => {
    profileManager.updateProfile();
    document.querySelector('.save-btn').addEventListener('click', () => {
        profileManager.updateProfile();
    });
});