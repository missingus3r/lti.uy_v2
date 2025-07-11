// PWA installation and service worker registration
(function() {
    'use strict';
    
    // Check if browser supports service workers
    if ('serviceWorker' in navigator) {
        // Register service worker when page loads
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('Service Worker registrado con éxito:', registration.scope);
                    
                    // Check for updates periodically
                    setInterval(() => {
                        registration.update();
                    }, 60000); // Check every minute
                })
                .catch(error => {
                    console.error('Error al registrar Service Worker:', error);
                });
        });
    }
    
    // PWA install prompt
    let deferredPrompt;
    const installButton = document.getElementById('install-button');
    
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        
        // Show install button or banner
        showInstallPromotion();
    });
    
    function showInstallPromotion() {
        // Create install banner if it doesn't exist
        if (!document.getElementById('pwa-install-banner')) {
            const banner = document.createElement('div');
            banner.id = 'pwa-install-banner';
            banner.className = 'pwa-install-banner';
            banner.innerHTML = `
                <div class="pwa-install-content">
                    <div class="pwa-install-icon">📱</div>
                    <div class="pwa-install-text">
                        <h3>Instalar LTI.UY</h3>
                        <p>Instala la app para acceso rápido y funcionamiento offline</p>
                    </div>
                    <div class="pwa-install-actions">
                        <button id="pwa-install-btn" class="btn btn-primary">Instalar</button>
                        <button id="pwa-dismiss-btn" class="btn btn-secondary">Ahora no</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(banner);
            
            // Add event listeners
            document.getElementById('pwa-install-btn').addEventListener('click', installPWA);
            document.getElementById('pwa-dismiss-btn').addEventListener('click', dismissInstallBanner);
            
            // Show banner with animation
            setTimeout(() => {
                banner.classList.add('show');
            }, 100);
        }
    }
    
    function installPWA() {
        const banner = document.getElementById('pwa-install-banner');
        
        if (deferredPrompt) {
            // Show the install prompt
            deferredPrompt.prompt();
            
            // Wait for the user to respond to the prompt
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('Usuario aceptó instalar la PWA');
                    // Hide banner
                    if (banner) {
                        banner.classList.remove('show');
                        setTimeout(() => banner.remove(), 300);
                    }
                } else {
                    console.log('Usuario rechazó instalar la PWA');
                }
                
                // Clear the deferredPrompt
                deferredPrompt = null;
            });
        }
    }
    
    function dismissInstallBanner() {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) {
            banner.classList.remove('show');
            setTimeout(() => banner.remove(), 300);
            
            // Don't show again for 7 days
            localStorage.setItem('pwa-install-dismissed', Date.now());
        }
    }
    
    // Check if we should show the install banner
    window.addEventListener('load', () => {
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (dismissed) {
            const daysSinceDismissed = (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60 * 24);
            if (daysSinceDismissed < 7) {
                return; // Don't show if dismissed less than 7 days ago
            }
        }
    });
    
    // Handle app installed event
    window.addEventListener('appinstalled', (evt) => {
        console.log('PWA fue instalada');
        // Hide install banner if it exists
        const banner = document.getElementById('pwa-install-banner');
        if (banner) {
            banner.remove();
        }
    });
    
    // Update UI when online/offline
    function updateOnlineStatus() {
        if (navigator.onLine) {
            document.body.classList.remove('offline');
        } else {
            document.body.classList.add('offline');
            showOfflineNotification();
        }
    }
    
    function showOfflineNotification() {
        if (!document.getElementById('offline-notification')) {
            const notification = document.createElement('div');
            notification.id = 'offline-notification';
            notification.className = 'offline-notification';
            notification.innerHTML = `
                <div class="offline-content">
                    <span class="offline-icon">📡</span>
                    <span class="offline-text">Estás sin conexión - Modo offline activado</span>
                </div>
            `;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.classList.add('show');
            }, 100);
        }
    }
    
    window.addEventListener('online', () => {
        updateOnlineStatus();
        const notification = document.getElementById('offline-notification');
        if (notification) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }
    });
    
    window.addEventListener('offline', updateOnlineStatus);
    
    // Check initial online status
    updateOnlineStatus();
})();