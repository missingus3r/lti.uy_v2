const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User');
const LoginAttempt = require('../models/LoginAttempt');
const AcademicProgress = require('../models/AcademicProgress');
const CareerPlan = require('../models/CareerPlan');
const { logLoginAttempt, logUserBlocked, logDataUpdate, getRealIP } = require('../utils/logger');
const { checkMaintenanceForLogin } = require('../middleware/maintenanceMode');

// Get Playwright API URL from environment
const PLAYWRIGHT_API_URL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:8000';

// Helper function to call Playwright API
async function callPlaywrightAPI(endpoint, data) {
    try {
        const response = await axios.post(`${PLAYWRIGHT_API_URL}${endpoint}`, data, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000 // 60 seconds timeout
        });
        return response.data;
    } catch (error) {
        console.error(`Error calling Playwright API ${endpoint}:`, error.message);
        if (error.response) {
            throw new Error(error.response.data.detail || 'API error');
        }
        throw error;
    }
}

router.post('/login', checkMaintenanceForLogin, async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Usuario y contraseña son requeridos'
        });
    }
    
    // Normalize username to lowercase
    const normalizedUsername = username.toLowerCase().trim();
    
    try {
        // Check if it's admin login
        const adminUser = process.env.ADMIN_USER;
        const adminPassword = process.env.ADMIN_PASSWORD;
        
        if (normalizedUsername === adminUser && password === adminPassword) {
            // Admin login successful
            req.session.authenticated = true;
            req.session.isAdmin = true;
            req.session.user = {
                _id: 'admin',
                username: normalizedUsername,
                userHash: 'admin'
            };
            
            // Log successful admin login
            await logLoginAttempt(normalizedUsername, getRealIP(req), true, req.headers['user-agent']);
            
            return res.json({
                success: true,
                message: 'Autenticación de administrador exitosa',
                isAdmin: true,
                redirectUrl: '/admin/dashboard'
            });
        }
        
        // Check login attempts for this username (regardless of user existence)
        const loginAttempt = await LoginAttempt.findOrCreate(normalizedUsername, getRealIP(req), req.headers['user-agent']);
        
        // Check if this username is blocked
        if (loginAttempt.isCurrentlyBlocked()) {
            const remainingTime = loginAttempt.getRemainingBlockTime();
            await logLoginAttempt(normalizedUsername, getRealIP(req), false, req.headers['user-agent']);
            
            return res.status(429).json({
                success: false,
                message: `Tu cuenta está bloqueada por intentos fallidos. Intenta nuevamente en ${remainingTime} minutos.`,
                isBlocked: true,
                remainingTime: remainingTime,
                blockExpiresAt: loginAttempt.blockExpiresAt
            });
        }
        
        // Regular user login - call Playwright API
        const result = await callPlaywrightAPI('/api/moodle-auth', { username: normalizedUsername, password });
        
        if (result.success) {
            // Log successful login
            await logLoginAttempt(normalizedUsername, getRealIP(req), true, req.headers['user-agent']);
            
            // Find or create user in User collection
            let user = await User.findOne({ username: normalizedUsername });
            
            if (!user) {
                // Create new user with unique hash
                user = new User({ username: normalizedUsername });
                user.userHash = user.generateUserHash();
                await user.save();
            }
            
            // Reset failed attempts on successful login
            loginAttempt.resetFailedAttempts();
            await loginAttempt.save();
            
            req.session.authenticated = true;
            req.session.user = {
                _id: user._id,
                username: user.username,
                userHash: user.userHash
            };
            req.session.userHash = user.userHash;
            
            // Check if we need to fetch academic data (5-day interval)
            const needsUpdate = user.needsDataUpdateFiveDays();           
            // Also check if user has academic progress data
            const academicProgress = await AcademicProgress.findOne({ userHash: user.userHash });

            // Force update if user has no academic progress data, regardless of lastDataFetch
            const shouldFetchData = needsUpdate || !academicProgress;

            if (shouldFetchData) {
                // Fetch academic progress in background - call Playwright API
                callPlaywrightAPI('/api/academic-progress', { username: normalizedUsername, password })
                    .then(async (progressResult) => {
                        if (progressResult.success) {
                            console.log(`Processing academic progress for ${normalizedUsername} - ${progressResult.subjects.length} subjects found`);
                            // Update or create academic progress
                            let academicProgress = await AcademicProgress.findOne({ userHash: user.userHash });
                            
                            if (!academicProgress) {
                                academicProgress = new AcademicProgress({
                                    userHash: user.userHash,
                                    subjects: progressResult.subjects
                                });
                                console.log(`Created new academic progress for ${normalizedUsername}`);
                                academicProgress.mergeSubjectsData(progressResult.subjects);
                                academicProgress.calculateTotalCredits();
                                await academicProgress.updateRequiredCreditsFromPlan();
                                await academicProgress.save();
                                
                                // Update user's last fetch date
                                user.lastDataFetch = new Date();
                                user.dataQualityWarning = false;
                                user.dataQualityReason = null;
                                await user.save();
                            } else {
                                // Validate data quality before merging
                                const dataQuality = academicProgress.validateDataQuality(progressResult.subjects);
                                
                                if (dataQuality.isValid) {
                                    // Good quality data - merge it
                                    academicProgress.mergeSubjectsData(progressResult.subjects);
                                    academicProgress.calculateTotalCredits();
                                    await academicProgress.updateRequiredCreditsFromPlan();
                                    await academicProgress.save();
                                    
                                    // Update user's last fetch date and clear any warning
                                    user.lastDataFetch = new Date();
                                    user.dataQualityWarning = false;
                                    user.dataQualityReason = null;
                                    await user.save();
                                    
                                    console.log(`Updated existing academic progress for ${normalizedUsername} - Quality OK`);
                                } else {
                                    // Poor quality data - keep existing data and set warning
                                    console.log(`Poor quality data detected for ${normalizedUsername}:`, dataQuality.reason);
                                    console.log(`Existing: ${dataQuality.existingStats.passedSubjects} subjects, ${dataQuality.existingStats.totalCredits} credits`);
                                    console.log(`New: ${dataQuality.newStats.passedSubjects} subjects, ${dataQuality.newStats.totalCredits} credits`);
                                    
                                    // Set warning flag but don't update lastDataFetch (will retry next time)
                                    user.dataQualityWarning = true;
                                    user.dataQualityReason = dataQuality.reason;
                                    await user.save();
                                    
                                    console.log(`Keeping existing data for ${normalizedUsername} due to quality issues`);
                                }
                            }
                            
                            console.log(`Academic progress processed for ${normalizedUsername} - Total credits: ${academicProgress.totalCredits}`);
                            
                            // Log the automatic data update
                            await logDataUpdate(
                                normalizedUsername,
                                getRealIP(req),
                                `Actualización automática de datos académicos - Créditos: ${academicProgress.totalCredits}/${academicProgress.requiredCredits}${user.dataQualityWarning ? ' (calidad de datos cuestionable)' : ''}`
                            );
                        } else {
                            console.log(`Scraper failed for ${normalizedUsername}:`, progressResult.message);
                        }
                    })
                    .catch(err => console.error('Error fetching academic progress:', err));
            } else {
                console.log(`No need to update data for user ${normalizedUsername} - last fetch: ${user.lastDataFetch}, has academic progress: ${!!academicProgress}, 5-day check: ${needsUpdate}`);
            }
            
            res.json({
                success: true,
                message: 'Autenticación exitosa',
                userHash: user.userHash,
                needsUpdate: shouldFetchData
            });
        } else {
            // Log failed login
            await logLoginAttempt(normalizedUsername, getRealIP(req), false, req.headers['user-agent']);
            
            // Handle failed login attempts and blocking
            loginAttempt.incrementFailedAttempts();
            
            // Check if user should be blocked (3 failed attempts)
            if (loginAttempt.failedAttempts >= 3) {
                loginAttempt.blockUser();
                await loginAttempt.save();
                
                // Log the blocking event
                await logUserBlocked(normalizedUsername, getRealIP(req), 'Usuario bloqueado por 3 intentos fallidos');
                
                return res.status(429).json({
                    success: false,
                    message: 'Demasiados intentos fallidos. Tu cuenta ha sido bloqueada por 15 minutos.',
                    isBlocked: true,
                    remainingTime: 15,
                    blockExpiresAt: loginAttempt.blockExpiresAt
                });
            } else {
                await loginAttempt.save();
                const remainingAttempts = loginAttempt.getRemainingAttempts();
                
                return res.status(401).json({
                    success: false,
                    message: `Credenciales inválidas. Te quedan ${remainingAttempts} intentos antes de que tu cuenta sea bloqueada.`,
                    remainingAttempts: remainingAttempts
                });
            }
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
        
        if (!req.session || !req.session.authenticated || !req.session.user || !req.session.userHash || req.session.userHash !== userHash) {
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
            needsUpdate: user.needsDataUpdateFiveDays(),
            canManualRefresh: user.canManualRefresh(),
            manualRefreshesLeft: 2 - user.manualRefreshCount,
            dataQualityWarning: user.dataQualityWarning || false,
            dataQualityReason: user.dataQualityReason || null
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
        const username = req.session.user.username;
        
        if (!req.session || !req.session.authenticated || !req.session.user || !userHash || !username) {
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
        
        // Verify password first - call Playwright API
        const authResult = await callPlaywrightAPI('/api/moodle-auth', { username: username, password });
        
        if (!authResult.success) {
            return res.status(401).json({
                success: false,
                message: 'Contraseña incorrecta'
            });
        }
        
        // Fetch academic progress - call Playwright API
        const progressResult = await callPlaywrightAPI('/api/academic-progress', { username: username, password });
        
        if (progressResult.success) {
            // Update academic progress
            let academicProgress = await AcademicProgress.findOne({ userHash });
            
            if (!academicProgress) {
                academicProgress = new AcademicProgress({
                    userHash: userHash,
                    subjects: progressResult.subjects
                });
                academicProgress.mergeSubjectsData(progressResult.subjects);
                academicProgress.calculateTotalCredits();
                await academicProgress.updateRequiredCreditsFromPlan();
                await academicProgress.save();
                
                // Update user
                user.lastDataFetch = new Date();
                user.incrementManualRefresh();
                user.dataQualityWarning = false;
                user.dataQualityReason = null;
                await user.save();
            } else {
                // Validate data quality before merging
                const dataQuality = academicProgress.validateDataQuality(progressResult.subjects);
                
                if (dataQuality.isValid) {
                    // Good quality data - merge it
                    academicProgress.mergeSubjectsData(progressResult.subjects);
                    academicProgress.calculateTotalCredits();
                    await academicProgress.updateRequiredCreditsFromPlan();
                    await academicProgress.save();
                    
                    // Update user
                    user.lastDataFetch = new Date();
                    user.incrementManualRefresh();
                    user.dataQualityWarning = false;
                    user.dataQualityReason = null;
                    await user.save();
                } else {
                    // Poor quality data - keep existing data but still count the manual refresh
                    user.incrementManualRefresh();
                    user.dataQualityWarning = true;
                    user.dataQualityReason = dataQuality.reason;
                    await user.save();
                    
                    return res.json({
                        success: true,
                        message: 'Los datos obtenidos tienen menor calidad que los existentes. Se mantuvieron los datos actuales.',
                        warning: true,
                        dataQuality: dataQuality,
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
                }
            }
            
            // Log the data update
            await logDataUpdate(
                username,
                getRealIP(req),
                `Actualización manual de datos académicos - Créditos: ${academicProgress.totalCredits}/${academicProgress.requiredCredits}${user.dataQualityWarning ? ' (calidad de datos cuestionable)' : ''}`
            );
            
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
        if (!req.session || !req.session.authenticated || !req.session.user) {
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
        
        if (!req.session || !req.session.authenticated || !req.session.user || !userHash) {
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