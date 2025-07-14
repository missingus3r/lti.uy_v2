const mongoose = require('mongoose');

const securityConfigSchema = new mongoose.Schema({
    maxLoginAttempts: {
        type: Number,
        default: 3,
        min: 1,
        max: 10,
        required: true
    },
    blockDurationMinutes: {
        type: Number,
        default: 15,
        min: 5,
        max: 1440, // Max 24 hours
        required: true
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    updatedBy: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Update lastUpdated on save
securityConfigSchema.pre('save', function(next) {
    this.lastUpdated = new Date();
    next();
});

// Static method to get current security config
securityConfigSchema.statics.getConfig = async function() {
    let config = await this.findOne();
    
    // Create default config if it doesn't exist
    if (!config) {
        config = await this.create({
            maxLoginAttempts: 3,
            blockDurationMinutes: 15
        });
    }
    
    return config;
};

// Static method to update security config
securityConfigSchema.statics.updateConfig = async function(updates, adminUser) {
    let config = await this.getConfig();
    
    if (updates.maxLoginAttempts !== undefined) {
        config.maxLoginAttempts = Math.min(Math.max(updates.maxLoginAttempts, 1), 10);
    }
    
    if (updates.blockDurationMinutes !== undefined) {
        config.blockDurationMinutes = Math.min(Math.max(updates.blockDurationMinutes, 5), 1440);
    }
    
    config.updatedBy = adminUser;
    
    await config.save();
    return config;
};

const SecurityConfig = mongoose.model('SecurityConfig', securityConfigSchema);

module.exports = SecurityConfig;