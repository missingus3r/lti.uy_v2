const mongoose = require('mongoose');

const loginAttemptSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        index: true
    },
    failedAttempts: {
        type: Number,
        default: 0
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    blockedAt: {
        type: Date,
        default: null
    },
    blockExpiresAt: {
        type: Date,
        default: null
    },
    lastAttemptAt: {
        type: Date,
        default: Date.now
    },
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Índices para optimizar consultas
loginAttemptSchema.index({ username: 1, isBlocked: 1 });
loginAttemptSchema.index({ blockExpiresAt: 1 });
loginAttemptSchema.index({ lastAttemptAt: 1 });

// Método para incrementar intentos fallidos
loginAttemptSchema.methods.incrementFailedAttempts = function() {
    this.failedAttempts += 1;
    this.lastAttemptAt = new Date();
};

// Método para resetear intentos fallidos (login exitoso)
loginAttemptSchema.methods.resetFailedAttempts = function() {
    this.failedAttempts = 0;
    this.isBlocked = false;
    this.blockedAt = null;
    this.blockExpiresAt = null;
    this.lastAttemptAt = new Date();
};

// Método para bloquear usuario por 15 minutos
loginAttemptSchema.methods.blockUser = function() {
    const now = new Date();
    this.isBlocked = true;
    this.blockedAt = now;
    this.blockExpiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutos
    this.lastAttemptAt = now;
};

// Método para desbloquear usuario manualmente
loginAttemptSchema.methods.unblockUser = function() {
    this.isBlocked = false;
    this.blockedAt = null;
    this.blockExpiresAt = null;
    this.failedAttempts = 0;
    this.lastAttemptAt = new Date();
};

// Método para verificar si el usuario está actualmente bloqueado
loginAttemptSchema.methods.isCurrentlyBlocked = function() {
    if (!this.isBlocked) return false;
    
    const now = new Date();
    
    // Verificar si el bloqueo ha expirado
    if (this.blockExpiresAt && now > this.blockExpiresAt) {
        // Auto-desbloquear si el tiempo ha expirado
        this.isBlocked = false;
        this.blockedAt = null;
        this.blockExpiresAt = null;
        this.failedAttempts = 0;
        return false;
    }
    
    return true;
};

// Método para obtener tiempo restante de bloqueo en minutos
loginAttemptSchema.methods.getRemainingBlockTime = function() {
    if (!this.isCurrentlyBlocked()) return 0;
    
    const now = new Date();
    const remaining = Math.ceil((this.blockExpiresAt - now) / (1000 * 60));
    return Math.max(0, remaining);
};

// Método para obtener intentos restantes antes del bloqueo
loginAttemptSchema.methods.getRemainingAttempts = function() {
    return Math.max(0, 3 - this.failedAttempts);
};

// Método estático para encontrar o crear un registro de intento de login
loginAttemptSchema.statics.findOrCreate = async function(username, ipAddress, userAgent) {
    let attempt = await this.findOne({ username });
    
    if (!attempt) {
        attempt = new this({
            username,
            ipAddress,
            userAgent,
            failedAttempts: 0,
            isBlocked: false
        });
        await attempt.save();
    } else {
        // Actualizar IP y userAgent si han cambiado
        attempt.ipAddress = ipAddress;
        attempt.userAgent = userAgent;
        
        // Verificar si el bloqueo ha expirado
        if (attempt.isCurrentlyBlocked()) {
            // El método isCurrentlyBlocked() ya actualiza el estado si ha expirado
            await attempt.save();
        }
    }
    
    return attempt;
};

// Método estático para limpiar intentos antiguos (opcional, para mantenimiento)
loginAttemptSchema.statics.cleanupOldAttempts = async function() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    await this.deleteMany({
        lastAttemptAt: { $lt: thirtyDaysAgo },
        isBlocked: false,
        failedAttempts: 0
    });
};

const LoginAttempt = mongoose.model('LoginAttempt', loginAttemptSchema);

module.exports = LoginAttempt;