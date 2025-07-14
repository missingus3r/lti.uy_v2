const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();
const connectDB = require('./config/database');

// Connect to MongoDB
connectDB().catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Azure App Service
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(session({
  secret: process.env.SESSION_SECRET || 'lti-uy-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  name: 'lti.session',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 2, // 2 hours
    sameSite: 'lax'
  }
}));

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const assistantRoutes = require('./routes/assistant');
const sitemapRoutes = require('./routes/sitemap');
const { logPageVisit } = require('./utils/logger');
const { seoMiddleware, canonicalMiddleware, searchEngineOptimization, notFoundHandler } = require('./middleware/seo');
const { checkMaintenanceForLogin } = require('./middleware/maintenanceMode');

// Apply SEO middleware first
app.use(seoMiddleware);
app.use(canonicalMiddleware);
app.use(searchEngineOptimization);

// Apply logging middleware to all routes
app.use(logPageVisit);

// SEO routes (before authentication routes)
app.use(sitemapRoutes);

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use(assistantRoutes);

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/login', checkMaintenanceForLogin, (req, res) => {
  if (req.session.authenticated) {
    if (req.session.isAdmin) {
      return res.redirect('/admin/dashboard');
    }
    return res.redirect('/welcome');
  }
  res.render('login');
});

app.get('/welcome', async (req, res) => {
  if (!req.session || !req.session.authenticated || !req.session.user || !req.session.userHash) {
    return res.redirect('/login');
  }
  
  // Set cache headers to prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Get user data quality warning info and academic progress
  let dataQualityWarning = false;
  let dataQualityReason = null;
  let academicProgress = null;
  
  try {
    const User = require('./models/User');
    const AcademicProgress = require('./models/AcademicProgress');
    
    const user = await User.findOne({ userHash: req.session.userHash });
    if (user) {
      dataQualityWarning = user.dataQualityWarning || false;
      dataQualityReason = user.dataQualityReason || null;
    }
    
    academicProgress = await AcademicProgress.findOne({ userHash: req.session.userHash });
  } catch (error) {
    console.error('Error getting user data quality info:', error);
  }
  
  res.render('welcome', { 
    user: req.session.user.username,
    session: req.session,
    dataQualityWarning: dataQualityWarning,
    dataQualityReason: dataQualityReason,
    academicProgress: academicProgress
  });
});

app.get('/terms', (req, res) => {
  res.render('terms');
});

app.get('/news', (req, res) => {
  res.render('news');
});

app.get('/logout', (req, res) => {
  console.log('Logout requested for user:', req.session.user ? req.session.user.username : 'unknown');
  
  // Clear all session data first
  req.session.authenticated = false;
  req.session.isAdmin = false;
  req.session.user = null;
  req.session.userHash = null;
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).send('Error al cerrar sesión');
    }
    
    // Clear all possible session cookies
    res.clearCookie('lti.session', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    // Also clear default session cookie name just in case
    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    // Clear any other potential cookies
    res.clearCookie('session', { path: '/' });
    res.clearCookie('sess', { path: '/' });
    
    // Set cache-control headers to prevent caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    console.log('Session destroyed and all cookies cleared');
    res.redirect('/');
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'LTI.UY',
    version: '1.0.0'
  });
});

// Maintenance check endpoint
app.get('/api/maintenance-check', async (req, res) => {
  try {
    const MaintenanceConfig = require('./models/MaintenanceConfig');
    const config = await MaintenanceConfig.getStatus();
    
    res.json({
      success: true,
      maintenance: config.isMaintenanceMode,
      message: config.maintenanceMessage
    });
  } catch (error) {
    console.error('Error checking maintenance status:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar estado de mantenimiento'
    });
  }
});

// Test error page (remove in production)
app.get('/test-error', (req, res, next) => {
  const error = new Error('Este es un error de prueba para ver la página de error');
  error.status = 500;
  next(error);
});

// 404 handler - must be after all other routes
app.use(notFoundHandler);

// Error handler - must be last
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Set default error status if not set
  if (!err.status) {
    err.status = 500;
  }
  
  res.status(err.status).render('error', { 
    error: err,
    title: 'Error - LTI.UY'
  });
});

app.listen(PORT, () => {
  console.log(`LTI.UY server running on http://localhost:${PORT}`);
});