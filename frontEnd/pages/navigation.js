const menuButton = document.getElementById('menuButton');
const dropdownMenu = document.getElementById('dropdownMenu');
const navOverlay = document.getElementById('navOverlay');
let isMenuOpen = false;

menuButton.addEventListener('click', function() {
    toggleMenu();
});

navOverlay.addEventListener('click', function() {
    if (isMenuOpen) {
        toggleMenu();
    }
});

document.addEventListener('click', function(event) {
    if (isMenuOpen && !menuButton.contains(event.target) && !dropdownMenu.contains(event.target)) {
        toggleMenu();
    }
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && isMenuOpen) {
        toggleMenu();
    }
});

function toggleMenu() {
    isMenuOpen = !isMenuOpen;
    
    if (isMenuOpen) {
        menuButton.classList.add('active');
        dropdownMenu.classList.add('show');
        navOverlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    } else {
        menuButton.classList.remove('active');
        dropdownMenu.classList.remove('show');
        navOverlay.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
}

document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function(e) {
        this.style.transform = 'translateX(8px) scale(0.98)';
        setTimeout(() => {
            this.style.transform = 'translateX(4px) scale(1)';
        }, 150);
    });
});

function setActivePage(pageName) {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.querySelectorAll('.menu-item').forEach(item => {
        if (item.querySelector('.menu-text').textContent.includes(pageName)) {
            item.classList.add('active');
        }
    });
}

async function loadNavLastSyncTime() {
    const userData = localStorage.getItem('userData');
    if (!userData) {
        return;
    }
    
    try {
        const user = JSON.parse(userData);
        const userId = user.userID;
        
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
            const timeAgo = getNavTimeAgo(syncDate);
            
            if (syncTimeElement) syncTimeElement.textContent = timeAgo;
            if (syncIconElement) syncIconElement.textContent = 'yes';
        } else {
            if (syncTimeElement) syncTimeElement.textContent = 'NEVER';
            if (syncIconElement) syncIconElement.textContent = 'no';
        }
        
    } catch (error) {
        const syncTimeElement = document.getElementById('navLastSyncTime');
        const syncIconElement = document.querySelector('.nav-sync-icon');
        
        if (syncTimeElement) syncTimeElement.textContent = 'ERROR';
        if (syncIconElement) syncIconElement.textContent = 'no';
    }
}

function getNavTimeAgo(date) {
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

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        loadNavLastSyncTime();
    }, 500);
});