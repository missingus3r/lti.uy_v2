// Middleware para verificar si el usuario es admin
const isAdmin = (req, res, next) => {
  if (req.session && req.session.authenticated && req.session.isAdmin && req.session.user) {
    return next();
  }
  
  // Si no es admin o no está autenticado, redirigir al login normal
  res.redirect('/login');
};

// Middleware para verificar si ya está autenticado como admin
const isAdminAuthenticated = (req, res, next) => {
  if (req.session && req.session.authenticated && req.session.isAdmin && req.session.user) {
    return res.redirect('/admin/dashboard');
  }
  next();
};

module.exports = {
  isAdmin,
  isAdminAuthenticated
};