const mongoose = require('mongoose');

/**
 * ChatHistory model for storing AI assistant conversations
 */
const ChatHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    sessionId: {
        type: String,
        required: true,
        index: true
    },
    messages: [{
        role: {
            type: String,
            enum: ['user', 'assistant'],
            required: true
        },
        content: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    metadata: {
        model: {
            type: String,
            default: 'gemini-2.0-flash-exp'
        },
        totalMessages: {
            type: Number,
            default: 0
        },
        lastActivity: {
            type: Date,
            default: Date.now
        }
    }
}, {
    timestamps: true
});

// Index for efficient queries
ChatHistorySchema.index({ userId: 1, 'metadata.lastActivity': -1 });
ChatHistorySchema.index({ sessionId: 1 });

// Update metadata before saving
ChatHistorySchema.pre('save', function(next) {
    this.metadata.totalMessages = this.messages.length;
    this.metadata.lastActivity = new Date();
    next();
});

// Static method to create new chat session
ChatHistorySchema.statics.createSession = function(userId) {
    const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return new this({
        userId,
        sessionId,
        messages: [],
        metadata: {
            totalMessages: 0,
            lastActivity: new Date()
        }
    });
};

// Instance method to add message
ChatHistorySchema.methods.addMessage = function(role, content) {
    this.messages.push({
        role,
        content,
        timestamp: new Date()
    });
    this.metadata.totalMessages = this.messages.length;
    this.metadata.lastActivity = new Date();
};

// Static method to get user's recent chats
ChatHistorySchema.statics.getRecentChats = function(userId, limit = 10) {
    return this.find({ userId })
        .sort({ 'metadata.lastActivity': -1 })
        .limit(limit)
        .select('sessionId metadata.lastActivity metadata.totalMessages messages')
        .lean();
};

// Static method to get chat by session
ChatHistorySchema.statics.getChatBySession = function(sessionId, userId) {
    return this.findOne({ sessionId, userId }).lean();
};

module.exports = mongoose.model('ChatHistory', ChatHistorySchema);