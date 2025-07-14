const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['pageVisit', 'loginAttempt', 'loginSuccess', 'loginFailure', 'dataUpdate', 'userBlocked', 'userUnblocked']
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  ip: {
    type: String,
    required: true
  },
  page: {
    type: String
  },
  username: {
    type: String
  },
  success: {
    type: Boolean
  },
  details: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true
});

// Índices para mejorar rendimiento de consultas
logSchema.index({ timestamp: -1 });
logSchema.index({ type: 1 });
logSchema.index({ username: 1 });

// Método estático para obtener logs paginados
logSchema.statics.getLogs = async function(filters = {}, page = 1, limit = 50) {
  const query = {};
  
  if (filters.type) query.type = filters.type;
  if (filters.username) query.username = new RegExp(filters.username, 'i');
  if (filters.ip) query.ip = new RegExp(filters.ip, 'i');
  if (filters.startDate || filters.endDate) {
    query.timestamp = {};
    if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
    if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
  }
  
  const skip = (page - 1) * limit;
  
  const logs = await this.find(query)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
    
  const total = await this.countDocuments(query);
  
  return {
    logs,
    total,
    page,
    pages: Math.ceil(total / limit)
  };
};

// Método estático para obtener estadísticas
logSchema.statics.getStats = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const [
    totalVisits,
    todayVisits,
    totalLogins,
    failedLogins,
    uniqueVisitors
  ] = await Promise.all([
    this.countDocuments({ type: 'pageVisit' }),
    this.countDocuments({ type: 'pageVisit', timestamp: { $gte: today } }),
    this.countDocuments({ type: 'loginSuccess' }),
    this.countDocuments({ type: 'loginFailure' }),
    this.distinct('ip').then(ips => ips.length)
  ]);
  
  return {
    totalVisits,
    todayVisits,
    totalLogins,
    failedLogins,
    uniqueVisitors
  };
};

const Log = mongoose.model('Log', logSchema);

module.exports = Log;