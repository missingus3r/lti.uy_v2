const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/adminAuth');
const Log = require('../models/Log');
const User = require('../models/User');
const LoginAttempt = require('../models/LoginAttempt');
const AcademicProgress = require('../models/AcademicProgress');
const assistantController = require('../controllers/assistantController');

// Admin dashboard
router.get('/dashboard', isAdmin, async (req, res) => {
    try {
        // Get statistics
        const stats = await Log.getStats();
        
        // Get total users, academic progress records, and security stats
        const [totalUsers, totalProgress, blockedUsers, usersWithFailedAttempts] = await Promise.all([
            User.countDocuments(),
            AcademicProgress.countDocuments(),
            LoginAttempt.countDocuments({ isBlocked: true }),
            LoginAttempt.countDocuments({ failedAttempts: { $gt: 0 } })
        ]);
        
        res.render('admin/dashboard', {
            title: 'Dashboard Administrador - LTI.UY',
            stats: {
                ...stats,
                totalUsers,
                totalProgress,
                blockedUsers,
                usersWithFailedAttempts
            }
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
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/login');
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
                .select('totalCredits requiredCredits lastUpdated')
                .lean();
            
            return {
                ...user,
                academicProgress: progress
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

module.exports = router;