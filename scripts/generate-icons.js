const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Source icon path
const sourceIcon = path.join(__dirname, '../public/images/icon_lti_v2.png');
const iconsDir = path.join(__dirname, '../public/icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// Icon sizes needed for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Generate icons
async function generateIcons() {
    try {
        // Check if source icon exists
        if (!fs.existsSync(sourceIcon)) {
            console.error('Source icon not found at:', sourceIcon);
            console.log('Creating placeholder icons...');
            
            // Create placeholder icons with text
            for (const size of sizes) {
                await sharp({
                    create: {
                        width: size,
                        height: size,
                        channels: 4,
                        background: { r: 25, g: 118, b: 210, alpha: 1 } // UTEC blue color
                    }
                })
                .composite([{
                    input: Buffer.from(`
                        <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
                            <rect width="${size}" height="${size}" fill="#1976d2"/>
                            <text x="50%" y="50%" text-anchor="middle" dy=".3em" 
                                  fill="white" font-family="Arial" font-weight="bold" 
                                  font-size="${Math.floor(size * 0.3)}">
                                LTI
                            </text>
                        </svg>
                    `),
                    top: 0,
                    left: 0
                }])
                .png()
                .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
                
                console.log(`✓ Created placeholder icon: icon-${size}x${size}.png`);
            }
            return;
        }
        
        // Generate icons from source
        for (const size of sizes) {
            await sharp(sourceIcon)
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 0 }
                })
                .png()
                .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
            
            console.log(`✓ Generated icon: icon-${size}x${size}.png`);
        }
        
        console.log('\n✨ All icons generated successfully!');
        
    } catch (error) {
        console.error('Error generating icons:', error);
        process.exit(1);
    }
}

// Run the generator
generateIcons();