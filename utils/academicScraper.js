const { chromium } = require('playwright');

async function scrapeAcademicProgress(username, password) {
    let browser = null;
    
    try {
        browser = await chromium.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1366, height: 768 },
            locale: 'es-UY'
        });
        
        const page = await context.newPage();
        page.setDefaultTimeout(30000);
        
        console.log('Navegando a Portal UTEC para autenticación...');
        
        // Navigate to Portal UTEC (will redirect to authentication)
        await page.goto('https://portal.utec.edu.uy/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        
        // Wait for redirect to authentication domain
        await page.waitForURL('**/autenticacion.utec.edu.uy/**', { timeout: 15000 });
        
        console.log('Redirigido a dominio de autenticación, ingresando credenciales...');
        
        // Wait for authentication form on autenticacion.utec.edu.uy
        await page.waitForSelector('input[name="username"], input[type="text"]', { visible: true });
        await page.waitForSelector('input[name="password"], input[type="password"]', { visible: true });
        
        // Find form fields
        const usernameField = await page.$('input[name="username"]') || await page.$('input[type="text"]');
        const passwordField = await page.$('input[name="password"]') || await page.$('input[type="password"]');
        const submitButton = await page.$('input[type="submit"]') || await page.$('button[type="submit"]') || await page.$('.btn-primary');
        
        if (!usernameField || !passwordField || !submitButton) {
            throw new Error('No se encontraron los campos de autenticación');
        }
        
        // Fill credentials
        await usernameField.fill(username);
        await passwordField.fill(password);
        
        // Submit and wait for redirect to portaluxxi
        await Promise.all([
            page.waitForURL('**/portaluxxi.utec.edu.uy/**', { timeout: 20000 }),
            submitButton.click()
        ]);
        
        console.log('Autenticación exitosa, redirigido a Portal UXXI');
        
        // Verify we're on the correct domain
        const currentUrl = page.url();
        if (!currentUrl.includes('portaluxxi.utec.edu.uy')) {
            // Check for error messages
            const errorElement = await page.$('.alert-danger, .error, .loginerrors');
            if (errorElement) {
                const errorText = await errorElement.innerText().catch(() => 'Credenciales inválidas');
                throw new Error(`Authentication failed: ${errorText}`);
            }
            throw new Error('Failed to authenticate - not redirected to Portal UXXI');
        }
        
        // Wait for page to fully load
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        
        console.log('Navegando a Información Académica...');
        
        // We should now be on https://portaluxxi.utec.edu.uy/ServiciosApp/
        // Wait for the page to load and look for navigation elements
        await page.waitForTimeout(3000); // Wait for dynamic content
        
        // Try to find and click "Información Académica" (could be in different formats)
        let infoAcademicaLink = null;
        
        // Try different selectors for "Información Académica"
        const selectors = [
            'text=Información Académica',
            'text=Informacion Academica',
            'a:has-text("Información Académica")',
            'a:has-text("Informacion Academica")',
            '[title*="Información Académica"]',
            '[title*="Informacion Academica"]'
        ];
        
        for (const selector of selectors) {
            try {
                infoAcademicaLink = await page.waitForSelector(selector, { 
                    visible: true,
                    timeout: 5000 
                });
                if (infoAcademicaLink) break;
            } catch (e) {
                continue;
            }
        }
        
        if (!infoAcademicaLink) {
            throw new Error('No se encontró el menú "Información Académica"');
        }
        
        await infoAcademicaLink.click();
        
        // Wait for submenu to appear
        await page.waitForTimeout(2000);
        
        console.log('Navegando a Progreso Académico con teclado...');
        
        // Use keyboard navigation: press Tab twice to navigate to "Progreso Académico"
        await page.keyboard.press('Tab');
        await page.waitForTimeout(500); // Small delay between tabs
        await page.keyboard.press('Tab');
        await page.waitForTimeout(500);
        
        // Press Enter to open the table
        await page.keyboard.press('Enter');
        
        console.log('Esperando tabla de materias...');
        
        // Wait for the specific academic progress table to load
        await page.waitForSelector('div[role="grid"]', { 
            visible: true,
            timeout: 15000 
        });
        
        // Extract subjects data from the specific grid table
        const subjects = await page.evaluate(() => {
            // Find the specific table div with role="grid"
            const gridDiv = document.querySelector('div[role="grid"]');
            if (!gridDiv) return [];
            
            // Look for table rows within this grid
            const rows = gridDiv.querySelectorAll('tr');
            const subjectsData = [];
            
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 5) {
                    const name = cells[0]?.textContent?.trim() || '';
                    const creditsText = cells[1]?.textContent?.trim() || '0';
                    const type = cells[2]?.textContent?.trim() || '';
                    const convocatoria = cells[3]?.textContent?.trim() || '';
                    const grade = cells[4]?.textContent?.trim() || '';
                    
                    // Filter out unwanted rows (help text, navigation, etc.)
                    const isValidSubject = name && 
                        !name.includes('¿Necesitas ayuda?') &&
                        !name.includes('Cambiar idioma') &&
                        !name.includes('English') &&
                        !name.includes('Español') &&
                        !name.includes('Inicio') &&
                        !name.includes('Ayuda') &&
                        !name.includes('Desconexión') &&
                        !name.includes('InicioAyudaDesconexión') &&
                        name.length > 3 && // Ensure it's not just short text like "-"
                        creditsText !== '-' && // Skip rows with no credits
                        !isNaN(parseInt(creditsText)); // Credits should be a number
                    
                    if (isValidSubject) {
                        const credits = parseInt(creditsText) || 0;
                        
                        // Determine if passed (usually grade >= 3 or specific text indicators)
                        const passed = grade && (
                            parseInt(grade) >= 3 || 
                            grade.toLowerCase().includes('aprobado') ||
                            grade.toLowerCase().includes('exonerado')
                        );
                        
                        subjectsData.push({
                            name,
                            credits,
                            type,
                            convocatoria,
                            grade,
                            passed
                        });
                    }
                }
            });
            
            return subjectsData;
        });
        
        console.log(`Se encontraron ${subjects.length} materias`);

        console.log(subjects);
        
        return {
            success: true,
            subjects: subjects
        };
        
    } catch (error) {
        console.error('Error al obtener progreso académico:', error.message);
        
        return {
            success: false,
            message: error.message || 'Error al obtener progreso académico',
            subjects: []
        };
        
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

module.exports = { scrapeAcademicProgress };