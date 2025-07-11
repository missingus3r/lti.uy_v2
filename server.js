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

// Service Worker - serve with correct MIME type and no-cache headers
app.get('/service-worker.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'service-worker.js'));
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'lti-uy-secret-key-2024',
  resave: false,
  saveUninitialized: false,
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

app.get('/login', (req, res) => {
  if (req.session.authenticated) {
    if (req.session.isAdmin) {
      return res.redirect('/admin/dashboard');
    }
    return res.redirect('/welcome');
  }
  res.render('login');
});

app.get('/welcome', (req, res) => {
  if (!req.session.authenticated) {
    return res.redirect('/login');
  }
  res.render('welcome', { 
    user: req.session.user.username,
    session: req.session 
  });
});

app.get('/terms', (req, res) => {
  res.render('terms');
});

app.get('/news', (req, res) => {
  res.render('news');
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
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