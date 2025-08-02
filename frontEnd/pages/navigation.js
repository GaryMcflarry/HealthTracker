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
                // setTimeout(() => {
                //     alert(`NAVIGATING TO: ${pageName}`);
                // }, 200);
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