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
    
    async function installPWA() {
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
        } else {
            // Try modern installation methods first
            try {
                // Check if we can use the newer getInstalledRelatedApps API
                if ('getInstalledRelatedApps' in navigator) {
                    const relatedApps = await navigator.getInstalledRelatedApps();
                    if (relatedApps.length === 0) {
                        // App not installed, try to trigger installation
                        await triggerInstallation();
                        return;
                    }
                }
                
                // Try to trigger installation through other means
                await triggerInstallation();
                
            } catch (error) {
                console.log('Error al intentar instalación automática:', error);
                showManualInstallInstructions();
            }
        }
    }
    
    async function triggerInstallation() {
        // Check if we're on a supported platform
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        const isAndroid = /Android/i.test(navigator.userAgent);
        const isChrome = /Chrome/i.test(navigator.userAgent);
        const isSamsung = /SamsungBrowser/i.test(navigator.userAgent);
        
        if (isAndroid && (isChrome || isSamsung)) {
            // Try to trigger Chrome/Samsung browser installation
            if ('BeforeInstallPromptEvent' in window) {
                // Wait a bit and try to trigger the prompt
                setTimeout(() => {
                    if (!deferredPrompt) {
                        // Try to manually trigger the installation
                        showManualInstallInstructions();
                    }
                }, 1000);
            } else {
                showManualInstallInstructions();
            }
        } else if (isIOS) {
            // iOS requires manual installation
            showIOSInstallInstructions();
        } else {
            // Other browsers
            showManualInstallInstructions();
        }
    }
    
    function showManualInstallInstructions() {
        const banner = document.getElementById('pwa-install-banner');
        
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        const isAndroid = /Android/i.test(navigator.userAgent);
        
        let instructions = '';
        let title = 'Instalar LTI.UY';
        
        if (isIOS) {
            instructions = 'Para instalar: toca el botón <strong>Compartir</strong> <span style="font-size: 18px;">⬆️</span> y selecciona <strong>"Añadir a pantalla de inicio"</strong>';
        } else if (isAndroid) {
            instructions = 'Para instalar: toca el menú <strong>⋮</strong> del navegador y selecciona <strong>"Instalar app"</strong> o <strong>"Añadir a pantalla de inicio"</strong>';
        } else {
            instructions = 'Para instalar: busca la opción <strong>"Instalar"</strong> en el menú del navegador';
        }
        
        // Create a more detailed install modal
        const modal = document.createElement('div');
        modal.id = 'pwa-install-modal';
        modal.className = 'pwa-install-modal';
        modal.innerHTML = `
            <div class="pwa-install-modal-content">
                <div class="pwa-install-modal-header">
                    <h3>${title}</h3>
                    <button class="pwa-install-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
                </div>
                <div class="pwa-install-modal-body">
                    <div class="pwa-install-steps">
                        <div class="pwa-install-step">
                            <div class="pwa-install-step-icon">📱</div>
                            <div class="pwa-install-step-text">
                                <p>${instructions}</p>
                            </div>
                        </div>
                        ${isAndroid ? `
                        <div class="pwa-install-step">
                            <div class="pwa-install-step-icon">🔍</div>
                            <div class="pwa-install-step-text">
                                <p>Si no ves la opción de instalar, asegúrate de que estés usando Chrome o Samsung Internet</p>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="pwa-install-modal-footer">
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">Entendido</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Hide original banner
        if (banner) {
            banner.classList.remove('show');
            setTimeout(() => banner.remove(), 300);
        }
        
        // Show modal with animation
        setTimeout(() => {
            modal.classList.add('show');
        }, 100);
    }
    
    function showIOSInstallInstructions() {
        showManualInstallInstructions(); // Use the same modal for iOS
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
        
        // Force show install banner for testing (uncomment to test)
        setTimeout(() => {
            if (!deferredPrompt && isInstallable()) {
                showInstallPromotion();
            }
        }, 3000);
    });
    
    // Alternative detection methods for mobile browsers
    function isInstallable() {
        // Check if it's a mobile device
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Check if running in standalone mode (already installed)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                            window.navigator.standalone || 
                            document.referrer.includes('android-app://');
        
        // Check if it's a supported browser
        const isSupportedBrowser = 'serviceWorker' in navigator;
        
        return isMobile && !isStandalone && isSupportedBrowser;
    }
    
    // Show install prompt for iOS Safari users
    function showIOSInstallPrompt() {
        if (/iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.navigator.standalone) {
            const banner = document.createElement('div');
            banner.id = 'pwa-install-banner';
            banner.className = 'pwa-install-banner ios-install';
            banner.innerHTML = `
                <div class="pwa-install-content">
                    <div class="pwa-install-icon">📱</div>
                    <div class="pwa-install-text">
                        <h3>Instalar LTI.UY</h3>
                        <p>Para instalar esta app: toca <strong>Compartir</strong> <span style="font-size: 16px;">⬆️</span> y luego <strong>Añadir a pantalla de inicio</strong></p>
                    </div>
                    <div class="pwa-install-actions">
                        <button id="pwa-dismiss-btn" class="btn btn-secondary">Entendido</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(banner);
            
            // Add event listener for dismiss
            document.getElementById('pwa-dismiss-btn').addEventListener('click', dismissInstallBanner);
            
            // Show banner with animation
            setTimeout(() => {
                banner.classList.add('show');
            }, 100);
        }
    }
    
    // Enhanced install detection and timing
    let installCheckTimeout;
    
    // Function to check if we should show install prompt
    function checkInstallPrompt() {
        if (isInstallable() && !deferredPrompt) {
            // If no beforeinstallprompt event fired, show manual instructions
            if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                showIOSInstallPrompt();
            } else {
                // For Android devices without beforeinstallprompt
                showInstallPromotion();
            }
        }
    }
    
    // Check for install criteria after page load
    setTimeout(() => {
        checkInstallPrompt();
    }, 2000);
    
    // Additional check for Android Chrome - wait longer for beforeinstallprompt
    if (/Android/i.test(navigator.userAgent) && /Chrome/i.test(navigator.userAgent)) {
        installCheckTimeout = setTimeout(() => {
            if (!deferredPrompt && isInstallable()) {
                console.log('Android Chrome detected, showing install promotion');
                showInstallPromotion();
            }
        }, 4000);
    }
    
    // Enhanced beforeinstallprompt event handling
    window.addEventListener('beforeinstallprompt', (e) => {
        // Clear any pending install check
        if (installCheckTimeout) {
            clearTimeout(installCheckTimeout);
        }
        
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        
        // Show install button or banner immediately
        console.log('beforeinstallprompt event fired, showing install promotion');
        showInstallPromotion();
    });
    
    // Handle app installed event
    window.addEventListener('appinstalled', () => {
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