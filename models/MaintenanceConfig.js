const mongoose = require('mongoose');

const maintenanceConfigSchema = new mongoose.Schema({
    isMaintenanceMode: {
        type: Boolean,
        default: false,
        required: true
    },
    maintenanceMessage: {
        type: String,
        default: 'El sistema se encuentra en mantenimiento. Por favor, intenta más tarde.',
        required: true
    },
    enabledAt: {
        type: Date,
        default: null
    },
    enabledBy: {
        type: String,
        default: null
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Update lastUpdated on save
maintenanceConfigSchema.pre('save', function(next) {
    this.lastUpdated = new Date();
    next();
});

// Static method to get current maintenance status
maintenanceConfigSchema.statics.getStatus = async function() {
    let config = await this.findOne();
    
    // Create default config if it doesn't exist
    if (!config) {
        config = await this.create({
            isMaintenanceMode: false,
            maintenanceMessage: 'El sistema se encuentra en mantenimiento. Por favor, intenta más tarde.'
        });
    }
    
    return config;
};

// Static method to toggle maintenance mode
maintenanceConfigSchema.statics.toggleMaintenanceMode = async function(enabled, message, adminUser) {
    let config = await this.getStatus();
    
    config.isMaintenanceMode = enabled;
    if (message) {
        config.maintenanceMessage = message;
    }
    
    if (enabled) {
        config.enabledAt = new Date();
        config.enabledBy = adminUser;
    } else {
        config.enabledAt = null;
        config.enabledBy = null;
    }
    
    await config.save();
    return config;
};

const MaintenanceConfig = mongoose.model('MaintenanceConfig', maintenanceConfigSchema);

module.exports = MaintenanceConfig;