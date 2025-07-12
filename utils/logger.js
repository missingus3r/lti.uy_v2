const Log = require('../models/Log');

// Función auxiliar para obtener IP real
const getRealIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         req.ip;
};

// Middleware para logging de visitas a páginas
const logPageVisit = async (req, res, next) => {
  try {
    // Solo loguear GET requests a páginas específicas
    if (req.method === 'GET') {
      const pagesToLog = ['/', '/login', '/terms', '/privacy'];
      const currentPath = req.path;
      
      if (pagesToLog.includes(currentPath)) {
        await Log.create({
          type: 'pageVisit',
          ip: getRealIP(req),
          page: currentPath,
          userAgent: req.headers['user-agent'],
          details: `Visita a ${currentPath}`
        });
      }
    }
  } catch (error) {
    console.error('Error logging page visit:', error);
  }
  next();
};

// Función para loguear intentos de login
const logLoginAttempt = async (username, ip, success, userAgent) => {
  try {
    await Log.create({
      type: success ? 'loginSuccess' : 'loginFailure',
      ip: ip,
      username: username,
      success: success,
      userAgent: userAgent,
      details: success ? 'Login exitoso' : 'Login fallido'
    });
  } catch (error) {
    console.error('Error logging login attempt:', error);
  }
};

// Función para loguear actualizaciones de datos
const logDataUpdate = async (username, ip, details) => {
  try {
    await Log.create({
      type: 'dataUpdate',
      ip: ip,
      username: username,
      details: details
    });
  } catch (error) {
    console.error('Error logging data update:', error);
  }
};

// Función para loguear bloqueo de usuario
const logUserBlocked = async (username, ip, details) => {
  try {
    await Log.create({
      type: 'userBlocked',
      ip: ip,
      username: username,
      details: details
    });
  } catch (error) {
    console.error('Error logging user blocked:', error);
  }
};

// Función para loguear desbloqueo de usuario
const logUserUnblocked = async (username, ip, details) => {
  try {
    await Log.create({
      type: 'userUnblocked',
      ip: ip,
      username: username,
      details: details
    });
  } catch (error) {
    console.error('Error logging user unblocked:', error);
  }
};

// Función para loguear cambios en modo mantenimiento
const logMaintenanceToggle = async (username, ip, enabled, message) => {
  try {
    await Log.create({
      type: 'maintenanceToggle',
      ip: ip,
      username: username,
      details: `Modo mantenimiento ${enabled ? 'activado' : 'desactivado'}${message ? ` - Mensaje: ${message}` : ''}`
    });
  } catch (error) {
    console.error('Error logging maintenance toggle:', error);
  }
};

module.exports = {
  logPageVisit,
  logLoginAttempt,
  logDataUpdate,
  logUserBlocked,
  logUserUnblocked,
  logMaintenanceToggle,
  getRealIP
};