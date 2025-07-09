const { chromium } = require('playwright');

async function authenticateWithMoodle(username, password) {
    let browser = null;
    let context = null;
    let page = null;
    
    try {
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-zygote',
                '--single-process'
            ]
        });
        
        context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1366, height: 768 },
            locale: 'es-UY',
            ignoreHTTPSErrors: true
        });
        
        page = await context.newPage();
        
        // Set extra timeout for slower connections
        page.setDefaultTimeout(45000);
        
        console.log('Navegando a UTEC Moodle...');
        
        // Navigate to UTEC Moodle login page
        await page.goto('https://ev1.utec.edu.uy/moodle/login/index.php', {
            waitUntil: 'networkidle',
            timeout: 45000
        });
        
        // Wait for the login form to be visible with state check
        if (!page || page.isClosed()) {
            throw new Error('Page was closed unexpectedly');
        }
        
        await page.waitForSelector('#username', { visible: true, timeout: 20000 });
        await page.waitForSelector('#password', { visible: true, timeout: 20000 });
        await page.waitForSelector('#loginbtn', { visible: true, timeout: 20000 });
        
        console.log('Formulario de login encontrado, ingresando credenciales...');
        
        // Clear fields first (in case there's any autofill)
        await page.fill('#username', '');
        await page.fill('#password', '');
        
        // Fill in the login form
        await page.fill('#username', username);
        await page.fill('#password', password);
        
        // Take a screenshot for debugging (optional)
        // await page.screenshot({ path: 'login-form.png' });
        
        // Click the login button and wait for navigation
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
            page.click('#loginbtn')
        ]);
        
        console.log('Login enviado, verificando resultado...');
        
        // Wait a bit for any redirects to complete
        await page.waitForTimeout(2000);
        
        // Get the current URL after login attempt
        const currentUrl = page.url();
        
        // Check multiple success indicators
        const successIndicators = [
            currentUrl.includes('/my/'),
            currentUrl.includes('/course/'),
            currentUrl.includes('/user/profile.php'),
            !currentUrl.includes('/login/index.php')
        ];
        
        const isLoggedIn = successIndicators.some(indicator => indicator);
        
        // Additional check: look for user menu or logout link
        const userMenuExists = await page.$('.usermenu, .usertext, [data-action="logout"], a[href*="logout"]').then(el => !!el);
        
        if (isLoggedIn || userMenuExists) {
            console.log('Login exitoso');
            return {
                success: true,
                message: 'Autenticación exitosa'
            };
        }
        
        // Check for error messages
        const errorSelectors = [
            '.alert-danger',
            '.error',
            '.loginerrors',
            '.alert.alert-danger',
            '#loginerrormessage',
            '.errorbox'
        ];
        
        for (const selector of errorSelectors) {
            const errorElement = await page.$(selector);
            if (errorElement) {
                const errorText = await errorElement.innerText().catch(() => 'Credenciales inválidas');
                console.log('Error encontrado:', errorText);
                return {
                    success: false,
                    message: 'Credenciales inválidas. Verifica tu usuario y contraseña.'
                };
            }
        }
        
        // If we're still on login page, authentication failed
        if (currentUrl.includes('/login/index.php')) {
            return {
                success: false,
                message: 'No se pudo autenticar. Verifica tus credenciales.'
            };
        }
        
        return {
            success: false,
            message: 'No se pudo verificar el estado de autenticación'
        };
        
    } catch (error) {
        console.error('Error en Playwright:', error.message);
        
        // Provide more specific error messages
        if (error.message.includes('timeout')) {
            return {
                success: false,
                message: 'Tiempo de espera agotado. El servidor de UTEC puede estar lento.'
            };
        } else if (error.message.includes('net::ERR')) {
            return {
                success: false,
                message: 'No se pudo conectar con el servidor de UTEC. Verifica tu conexión a internet.'
            };
        }
        
        return {
            success: false,
            message: 'Error de conexión con el servidor de UTEC'
        };
    } finally {
        try {
            if (page && !page.isClosed()) {
                await page.close();
            }
        } catch (e) {
            console.error('Error closing page:', e.message);
        }
        
        try {
            if (context) {
                await context.close();
            }
        } catch (e) {
            console.error('Error closing context:', e.message);
        }
        
        try {
            if (browser && browser.isConnected()) {
                await browser.close();
            }
        } catch (e) {
            console.error('Error closing browser:', e.message);
        }
    }
}

module.exports = { authenticateWithMoodle };