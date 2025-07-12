const MaintenanceConfig = require('../models/MaintenanceConfig');

// Middleware para verificar si el modo mantenimiento está activado
const checkMaintenanceMode = async (req, res, next) => {
    try {
        const config = await MaintenanceConfig.getStatus();
        
        // Si el modo mantenimiento está activado
        if (config.isMaintenanceMode) {
            // Permitir que los administradores ya autenticados sigan navegando
            if (req.session && req.session.isAdmin) {
                return next();
            }
            
            // Para requests AJAX, retornar JSON
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(503).json({
                    success: false,
                    maintenance: true,
                    message: config.maintenanceMessage
                });
            }
            
            // Para requests normales, mostrar página de mantenimiento
            return res.status(503).render('maintenance', {
                title: 'Mantenimiento - LTI.UY',
                message: config.maintenanceMessage,
                config: config
            });
        }
        
        // Si no hay mantenimiento, continuar normal
        next();
    } catch (error) {
        console.error('Error checking maintenance mode:', error);
        // En caso de error, permitir continuar para no romper el sitio
        next();
    }
};

// Middleware para verificar modo mantenimiento solo en rutas de login
const checkMaintenanceForLogin = async (req, res, next) => {
    try {
        const config = await MaintenanceConfig.getStatus();
        
        // Si el modo mantenimiento está activado para rutas de login
        if (config.isMaintenanceMode) {
            // Para POST /auth/login, verificar si es intento de login de admin
            if (req.method === 'POST' && req.body) {
                const { username } = req.body;
                const adminUser = process.env.ADMIN_USER;
                
                // Si es intento de login de admin, permitir continuar
                if (username && username.toLowerCase().trim() === adminUser) {
                    return next();
                }
                
                // Si no es admin, bloquear con mensaje de mantenimiento
                return res.status(503).json({
                    success: false,
                    maintenance: true,
                    message: config.maintenanceMessage
                });
            }
            
            // Para requests AJAX de login, retornar JSON
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(503).json({
                    success: false,
                    maintenance: true,
                    message: config.maintenanceMessage
                });
            }
            
            // Para GET /login, mostrar página de mantenimiento
            if (req.method === 'GET') {
                return res.status(503).render('maintenance', {
                    title: 'Mantenimiento - LTI.UY',
                    message: config.maintenanceMessage,
                    config: config
                });
            }
        }
        
        // Si no hay mantenimiento, continuar normal
        next();
    } catch (error) {
        console.error('Error checking maintenance mode for login:', error);
        // En caso de error, permitir continuar para no romper el login
        next();
    }
};

module.exports = {
    checkMaintenanceMode,
    checkMaintenanceForLogin
};