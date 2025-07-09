const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    userHash: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    lastDataFetch: {
        type: Date,
        default: null
    },
    manualRefreshCount: {
        type: Number,
        default: 0
    },
    manualRefreshResetDate: {
        type: Date,
        default: Date.now
    },
    selectedPlan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CareerPlan',
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Generate a unique hash for the user based on username and creation time
userSchema.methods.generateUserHash = function() {
    const data = `${this.username}-${this.createdAt.getTime()}-${Math.random()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
};

// Check if data needs to be fetched (once per day)
userSchema.methods.needsDataUpdate = function() {   
    if (!this.lastDataFetch) {
        console.log(`  - Returning true (no previous fetch)`);
        return true;
    }
    
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    return this.lastDataFetch < oneDayAgo;
};

// Check if manual refresh is allowed (max 2 times per 24h)
userSchema.methods.canManualRefresh = function() {
    const now = new Date();
    const resetTime = new Date(this.manualRefreshResetDate);
    resetTime.setDate(resetTime.getDate() + 1);
    
    // Reset counter if 24h have passed
    if (now > resetTime) {
        this.manualRefreshCount = 0;
        this.manualRefreshResetDate = now;
    }
    
    return this.manualRefreshCount < 2;
};

// Increment manual refresh count
userSchema.methods.incrementManualRefresh = function() {
    const now = new Date();
    const resetTime = new Date(this.manualRefreshResetDate);
    resetTime.setDate(resetTime.getDate() + 1);
    
    // Reset counter if 24h have passed
    if (now > resetTime) {
        this.manualRefreshCount = 1;
        this.manualRefreshResetDate = now;
    } else {
        this.manualRefreshCount += 1;
    }
};


const User = mongoose.model('User', userSchema);

module.exports = User;