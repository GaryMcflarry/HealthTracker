const API_BASE_URL = 'http://localhost:3000/api';

function getCurrentUserId() {
    const userData = localStorage.getItem('userData');
    if (userData) {
        try {
            const user = JSON.parse(userData);
            return user.userID;
        } catch (e) {
            return null;
        }
    }
    return null;
}

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

function showSuccess(buttonSelector, message = 'SAVED!') {
    const btn = document.querySelector(buttonSelector);
    if (btn) {
        const originalText = btn.textContent;
        const originalColor = btn.style.backgroundColor;
        
        btn.textContent = message;
        btn.style.backgroundColor = '#4CAF50';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = originalColor;
        }, 2000);
    }
}

function showError(message) {
    alert(message);
}

class GoalManager {
    constructor() {
        this.defaultGoals = [
            { goalType: 'steps', targetValue: 10000, icon: '👟' },
            { goalType: 'calories', targetValue: 2500, icon: '🔥' },
            { goalType: 'sleep', targetValue: 8, icon: '😴' },
            { goalType: 'heart_rate', targetValue: 70, icon: '❤️' }
        ];
        
        this.mockProgress = {
            steps: { currentValue: 8200, progressPercentage: 82 },
            calories: { currentValue: 1850, progressPercentage: 74 },
            sleep: { currentValue: 7.2, progressPercentage: 90 },
            heart_rate: { currentValue: 68, progressPercentage: 85 }
        };
    }

    async loadGoals() {
        const userId = getCurrentUserId();
        if (!userId) {
            this.loadDefaultGoals();
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/goals?userId=${userId}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.data && data.data.length > 0) {
                    this.populateGoalForms(data.data);
                    this.updateGoalDisplay(this.addProgressToGoals(data.data));
                } else {
                    this.loadDefaultGoals();
                }
            } else {
                this.loadDefaultGoals();
            }
        } catch (error) {
            this.loadDefaultGoals();
        }
    }

    loadDefaultGoals() {
        this.populateGoalForms(this.defaultGoals);
        this.updateGoalDisplay(this.addProgressToGoals(this.defaultGoals));
    }

    populateGoalForms(goals) {
        const inputIds = ['steps-goal', 'calories-goal', 'sleep-goal', 'heart-rate-goal', 
                         'stepsGoal', 'caloriesGoal', 'sleepGoal', 'heartRateGoal'];
        inputIds.forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
        
        goals.forEach(goal => {
            this.setInputValue(`${goal.goalType.replace('_', '-')}-goal`, goal.targetValue);
            this.setInputValue(`${goal.goalType}Goal`, goal.targetValue);
        });
    }

    setInputValue(id, value) {
        const input = document.getElementById(id);
        if (input) input.value = value;
    }

    addProgressToGoals(goals) {
        return goals.map(goal => ({
            ...goal,
            ...this.mockProgress[goal.goalType] || { currentValue: 0, progressPercentage: 0 }
        }));
    }

    updateGoalDisplay(goals) {
        goals.forEach(goal => {
            const progressBar = document.querySelector(`[data-goal="${goal.goalType}"] .progress-fill`);
            const progressText = document.querySelector(`[data-goal="${goal.goalType}"] .progress-text`);
            
            if (progressBar) {
                progressBar.style.width = `${goal.progressPercentage}%`;
            }
            
            if (progressText) {
                const timeLabel = goal.goalType === 'sleep' ? 'LAST NIGHT' : 'TODAY';
                progressText.textContent = `${goal.progressPercentage}% ${timeLabel}`;
            }
        });
    }

    async saveGoals() {
        const userId = getCurrentUserId();
        if (!userId) {
            showError('Please log in to update goals');
            return;
        }
        
        const goalData = this.getGoalData();
        if (goalData.length === 0) {
            showError('Please enter at least one goal value');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/goals/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: parseInt(userId), goals: goalData })
            });
            
            if (response.ok) {
                showSuccess('.save-goals-btn');
                setTimeout(() => this.loadGoals(), 500);
            } else {
                const error = await response.json();
                showError(error.error || 'Failed to update goals');
            }
        } catch (error) {
            showError('Failed to update goals');
        }
    }

    getGoalData() {
        const goals = [];
        const goalTypes = [
            { type: 'steps', id: 'steps-goal', icon: '👟' },
            { type: 'calories', id: 'calories-goal', icon: '🔥' },
            { type: 'sleep', id: 'sleep-goal', icon: '😴' },
            { type: 'heart_rate', id: 'heart-rate-goal', icon: '❤️' }
        ];

        goalTypes.forEach(({ type, id, icon }) => {
            const value = document.getElementById(id)?.value;
            if (value && parseFloat(value) > 0) {
                goals.push({
                    goalType: type,
                    targetValue: parseFloat(value),
                    icon: icon
                });
            }
        });

        return goals;
    }

    async saveGoalsFromCredentialsTab() {
        const userId = getCurrentUserId();
        if (!userId) {
            showError('Please log in to save goals.');
            return;
        }
        
        const goalData = this.getGoalDataFromCredentialsTab();
        if (goalData.length === 0) {
            showError('Please enter at least one goal value.');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/goals/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: parseInt(userId), goals: goalData })
            });
            
            if (response.ok) {
                goalData.forEach(goal => {
                    this.setInputValue(`${goal.goalType.replace('_', '-')}-goal`, goal.targetValue);
                });
                
                showSuccess('#saveGoalsBtn');
                setTimeout(() => this.loadGoals(), 500);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to save goals: ${response.status}`);
            }
        } catch (error) {
            showError(`Failed to save goals: ${error.message}`);
        }
    }

    getGoalDataFromCredentialsTab() {
        const goals = [];
        const goalTypes = [
            { type: 'steps', id: 'stepsGoal', icon: '👟' },
            { type: 'calories', id: 'caloriesGoal', icon: '🔥' },
            { type: 'sleep', id: 'sleepGoal', icon: '😴' },
            { type: 'heart_rate', id: 'heartRateGoal', icon: '❤️' }
        ];

        goalTypes.forEach(({ type, id, icon }) => {
            const value = document.getElementById(id)?.value;
            if (value && parseFloat(value) > 0) {
                goals.push({
                    goalType: type,
                    targetValue: parseFloat(value),
                    icon: icon
                });
            }
        });

        return goals;
    }
}

class ProfileManager {
    constructor() {
        this.fieldMappings = [
            { id: 'email', key: 'email' },
            { id: 'firstName', key: 'firstName' },
            { id: 'lastName', key: 'lastName' },
            { id: 'phoneNr', key: 'phoneNr', transform: parseInt },
            { id: 'gender', key: 'gender' },
            { id: 'height', key: 'height', transform: parseFloat },
            { id: 'weight', key: 'weight', transform: parseFloat },
            { id: 'deviceName', key: 'deviceName' }
        ];
    }

    async loadUserProfile() {
        const userId = getCurrentUserId();
        if (!userId) {
            this.populateUserForm(null);
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/users/${userId}`);
            
            if (response.ok) {
                const data = await response.json();
                this.populateUserForm(data.data);
            } else {
                this.populateUserForm(null);
            }
        } catch (error) {
            this.populateUserForm(null);
        }
    }

    async updateProfile() {
        const userId = getCurrentUserId();
        if (!userId) {
            showError('Please log in to update profile');
            return;
        }
        
        const profileData = this.getProfileData();
        
        try {
            const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData)
            });
            
            if (response.ok) {
                const updatedData = await response.json();
                showSuccess('.save-btn');
                this.populateUserForm(updatedData.data);
            } else {
                const error = await response.json();
                showError(error.error || 'Failed to update profile');
            }
        } catch (error) {
            showError('Failed to update profile');
        }
    }

    getProfileData() {
        const data = {};
        this.fieldMappings.forEach(({ id, key, transform }) => {
            const element = document.getElementById(id);
            if (element) {
                let value = element.value || '';
                if (transform && value) {
                    value = transform(value) || null;
                }
                data[key] = value;
            }
        });
        return data;
    }

    populateUserForm(userData) {
        this.fieldMappings.forEach(({ id, key }) => {
            const element = document.getElementById(id);
            if (element) {
                element.value = userData?.[key] || '';
            }
        });

        this.updateUserDisplay(userData);
    }

    updateUserDisplay(userData) {
        const userAvatar = document.querySelector('.user-avatar');
        const userName = document.querySelector('.user-name');
        const profileAvatar = document.querySelector('.profile-avatar-large .avatar-text');
        const deviceName = document.querySelector('.device-name');
        const userStatus = document.querySelector('.user-status');

        if (userData?.firstName && userData?.lastName) {
            const initials = `${userData.firstName.charAt(0)}${userData.lastName.charAt(0)}`.toUpperCase();
            const fullName = `${userData.firstName} ${userData.lastName}`.toUpperCase();
            
            if (userAvatar) userAvatar.textContent = initials;
            if (userName) userName.textContent = fullName;
            if (profileAvatar) profileAvatar.textContent = initials;
        } else {
            if (userAvatar) userAvatar.textContent = 'U';
            if (userName) userName.textContent = 'NEW USER';
            if (profileAvatar) profileAvatar.textContent = 'U';
        }

        if (userData?.deviceName) {
            if (deviceName) deviceName.textContent = userData.deviceName;
            if (userStatus) userStatus.textContent = `${userData.deviceName} CONNECTED`;
        } else {
            if (deviceName) deviceName.textContent = 'NO DEVICE';
            if (userStatus) userStatus.textContent = 'NO DEVICE CONNECTED';
        }
    }
}

async function loadLastSyncTime() {
    const userId = getCurrentUserId();
    if (!userId) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`);
        if (!response.ok) throw new Error(`Failed to fetch user data: ${response.status}`);
        
        const result = await response.json();
        const lastSync = result.data.last_sync;
        
        const syncTimeElement = document.getElementById('navLastSyncTime');
        const syncIconElement = document.querySelector('.nav-sync-icon');
        
        if (lastSync) {
            const timeAgo = getTimeAgo(new Date(lastSync));
            if (syncTimeElement) syncTimeElement.textContent = timeAgo;
            if (syncIconElement) syncIconElement.textContent = '✓';
        } else {
            if (syncTimeElement) syncTimeElement.textContent = 'NEVER';
            if (syncIconElement) syncIconElement.textContent = '✗';
        }
        
    } catch (error) {
        const syncTimeElement = document.getElementById('navLastSyncTime');
        const syncIconElement = document.querySelector('.nav-sync-icon');
        
        if (syncTimeElement) syncTimeElement.textContent = 'ERROR';
        if (syncIconElement) syncIconElement.textContent = '✗';
    }
}

function createStars() {
    const starsContainer = document.querySelector('.stars');
    if (!starsContainer) return;
    
    for (let i = 0; i < 50; i++) {
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

function initializeTabs() {
    const tabButtons = document.querySelectorAll('.nav-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));
            
            button.classList.add('active');
            const targetPanel = document.getElementById(`${targetTab}-tab`);
            if (targetPanel) targetPanel.classList.add('active');
        });
    });
}

function handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const oauthSuccess = urlParams.get('oauth');
    
    if (error) {
        showError('OAuth authorization failed.');
        return;
    }
    
    if (oauthSuccess === 'success') {
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        alert('Google Fit connected successfully! Your health data will now sync.');
        loadLastSyncTime();
    }
}

const goalManager = new GoalManager();
const profileManager = new ProfileManager();

document.addEventListener('DOMContentLoaded', function() {
    createStars();
    initializeTabs();
    
    profileManager.loadUserProfile();
    goalManager.loadGoals();
    
    setTimeout(loadLastSyncTime, 500);
    
    const saveGoalsBtn = document.getElementById('saveGoalsBtn');
    if (saveGoalsBtn) {
        saveGoalsBtn.addEventListener('click', () => goalManager.saveGoalsFromCredentialsTab());
    }
    
    const saveGoalsBtnMain = document.querySelector('.save-goals-btn');
    if (saveGoalsBtnMain) {
        saveGoalsBtnMain.addEventListener('click', () => goalManager.saveGoals());
    }
    
    const saveProfileBtn = document.querySelector('.save-btn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', () => profileManager.updateProfile());
    }
    
    handleOAuthCallback();
});