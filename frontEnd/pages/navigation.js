 const menuButton = document.getElementById('menuButton');
        const dropdownMenu = document.getElementById('dropdownMenu');
        const navOverlay = document.getElementById('navOverlay');
        let isMenuOpen = false;

        // Toggle menu
        menuButton.addEventListener('click', function() {
            toggleMenu();
        });

        // Close menu when clicking overlay
        navOverlay.addEventListener('click', function() {
            if (isMenuOpen) {
                toggleMenu();
            }
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            if (isMenuOpen && !menuButton.contains(event.target) && !dropdownMenu.contains(event.target)) {
                toggleMenu();
            }
        });

        // Close menu on escape key
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

        // Add click animations to menu items
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', function(e) {
                // Add click animation
                this.style.transform = 'translateX(8px) scale(0.98)';
                setTimeout(() => {
                    this.style.transform = 'translateX(4px) scale(1)';
                }, 150);
                
                // // In a real app, you'd navigate to the page here
                // // For demo purposes, we'll just show an alert
                // e.preventDefault();
                // const pageName = this.querySelector('.menu-text').textContent;
            });
        });

        // Update active page indicator
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

// Load and display last sync time in navigation
async function loadNavLastSyncTime() {
    console.log('🔄 Loading last sync time for navigation...');
    
    const userData = localStorage.getItem('userData');
    if (!userData) {
        console.warn('⚠️ No user data found for nav sync time');
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
            const timeAgo = getNavTimeAgo(syncDate);
            
            if (syncTimeElement) syncTimeElement.textContent = timeAgo;
            if (syncIconElement) syncIconElement.textContent = '✅';
        } else {
            console.log('❌ No last sync time available');
            if (syncTimeElement) syncTimeElement.textContent = 'NEVER';
            if (syncIconElement) syncIconElement.textContent = '❌';
        }
        
    } catch (error) {
        console.error('❌ Error loading nav last sync time:', error);
        const syncTimeElement = document.getElementById('navLastSyncTime');
        const syncIconElement = document.querySelector('.nav-sync-icon');
        
        if (syncTimeElement) syncTimeElement.textContent = 'ERROR';
        if (syncIconElement) syncIconElement.textContent = '❌';
    }
}

// Helper function to format time ago for navigation
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

// Initialize navigation sync display
document.addEventListener('DOMContentLoaded', function() {
    // Load last sync time after a short delay to ensure DOM is ready
    setTimeout(() => {
        loadNavLastSyncTime();
    }, 500);
});