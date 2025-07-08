// Script de prueba para verificar el login con Playwright
// USO: node test-login.js <usuario> <contraseña>

const { authenticateWithMoodle } = require('./utils/moodleAuth');

async function testLogin() {
    const args = process.argv.slice(2);
    
    if (args.length !== 2) {
        console.log('Uso: node test-login.js <usuario> <contraseña>');
        process.exit(1);
    }
    
    const [username, password] = args;
    
    console.log('Probando login con usuario:', username);
    console.log('=====================================\n');
    
    try {
        const result = await authenticateWithMoodle(username, password);
        
        console.log('\nResultado:');
        console.log('----------');
        console.log('Éxito:', result.success);
        console.log('Mensaje:', result.message);
        
        if (result.success) {
            console.log('\n✅ ¡Login exitoso! El sistema de autenticación funciona correctamente.');
        } else {
            console.log('\n❌ Login fallido. Verifica las credenciales.');
        }
    } catch (error) {
        console.error('\n❌ Error durante la prueba:', error.message);
    }
}

// Ejecutar la prueba
testLogin();