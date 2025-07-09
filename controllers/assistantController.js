const { GoogleGenerativeAI } = require('@google/generative-ai');
const ChatHistory = require('../models/ChatHistory');
const User = require('../models/User');
const AcademicProgress = require('../models/AcademicProgress');
const CareerPlan = require('../models/CareerPlan');

/**
 * Helper function to build conversation history for context
 */
function buildConversationHistory(messages) {
    if (!messages || messages.length === 0) {
        return '';
    }

    let conversationHistory = '\n\nHISTORIAL DE LA CONVERSACIÓN';
    const recentMessages = messages.slice(-10); // Last 10 messages to avoid token limits

    if (messages.length > 10) {
        conversationHistory += ` (últimos 10 mensajes de ${messages.length} total)`;
    }

    conversationHistory += ':\n';

    recentMessages.forEach(msg => {
        // Truncate very long messages to avoid token limits
        const content = msg.content.length > 500 ? msg.content.substring(0, 500) + '...' : msg.content;
        conversationHistory += `${msg.role.toUpperCase()}: ${content}\n`;
    });

    return conversationHistory;
}

/**
 * Chat endpoint for AI assistant.
 * Uses Google Gemini API with context from LTI.UY academic data.
 */
exports.chat = async (req, res) => {
    try {
        const { question, sessionId } = req.body;
        if (!question) return res.status(400).json({ error: 'Pregunta requerida' });

        const userId = req.session.user._id;
        const username = req.session.user.username;

        console.log('🤖 Assistant request:', {
            userId,
            username,
            question: question.substring(0, 50) + '...',
            sessionId
        });

        // Get user data
        const user = await User.findById(userId).lean();
        if (!user) {
            return res.status(400).json({ error: 'Usuario no encontrado' });
        }

        // Get user's academic progress
        const academicProgress = await AcademicProgress.findOne({ userHash: user.userHash }).lean();
        
        // Get available career plans
        const careerPlans = await CareerPlan.find({}).lean();
        
        // Get selected career plan
        let selectedPlan = null;
        if (user.selectedPlan) {
            selectedPlan = await CareerPlan.findById(user.selectedPlan).lean();
        } else if (careerPlans.length > 0) {
            selectedPlan = careerPlans[0]; // Default to first plan
        }

        // Build comprehensive context for LTI.UY
        const context = {
            user: {
                username: user.username,
                registrationDate: user.createdAt,
                selectedPlan: selectedPlan ? selectedPlan.name : 'No seleccionado',
                lastDataUpdate: user.lastDataFetch,
                manualRefreshCount: user.manualRefreshCount
            },
            academicProgress: academicProgress ? {
                totalCredits: academicProgress.totalCredits,
                requiredCredits: academicProgress.requiredCredits,
                progressPercentage: Math.round((academicProgress.totalCredits / academicProgress.requiredCredits) * 100),
                remainingCredits: academicProgress.requiredCredits - academicProgress.totalCredits,
                subjectsTotal: academicProgress.subjects.length,
                subjectsPassed: academicProgress.subjects.filter(s => s.passed).length,
                subjectsPending: academicProgress.subjects.filter(s => !s.passed).length,
                lastUpdated: academicProgress.lastUpdated,
                subjects: academicProgress.subjects.map(s => ({
                    name: s.name,
                    credits: s.credits,
                    type: s.type,
                    passed: s.passed,
                    grade: s.grade,
                    convocatoria: s.convocatoria
                }))
            } : {
                message: 'No se han cargado datos académicos aún. El usuario debe iniciar sesión para obtener sus datos desde el portal académico.'
            },
            careerPlans: {
                available: careerPlans.map(plan => ({
                    name: plan.name,
                    totalCredits: plan.totalCredits,
                    description: plan.description,
                    subjects: plan.subjects.map(s => ({
                        name: s.name,
                        credits: s.credits,
                        semester: s.semester,
                        type: s.type
                    }))
                })),
                selected: selectedPlan ? {
                    name: selectedPlan.name,
                    totalCredits: selectedPlan.totalCredits,
                    description: selectedPlan.description,
                    subjects: selectedPlan.subjects.map(s => ({
                        name: s.name,
                        credits: s.credits,
                        semester: s.semester,
                        type: s.type
                    }))
                } : null
            },
            utecInfo: {
                institution: 'Universidad Tecnológica del Uruguay (UTEC)',
                career: 'Licenciatura en Tecnologías de la Información (LTI)',
                platform: 'LTI.UY - Plataforma no oficial para estudiantes de LTI',
                features: [
                    'Seguimiento de progreso académico',
                    'Visualización de materias aprobadas y pendientes',
                    'Cálculo automático de créditos',
                    'Comparación con diferentes planes de carrera',
                    'Asistente de IA para consultas académicas'
                ]
            }
        };

        // Handle chat history - Load existing session BEFORE generating response
        let chatSession;
        let conversationHistory = '';

        if (sessionId) {
            // Find existing chat session
            chatSession = await ChatHistory.findOne({ sessionId, userId });
            if (!chatSession) {
                return res.status(400).json({ error: 'Sesión de chat no encontrada' });
            }

            // Build conversation history for context
            conversationHistory = buildConversationHistory(chatSession.messages);
        } else {
            // Create new chat session
            chatSession = ChatHistory.createSession(userId);
        }

        // Configure Google Gemini
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        // Prepare prompt with context and conversation history
        const prompt = `Eres un asistente virtual de LTI.UY, una plataforma no oficial para estudiantes de la Licenciatura en Tecnologías de la Información (LTI) de UTEC.

CONTEXTO DEL USUARIO Y SISTEMA:
${JSON.stringify(context, null, 2)}

INSTRUCCIONES:
- Responde en español de manera amigable y profesional
- Usa la información del contexto para dar respuestas precisas sobre el progreso académico del usuario
- Puedes ayudar con consultas sobre:
  * Progreso académico personal (créditos, materias aprobadas/pendientes)
  * Planes de carrera disponibles y sus diferencias
  * Información sobre materias específicas
  * Cálculos de créditos y estimaciones de graduación
  * Información general sobre UTEC y la carrera LTI
  * Funcionalidades de la plataforma LTI.UY
- Si no tienes información suficiente, dilo claramente y sugiere al usuario cómo obtenerla
- Mantén las respuestas concisas pero informativas
- Usa el historial de la conversación para mantener contexto y continuidad
- Respeta la privacidad del usuario y no inventes datos que no estén en el contexto${conversationHistory}

PREGUNTA ACTUAL DEL USUARIO:
${question}`;

        // Call Gemini
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const answer = response.text();

        // Add user question and assistant response to history
        chatSession.addMessage('user', question);
        chatSession.addMessage('assistant', answer);

        // Save chat history
        await chatSession.save();

        res.json({
            answer,
            sessionId: chatSession.sessionId,
            messageCount: chatSession.metadata.totalMessages
        });
    } catch (err) {
        console.error('Assistant error:', err);

        // Handle specific errors
        let errorMessage = 'Error en el asistente';
        let statusCode = 500;

        if (err.message && err.message.includes('API key')) {
            errorMessage = 'Error de configuración del asistente';
            statusCode = 500;
        } else if (err.message && err.message.includes('quota')) {
            errorMessage = 'Límite de consultas alcanzado. Intenta más tarde';
            statusCode = 429;
        } else if (err.message && err.message.includes('safety')) {
            errorMessage = 'La consulta contiene contenido inapropiado';
            statusCode = 400;
        } else if (err.message && err.message.includes('timeout')) {
            errorMessage = 'La consulta tardó demasiado. Intenta nuevamente';
            statusCode = 408;
        } else if (err.status === 400) {
            errorMessage = 'Solicitud inválida para el asistente';
            statusCode = 400;
        } else if (err.status === 401 || err.status === 403) {
            errorMessage = 'Error de autenticación con el servicio de IA';
            statusCode = 500;
        }

        res.status(statusCode).json({ error: errorMessage });
    }
};

/**
 * Get user's chat history
 */
exports.getChatHistory = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const limit = parseInt(req.query.limit) || 10;

        const chatHistory = await ChatHistory.getRecentChats(userId, limit);

        res.json({ chatHistory });
    } catch (err) {
        console.error('Get chat history error:', err);
        res.status(500).json({ error: 'Error al obtener historial de chat' });
    }
};

/**
 * Get specific chat session
 */
exports.getChatSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.session.user._id;

        const chatSession = await ChatHistory.getChatBySession(sessionId, userId);

        if (!chatSession) {
            return res.status(404).json({ error: 'Sesión de chat no encontrada' });
        }

        res.json({ chatSession });
    } catch (err) {
        console.error('Get chat session error:', err);
        res.status(500).json({ error: 'Error al obtener sesión de chat' });
    }
};

/**
 * Delete chat session
 */
exports.deleteChatSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.session.user._id;

        const result = await ChatHistory.deleteOne({ sessionId, userId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Sesión de chat no encontrada' });
        }

        res.json({ success: true, message: 'Sesión de chat eliminada' });
    } catch (err) {
        console.error('Delete chat session error:', err);
        res.status(500).json({ error: 'Error al eliminar sesión de chat' });
    }
};

/**
 * Clear all user chat history
 */
exports.clearChatHistory = async (req, res) => {
    try {
        const userId = req.session.user._id;

        const result = await ChatHistory.deleteMany({ userId });

        res.json({
            success: true,
            message: `${result.deletedCount} sesiones de chat eliminadas`
        });
    } catch (err) {
        console.error('Clear chat history error:', err);
        res.status(500).json({ error: 'Error al limpiar historial de chat' });
    }
};

/**
 * Get all chat history for admin dashboard
 */
exports.getAllChatHistory = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Build query filters
        const query = {};
        if (req.query.username) {
            const user = await User.findOne({ username: new RegExp(req.query.username, 'i') });
            if (user) {
                query.userId = user._id;
            } else {
                return res.json({ success: true, chats: [], totalPages: 0, currentPage: page });
            }
        }

        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) {
                query.createdAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                query.createdAt.$lte = new Date(req.query.endDate);
            }
        }

        // Get total count for pagination
        const totalChats = await ChatHistory.countDocuments(query);
        const totalPages = Math.ceil(totalChats / limit);

        // Get chat history with user info
        const chats = await ChatHistory.find(query)
            .populate('userId', 'username')
            .sort({ 'metadata.lastActivity': -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.json({
            success: true,
            chats,
            totalPages,
            currentPage: page,
            totalChats
        });
    } catch (err) {
        console.error('Get all chat history error:', err);
        res.status(500).json({ error: 'Error al obtener historial de chats' });
    }
};