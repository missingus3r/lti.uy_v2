const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/adminAuth');
const Log = require('../models/Log');
const User = require('../models/User');
const LoginAttempt = require('../models/LoginAttempt');
const AcademicProgress = require('../models/AcademicProgress');
const MaintenanceConfig = require('../models/MaintenanceConfig');
const SecurityConfig = require('../models/SecurityConfig');
const assistantController = require('../controllers/assistantController');

// Admin dashboard
router.get('/dashboard', isAdmin, async (req, res) => {
    // Set cache headers to prevent caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    try {
        // Get statistics
        const stats = await Log.getStats();
        
        // Get total users, academic progress records, security stats, and maintenance status
        const [totalUsers, totalProgress, blockedUsers, usersWithFailedAttempts, maintenanceConfig, securityConfig] = await Promise.all([
            User.countDocuments(),
            AcademicProgress.countDocuments(),
            LoginAttempt.countDocuments({ isBlocked: true }),
            LoginAttempt.countDocuments({ failedAttempts: { $gt: 0 } }),
            MaintenanceConfig.getStatus(),
            SecurityConfig.getConfig()
        ]);
        
        res.render('admin/dashboard', {
            title: 'Dashboard Administrador - LTI.UY',
            stats: {
                ...stats,
                totalUsers,
                totalProgress,
                blockedUsers,
                usersWithFailedAttempts
            },
            maintenanceConfig,
            securityConfig
        });
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        res.status(500).render('error', {
            title: 'Error - LTI.UY',
            message: 'Error al cargar el dashboard'
        });
    }
});

// API endpoint for logs with pagination and filters
router.get('/api/logs', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const filters = {
            type: req.query.type,
            username: req.query.username,
            ip: req.query.ip,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        
        const result = await Log.getLogs(filters, page, limit);
        res.json(result);
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener logs'
        });
    }
});

// Admin logout
router.get('/logout', (req, res) => {
    console.log('Admin logout requested for user:', req.session.user ? req.session.user.username : 'unknown');
    
    // Clear all session data first
    req.session.authenticated = false;
    req.session.isAdmin = false;
    req.session.user = null;
    req.session.userHash = null;
    
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying admin session:', err);
            return res.status(500).send('Error al cerrar sesión');
        }
        
        // Clear all possible session cookies
        res.clearCookie('lti.session', {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
        
        // Also clear default session cookie name just in case
        res.clearCookie('connect.sid', {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
        
        // Clear any other potential cookies
        res.clearCookie('session', { path: '/' });
        res.clearCookie('sess', { path: '/' });
        
        // Set cache-control headers to prevent caching
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        console.log('Admin session destroyed and all cookies cleared');
        res.redirect('/');
    });
});

// Get users data
router.get('/api/users', isAdmin, async (req, res) => {
    try {
        const users = await User.find()
            .select('-__v')
            .sort({ createdAt: -1 })
            .lean();
        
        // Get academic progress for each user
        const usersWithProgress = await Promise.all(users.map(async (user) => {
            const progress = await AcademicProgress.findOne({ userHash: user.userHash })
                .select('totalCredits requiredCredits lastUpdated subjects')
                .lean();
            
            let obtainedCredits = 0;
            
            if (progress && progress.subjects) {
                console.log(`Checking subjects for user ${user.username}, total subjects: ${progress.subjects.length}`);
                
                // Find the TOTAL record in subjects where name is TOTAL and get the type field
                const totalRecord = progress.subjects.find(subject => 
                    subject.name && subject.name.trim().toUpperCase() === 'TOTAL'
                );
                
                console.log(`TOTAL record found:`, totalRecord);
                
                if (totalRecord && totalRecord.type) {
                    // Parse the type field to get the obtained credits
                    const credits = parseFloat(totalRecord.type.replace(',', '.'));
                    console.log("CREDITOS TOTALES: "+credits);
                    if (!isNaN(credits)) {
                        obtainedCredits = credits;
                    }
                } else {
                    console.log(`No TOTAL record found or no type field for user ${user.username}`);
                }
            }
            
            // If no TOTAL record found, fall back to totalCredits field
            if (obtainedCredits === 0 && progress && progress.totalCredits) {
                obtainedCredits = progress.totalCredits;
            }
            
            return {
                ...user,
                academicProgress: progress ? {
                    ...progress,
                    obtainedCredits
                } : null
            };
        }));
        
        res.json({
            success: true,
            users: usersWithProgress
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener usuarios'
        });
    }
});

// Get chat history for admin
router.get('/api/chat-history', isAdmin, assistantController.getAllChatHistory);

// Get specific chat session for admin
router.get('/api/chat-session/:sessionId', isAdmin, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const ChatHistory = require('../models/ChatHistory');
        
        const chatSession = await ChatHistory.findOne({ sessionId })
            .populate('userId', 'username')
            .lean();
        
        if (!chatSession) {
            return res.status(404).json({ error: 'Sesión de chat no encontrada' });
        }
        
        res.json({ chatSession });
    } catch (err) {
        console.error('Get chat session error:', err);
        res.status(500).json({ error: 'Error al obtener sesión de chat' });
    }
});

// Get blocked users
router.get('/api/blocked-users', isAdmin, async (req, res) => {
    try {
        const blockedUsers = await LoginAttempt.find({ 
            $or: [
                { isBlocked: true },
                { failedAttempts: { $gt: 0 } }
            ]
        })
        .select('username failedAttempts isBlocked blockedAt blockExpiresAt lastAttemptAt ipAddress')
        .sort({ blockedAt: -1, failedAttempts: -1 })
        .lean();
        
        // Add computed fields
        const usersWithStatus = blockedUsers.map(user => {
            const now = new Date();
            let status = 'active';
            let remainingTime = 0;
            
            if (user.isBlocked) {
                if (user.blockExpiresAt && now < user.blockExpiresAt) {
                    status = 'blocked';
                    remainingTime = Math.ceil((user.blockExpiresAt - now) / (1000 * 60));
                } else {
                    status = 'expired';
                }
            } else if (user.failedAttempts > 0) {
                status = 'warning';
            }
            
            return {
                ...user,
                failedLoginAttempts: user.failedAttempts, // Mantener compatibilidad con la UI
                status,
                remainingTime
            };
        });
        
        res.json({
            success: true,
            users: usersWithStatus
        });
    } catch (error) {
        console.error('Error fetching blocked users:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener usuarios bloqueados'
        });
    }
});

// Unblock user
router.post('/api/unblock-user/:username', isAdmin, async (req, res) => {
    try {
        const { username } = req.params;
        const loginAttempt = await LoginAttempt.findOne({ username });
        
        if (!loginAttempt) {
            return res.status(404).json({
                success: false,
                message: 'No se encontraron intentos de login para este usuario'
            });
        }
        
        loginAttempt.unblockUser();
        await loginAttempt.save();
        
        // Log the unblock action
        const { logUserUnblocked, getRealIP } = require('../utils/logger');
        await logUserUnblocked(
            username,
            getRealIP(req),
            `Desbloqueado manualmente por administrador ${req.session.user.username}`
        );
        
        res.json({
            success: true,
            message: `Usuario ${username} desbloqueado exitosamente`
        });
    } catch (error) {
        console.error('Error unblocking user:', error);
        res.status(500).json({
            success: false,
            message: 'Error al desbloquear usuario'
        });
    }
});

// Clear logs endpoint
router.post('/api/clear-logs', isAdmin, async (req, res) => {
    try {
        const result = await Log.deleteMany({});
        
        res.json({
            success: true,
            message: 'Logs limpiados exitosamente',
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Error clearing logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error al limpiar logs'
        });
    }
});

// Delete specific log endpoint
router.delete('/api/logs/:id', isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Validate ObjectId
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({
                success: false,
                message: 'ID de log inválido'
            });
        }
        
        const result = await Log.findByIdAndDelete(id);
        
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Log no encontrado'
            });
        }
        
        // Log the deletion action
        const { logDataUpdate, getRealIP } = require('../utils/logger');
        const adminUser = req.session.user ? req.session.user.username : 'admin';
        await logDataUpdate(
            adminUser,
            getRealIP(req),
            `Log eliminado - ID: ${id}, Tipo: ${result.type}, Usuario: ${result.username || 'N/A'}`
        );
        
        res.json({
            success: true,
            message: 'Log eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error deleting log:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar log'
        });
    }
});

// Delete multiple logs endpoint
router.delete('/api/logs', isAdmin, async (req, res) => {
    try {
        const { ids } = req.body;
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'IDs de logs requeridos'
            });
        }
        
        // Validate all ObjectIds
        const invalidIds = ids.filter(id => !id.match(/^[0-9a-fA-F]{24}$/));
        if (invalidIds.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Algunos IDs de logs son inválidos'
            });
        }
        
        // Get logs before deletion for logging purposes
        const logsToDelete = await Log.find({ _id: { $in: ids } }).lean();
        
        const result = await Log.deleteMany({ _id: { $in: ids } });
        
        // Log the deletion action
        const { logDataUpdate, getRealIP } = require('../utils/logger');
        const adminUser = req.session.user ? req.session.user.username : 'admin';
        await logDataUpdate(
            adminUser,
            getRealIP(req),
            `Eliminación múltiple de logs - ${result.deletedCount} logs eliminados. IDs: ${ids.join(', ')}`
        );
        
        res.json({
            success: true,
            message: `${result.deletedCount} logs eliminados exitosamente`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Error deleting multiple logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar logs'
        });
    }
});

// Get maintenance status
router.get('/api/maintenance-status', isAdmin, async (req, res) => {
    try {
        const config = await MaintenanceConfig.getStatus();
        res.json({
            success: true,
            config
        });
    } catch (error) {
        console.error('Error fetching maintenance status:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estado de mantenimiento'
        });
    }
});

// Toggle maintenance mode
router.post('/api/toggle-maintenance', isAdmin, async (req, res) => {
    try {
        const { enabled, message } = req.body;
        const adminUser = req.session.user ? req.session.user.username : 'admin';
        
        const config = await MaintenanceConfig.toggleMaintenanceMode(enabled, message, adminUser);
        
        // Log the maintenance mode change
        const { logMaintenanceToggle, getRealIP } = require('../utils/logger');
        await logMaintenanceToggle(
            adminUser,
            getRealIP(req),
            enabled,
            message
        );
        
        res.json({
            success: true,
            message: enabled ? 'Modo mantenimiento activado' : 'Modo mantenimiento desactivado',
            config
        });
    } catch (error) {
        console.error('Error toggling maintenance mode:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar modo de mantenimiento'
        });
    }
});

// Get security config
router.get('/api/security-config', isAdmin, async (req, res) => {
    try {
        const config = await SecurityConfig.getConfig();
        
        res.json({
            success: true,
            config
        });
    } catch (error) {
        console.error('Error getting security config:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener configuración de seguridad'
        });
    }
});

// Update security config
router.post('/api/security-config', isAdmin, async (req, res) => {
    try {
        const { maxLoginAttempts, blockDurationMinutes } = req.body;
        const adminUser = req.session.user ? req.session.user.username : 'admin';
        
        // Validate input
        if (maxLoginAttempts && (maxLoginAttempts < 1 || maxLoginAttempts > 10)) {
            return res.status(400).json({
                success: false,
                message: 'El máximo de intentos debe estar entre 1 y 10'
            });
        }
        
        if (blockDurationMinutes && (blockDurationMinutes < 5 || blockDurationMinutes > 1440)) {
            return res.status(400).json({
                success: false,
                message: 'La duración del bloqueo debe estar entre 5 minutos y 24 horas'
            });
        }
        
        const config = await SecurityConfig.updateConfig({
            maxLoginAttempts,
            blockDurationMinutes
        }, adminUser);
        
        // Log the security config change
        const { logSecurityConfigChange, getRealIP } = require('../utils/logger');
        await logSecurityConfigChange(
            adminUser,
            getRealIP(req),
            `Intentos máximos: ${config.maxLoginAttempts}, Duración bloqueo: ${config.blockDurationMinutes} minutos`
        );
        
        res.json({
            success: true,
            message: 'Configuración de seguridad actualizada',
            config
        });
    } catch (error) {
        console.error('Error updating security config:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar configuración de seguridad'
        });
    }
});

module.exports = router;