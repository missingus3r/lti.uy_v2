const express = require('express');
const router = express.Router();
const assistantController = require('../controllers/assistantController');

// Middleware to check if user is authenticated
const checkAuth = (req, res, next) => {
    if (!req.session.authenticated) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    next();
};

// AI Assistant endpoints
router.post('/assistant', checkAuth, assistantController.chat);
router.get('/assistant/history', checkAuth, assistantController.getChatHistory);
router.get('/assistant/session/:sessionId', checkAuth, assistantController.getChatSession);
router.delete('/assistant/session/:sessionId', checkAuth, assistantController.deleteChatSession);
router.delete('/assistant/history', checkAuth, assistantController.clearChatHistory);

module.exports = router;