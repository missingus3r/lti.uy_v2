// SEO middleware for optimizing HTTP headers
const seoMiddleware = (req, res, next) => {
    // Set security headers that also help with SEO
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "connect-src 'self' https:",
        "frame-src 'self' https:",
        "object-src 'none'",
        "base-uri 'self'"
    ].join('; '));
    
    // Cache control for different types of content
    const path = req.path;
    const isStaticAsset = /\.(css|js|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$/i.test(path);
    const isApiRoute = path.startsWith('/api/');
    const isAuthRoute = path.startsWith('/auth/');
    
    if (isStaticAsset) {
        // Cache static assets for 1 year
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (path === '/sitemap.xml' || path === '/robots.txt') {
        // Cache SEO files for 1 hour
        res.setHeader('Cache-Control', 'public, max-age=3600');
    } else if (isApiRoute || isAuthRoute) {
        // Don't cache API or auth routes
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    } else {
        // Cache public pages for 15 minutes
        res.setHeader('Cache-Control', 'public, max-age=900');
    }
    
    // Add ETag for better caching
    if (!isApiRoute && !isAuthRoute) {
        res.setHeader('ETag', `"${Date.now()}"`);
    }
    
    // Compression hint
    res.setHeader('Vary', 'Accept-Encoding');
    
    // HSTS for HTTPS (only in production)
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    next();
};

// Middleware to add canonical URLs dynamically
const canonicalMiddleware = (req, res, next) => {
    const baseUrl = process.env.SITE_URL || 'https://lti.uy';
    res.locals.canonicalUrl = baseUrl + req.path;
    res.locals.currentPath = req.path;
    next();
};

// Middleware to optimize responses for search engines
const searchEngineOptimization = (req, res, next) => {
    const userAgent = req.get('User-Agent') || '';
    const isBot = /bot|crawler|spider|crawling/i.test(userAgent);
    
    if (isBot) {
        // Disable session for bots to improve performance
        req.session = null;
        
        // Add specific headers for search engines
        res.setHeader('X-Robots-Tag', 'index, follow');
        
        // Prioritize content delivery for bots
        res.setHeader('Cache-Control', 'public, max-age=3600');
    }
    
    next();
};

// Middleware to handle 404s with proper SEO
const notFoundHandler = (req, res, next) => {
    if (req.originalUrl === '/favicon.ico') {
        return res.status(204).end();
    }
    
    // Check if it's a missing page that should return 404
    if (!res.headersSent) {
        res.status(404);
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        return res.render('404', {
            url: req.originalUrl,
            title: 'Página no encontrada - LTI.UY'
        });
    }
    
    next();
};

module.exports = {
    seoMiddleware,
    canonicalMiddleware,
    searchEngineOptimization,
    notFoundHandler
};