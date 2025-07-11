const express = require('express');
const router = express.Router();

// Generate dynamic sitemap
router.get('/sitemap.xml', (req, res) => {
    const baseUrl = process.env.SITE_URL || 'https://lti.uy';
    
    // Define all public pages with their metadata
    const pages = [
        {
            url: '/',
            changefreq: 'weekly',
            priority: 1.0,
            lastmod: new Date().toISOString()
        },
        {
            url: '/login',
            changefreq: 'monthly',
            priority: 0.8,
            lastmod: new Date().toISOString()
        },
        {
            url: '/news',
            changefreq: 'daily',
            priority: 0.7,
            lastmod: new Date().toISOString()
        },
        {
            url: '/terms',
            changefreq: 'yearly',
            priority: 0.3,
            lastmod: new Date().toISOString()
        }
    ];
    
    // Generate XML sitemap
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
    xml += '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
    xml += '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9\n';
    xml += '        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n';
    
    pages.forEach(page => {
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
        xml += `    <lastmod>${page.lastmod}</lastmod>\n`;
        xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
        xml += `    <priority>${page.priority}</priority>\n`;
        xml += '  </url>\n';
    });
    
    xml += '</urlset>';
    
    res.header('Content-Type', 'application/xml');
    res.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(xml);
});

// Sitemap index for multiple sitemaps (future expansion)
router.get('/sitemap-index.xml', (req, res) => {
    const baseUrl = process.env.SITE_URL || 'https://lti.uy';
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    xml += '  <sitemap>\n';
    xml += `    <loc>${baseUrl}/sitemap.xml</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
    xml += '  </sitemap>\n';
    xml += '</sitemapindex>';
    
    res.header('Content-Type', 'application/xml');
    res.header('Cache-Control', 'public, max-age=3600');
    res.send(xml);
});

module.exports = router;