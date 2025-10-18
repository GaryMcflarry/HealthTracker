const API_BASE_URL = 'http://localhost:3000/api';

class ToastManager {
    constructor() {
        this.container = document.getElementById('toastContainer');
    }

    show(type, title, message, duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'i'
        };

        toast.innerHTML = `
            <div class="toast-header">
                <span class="toast-icon">${icons[type]}</span>
                <span class="toast-title">${title}</span>
            </div>
            <div class="toast-message">${message}</div>
            <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
            <div class="toast-progress"></div>
        `;

        this.container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.animation = 'slideOut 0.3s ease forwards';
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    }

    success(title, message) {
        this.show('success', title, message);
    }

    error(title, message) {
        this.show('error', title, message);
    }

    warning(title, message) {
        this.show('warning', title, message);
    }

    info(title, message) {
        this.show('info', title, message);
    }
}

const toast = new ToastManager();

async function login() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');
    const buttonText = loginBtn.querySelector('.button-text');

    if (!email || !password) {
        toast.warning('Missing Fields', 'Please fill in all required fields');
        return;
    }

    if (!isValidEmail(email)) {
        toast.error('Invalid Email', 'Please enter a valid email address');
        return;
    }

    loginBtn.disabled = true;
    loginBtn.classList.add('loading');
    buttonText.textContent = 'LOGGING IN...';

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userData', JSON.stringify(data.user));
            
            toast.success('Login Successful', `Welcome back, ${data.user.firstName}!`);
            
            setTimeout(() => {
                window.location.href = '../dashboard/dashboard.html';
            }, 1500);
        } else {
            toast.error('Login Failed', data.error || 'Invalid credentials');
        }
    } catch (error) {
        toast.error('Connection Error', 'Unable to connect to server. Please try again.');
    } finally {
        loginBtn.disabled = false;
        loginBtn.classList.remove('loading');
        buttonText.textContent = 'LOGIN';
    }
}

async function register() {
    const formData = {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        email: document.getElementById('regEmail').value.trim(),
        phoneNumber: document.getElementById('phoneNumber').value.trim(),
        dateOfBirth: document.getElementById('dateOfBirth').value,
        gender: document.getElementById('gender').value,
        height: parseFloat(document.getElementById('height').value),
        weight: parseFloat(document.getElementById('weight').value),
        password: document.getElementById('regPassword').value,
        confirmPassword: document.getElementById('confirmPassword').value
    };

    const registerBtn = document.getElementById('registerBtn');
    const buttonText = registerBtn.querySelector('.button-text');

    const validation = validateRegistrationForm(formData);
    if (!validation.isValid) {
        toast.error('Validation Error', validation.message);
        return;
    }

    registerBtn.disabled = true;
    registerBtn.classList.add('loading');
    buttonText.textContent = 'CREATING...';

    try {
        const { confirmPassword, ...registrationData } = formData;

        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(registrationData)
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userData', JSON.stringify(data.user));
            
            toast.success('Account Created', `Welcome to Health Tracker, ${data.user.firstName}!`);
            
            setTimeout(() => {
                closeRegisterDialog();
                window.location.href = '../dashboard/dashboard.html';
            }, 2000);
        } else {
            toast.error('Registration Failed', data.error || 'Unable to create account');
        }
    } catch (error) {
        toast.error('Connection Error', 'Unable to connect to server. Please try again.');
    } finally {
        registerBtn.disabled = false;
        registerBtn.classList.remove('loading');
        buttonText.textContent = 'CREATE ACCOUNT';
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validateRegistrationForm(data) {
    if (!data.firstName || !data.lastName) {
        return { isValid: false, message: 'First name and last name are required' };
    }

    if (!data.email || !isValidEmail(data.email)) {
        return { isValid: false, message: 'Please enter a valid email address' };
    }

    if (!data.dateOfBirth) {
        return { isValid: false, message: 'Date of birth is required' };
    }

    if (!data.gender) {
        return { isValid: false, message: 'Please select your gender' };
    }

    if (!data.height || data.height < 50 || data.height > 300) {
        return { isValid: false, message: 'Please enter a valid height (50-300 cm)' };
    }

    if (!data.weight || data.weight < 20 || data.weight > 500) {
        return { isValid: false, message: 'Please enter a valid weight (20-500 kg)' };
    }

    if (!data.password || data.password.length < 6) {
        return { isValid: false, message: 'Password must be at least 6 characters long' };
    }

    if (data.password !== data.confirmPassword) {
        return { isValid: false, message: 'Passwords do not match' };
    }

    const birthDate = new Date(data.dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (age < 13 || (age === 13 && monthDiff < 0) || (age === 13 && monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        return { isValid: false, message: 'You must be at least 13 years old to register' };
    }

    return { isValid: true, message: '' };
}

function openRegisterDialog() {
    document.getElementById('registerDialog').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeRegisterDialog() {
    document.getElementById('registerDialog').style.display = 'none';
    document.body.style.overflow = 'auto';
    document.getElementById('registerForm').reset();
}

async function verifyToken(token) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            toast.info('Already Logged In', 'Redirecting to dashboard...');
            setTimeout(() => {
                window.location.href = '../dashboard/dashboard.html';
            }, 1500);
        } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
        }
    } catch (error) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
    }
}

function createStars() {
    const starsContainer = document.querySelector('.stars');
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

function addPixelEffects() {
    const buttons = document.querySelectorAll('.pixel-button');
    const inputs = document.querySelectorAll('.pixel-input');
    
    buttons.forEach(button => {
        button.addEventListener('mousedown', function() {
            if (!this.disabled) {
                this.style.transform = 'translate(2px, 2px)';
                this.style.boxShadow = '2px 2px 0px #333';
            }
        });
        
        button.addEventListener('mouseup', function() {
            if (!this.disabled) {
                this.style.transform = 'translate(0px, 0px)';
                this.style.boxShadow = '4px 4px 0px #333';
            }
        });

        button.addEventListener('mouseleave', function() {
            if (!this.disabled) {
                this.style.transform = 'translate(0px, 0px)';
                this.style.boxShadow = '4px 4px 0px #333';
            }
        });
    });
    
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.style.borderColor = '#4CAF50';
            this.style.boxShadow = '0 0 0 2px #4CAF50, 4px 4px 0px #333';
        });
        
        input.addEventListener('blur', function() {
            this.style.borderColor = '#ffffff';
            this.style.boxShadow = '4px 4px 0px #333';
        });
    });
}

function setupRealTimeValidation() {
    const emailInput = document.getElementById('regEmail');
    const passwordInput = document.getElementById('regPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            if (this.value && !isValidEmail(this.value)) {
                this.style.borderColor = '#D32F2F';
                toast.warning('Invalid Email', 'Please enter a valid email address');
            }
        });
    }

    if (confirmPasswordInput && passwordInput) {
        confirmPasswordInput.addEventListener('blur', function() {
            if (this.value && this.value !== passwordInput.value) {
                this.style.borderColor = '#D32F2F';
                toast.warning('Password Mismatch', 'Passwords do not match');
            }
        });

        passwordInput.addEventListener('input', function() {
            if (confirmPasswordInput.value && this.value !== confirmPasswordInput.value) {
                confirmPasswordInput.style.borderColor = '#D32F2F';
            } else if (confirmPasswordInput.value) {
                confirmPasswordInput.style.borderColor = '#4CAF50';
            }
        });
    }
}

function setupNetworkMonitoring() {
    window.addEventListener('online', function() {
        toast.success('Connection Restored', 'You are back online!');
    });

    window.addEventListener('offline', function() {
        toast.warning('Connection Lost', 'Please check your internet connection');
    });
}

document.addEventListener('DOMContentLoaded', function() {
    createStars();
    addPixelEffects();
    setupRealTimeValidation();
    setupNetworkMonitoring();

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            login();
        });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            register();
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeRegisterDialog();
        }
    });

    const registerDialog = document.getElementById('registerDialog');
    if (registerDialog) {
        registerDialog.addEventListener('click', function(e) {
            if (e.target === this) {
                closeRegisterDialog();
            }
        });
    }

    const token = localStorage.getItem('authToken');
    if (token) {
        verifyToken(token);
    }
});