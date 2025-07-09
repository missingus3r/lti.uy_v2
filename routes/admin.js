const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/adminAuth');
const Log = require('../models/Log');
const User = require('../models/User');
const AcademicProgress = require('../models/AcademicProgress');
const assistantController = require('../controllers/assistantController');

// Admin dashboard
router.get('/dashboard', isAdmin, async (req, res) => {
    try {
        // Get statistics
        const stats = await Log.getStats();
        
        // Get total users and academic progress records
        const [totalUsers, totalProgress] = await Promise.all([
            User.countDocuments(),
            AcademicProgress.countDocuments()
        ]);
        
        res.render('admin/dashboard', {
            title: 'Dashboard Administrador - LTI.UY',
            stats: {
                ...stats,
                totalUsers,
                totalProgress
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

module.exports = router;