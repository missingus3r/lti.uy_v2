const express = require('express');
const router = express.Router();
const { authenticateWithMoodle } = require('../utils/moodleAuth');
const { scrapeAcademicProgress } = require('../utils/academicScraper');
const User = require('../models/User');
const AcademicProgress = require('../models/AcademicProgress');
const CareerPlan = require('../models/CareerPlan');
const { logLoginAttempt, getRealIP } = require('../utils/logger');

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Usuario y contraseña son requeridos'
        });
    }
    
    try {
        // Check if it's admin login
        const adminUser = process.env.ADMIN_USER;
        const adminPassword = process.env.ADMIN_PASSWORD;
        
        if (username === adminUser && password === adminPassword) {
            // Admin login successful
            req.session.authenticated = true;
            req.session.isAdmin = true;
            req.session.user = username;
            
            // Log successful admin login
            await logLoginAttempt(username, getRealIP(req), true, req.headers['user-agent']);
            
            return res.json({
                success: true,
                message: 'Autenticación de administrador exitosa',
                isAdmin: true,
                redirectUrl: '/admin/dashboard'
            });
        }
        
        // Regular user login
        const result = await authenticateWithMoodle(username, password);
        
        if (result.success) {
            // Log successful login
            await logLoginAttempt(username, getRealIP(req), true, req.headers['user-agent']);
            
            // Find or create user
            let user = await User.findOne({ username });
            
            if (!user) {
                // Create new user with unique hash
                user = new User({ username });
                user.userHash = user.generateUserHash();
                await user.save();
            }
            
            req.session.authenticated = true;
            req.session.user = username;
            req.session.userHash = user.userHash;
            
            // Check if we need to fetch academic data
            if (user.needsDataUpdate()) {
                // Fetch academic progress in background
                scrapeAcademicProgress(username, password)
                    .then(async (progressResult) => {
                        if (progressResult.success) {
                            // Update or create academic progress
                            let academicProgress = await AcademicProgress.findOne({ userHash: user.userHash });
                            
                            if (!academicProgress) {
                                academicProgress = new AcademicProgress({
                                    userHash: user.userHash,
                                    subjects: progressResult.subjects
                                });
                            } else {
                                // Merge new data with existing data (preserve existing, update grades, add new subjects)
                                academicProgress.mergeSubjectsData(progressResult.subjects);
                            }
                            
                            academicProgress.calculateTotalCredits();
                            await academicProgress.save();
                            
                            // Update user's last fetch date
                            user.lastDataFetch = new Date();
                            await user.save();
                        }
                    })
                    .catch(err => console.error('Error fetching academic progress:', err));
            }
            
            res.json({
                success: true,
                message: 'Autenticación exitosa',
                userHash: user.userHash,
                needsUpdate: user.needsDataUpdate()
            });
        } else {
            // Log failed login
            await logLoginAttempt(username, getRealIP(req), false, req.headers['user-agent']);
            
            res.status(401).json({
                success: false,
                message: result.message || 'Credenciales inválidas'
            });
        }
    } catch (error) {
        console.error('Error en autenticación:', error);
        res.status(500).json({
            success: false,
            message: 'Error del servidor. Por favor, intenta más tarde.'
        });
    }
});

// Get academic progress
router.get('/academic-progress/:userHash', async (req, res) => {
    try {
        const { userHash } = req.params;
        
        if (!req.session.authenticated || req.session.userHash !== userHash) {
            return res.status(401).json({
                success: false,
                message: 'No autorizado'
            });
        }
        
        const academicProgress = await AcademicProgress.findOne({ userHash });
        const user = await User.findOne({ userHash });
        
        if (!academicProgress) {
            return res.json({
                success: true,
                data: null,
                needsUpdate: true,
                canManualRefresh: user ? user.canManualRefresh() : false,
                manualRefreshesLeft: user ? (2 - user.manualRefreshCount) : 2
            });
        }
        
        res.json({
            success: true,
            data: {
                subjects: academicProgress.subjects,
                totalCredits: academicProgress.totalCredits,
                requiredCredits: academicProgress.requiredCredits,
                remainingCredits: academicProgress.getRemainingCredits(),
                progressPercentage: academicProgress.getProgressPercentage(),
                lastUpdated: academicProgress.lastUpdated
            },
            needsUpdate: user.needsDataUpdate(),
            canManualRefresh: user.canManualRefresh(),
            manualRefreshesLeft: 2 - user.manualRefreshCount
        });
    } catch (error) {
        console.error('Error getting academic progress:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener progreso académico'
        });
    }
});

// Manual refresh endpoint
router.post('/refresh-progress', async (req, res) => {
    try {
        const { password } = req.body;
        const userHash = req.session.userHash;
        const username = req.session.user;
        
        if (!req.session.authenticated || !userHash || !username) {
            return res.status(401).json({
                success: false,
                message: 'No autorizado'
            });
        }
        
        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere contraseña para actualizar'
            });
        }
        
        const user = await User.findOne({ userHash });
        
        if (!user || !user.canManualRefresh()) {
            return res.status(429).json({
                success: false,
                message: 'Has alcanzado el límite de actualizaciones manuales (2 por día)'
            });
        }
        
        // Verify password first
        const authResult = await authenticateWithMoodle(username, password);
        
        if (!authResult.success) {
            return res.status(401).json({
                success: false,
                message: 'Contraseña incorrecta'
            });
        }
        
        // Fetch academic progress
        const progressResult = await scrapeAcademicProgress(username, password);
        
        if (progressResult.success) {
            // Update academic progress
            let academicProgress = await AcademicProgress.findOne({ userHash });
            
            if (!academicProgress) {
                academicProgress = new AcademicProgress({
                    userHash: userHash,
                    subjects: progressResult.subjects
                });
            } else {
                // Merge new data with existing data (preserve existing, update grades, add new subjects)
                academicProgress.mergeSubjectsData(progressResult.subjects);
            }
            
            academicProgress.calculateTotalCredits();
            await academicProgress.save();
            
            // Update user
            user.lastDataFetch = new Date();
            user.incrementManualRefresh();
            await user.save();
            
            res.json({
                success: true,
                message: 'Progreso académico actualizado',
                data: {
                    subjects: academicProgress.subjects,
                    totalCredits: academicProgress.totalCredits,
                    requiredCredits: academicProgress.requiredCredits,
                    remainingCredits: academicProgress.getRemainingCredits(),
                    progressPercentage: academicProgress.getProgressPercentage(),
                    lastUpdated: academicProgress.lastUpdated
                },
                manualRefreshesLeft: 2 - user.manualRefreshCount
            });
        } else {
            res.status(500).json({
                success: false,
                message: progressResult.message || 'Error al actualizar progreso académico'
            });
        }
    } catch (error) {
        console.error('Error in manual refresh:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar progreso académico'
        });
    }
});

// Get career plans
router.get('/career-plans', async (req, res) => {
    try {
        if (!req.session.authenticated) {
            return res.status(401).json({
                success: false,
                message: 'No autorizado'
            });
        }
        
        const plans = await CareerPlan.find().sort({ year: -1 });
        const user = await User.findOne({ userHash: req.session.userHash });
        
        res.json({
            success: true,
            plans: plans,
            selectedPlan: user ? user.selectedPlan : null
        });
    } catch (error) {
        console.error('Error getting career plans:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener planes de carrera'
        });
    }
});

// Change user's selected plan
router.post('/change-plan', async (req, res) => {
    try {
        const { planId } = req.body;
        const userHash = req.session.userHash;
        
        if (!req.session.authenticated || !userHash) {
            return res.status(401).json({
                success: false,
                message: 'No autorizado'
            });
        }
        
        if (!planId) {
            return res.status(400).json({
                success: false,
                message: 'ID del plan es requerido'
            });
        }
        
        // Verify plan exists
        const plan = await CareerPlan.findById(planId);
        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan no encontrado'
            });
        }
        
        // Update user's selected plan
        const user = await User.findOne({ userHash });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }
        
        user.selectedPlan = planId;
        await user.save();
        
        // Update academic progress plan reference and required credits
        let academicProgress = await AcademicProgress.findOne({ userHash });
        if (academicProgress) {
            academicProgress.careerPlan = planId;
            academicProgress.requiredCredits = plan.totalCredits;
            await academicProgress.save();
        }
        
        res.json({
            success: true,
            message: `Plan cambiado a ${plan.name}`,
            selectedPlan: planId
        });
    } catch (error) {
        console.error('Error changing plan:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar plan'
        });
    }
});

module.exports = router;