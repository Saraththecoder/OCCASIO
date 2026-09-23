import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';
import { cleanText } from './ai.js';

// Local fonts directory
const fontDir = path.resolve('assets', 'fonts');
if (!fs.existsSync(fontDir)) {
  fs.mkdirSync(fontDir, { recursive: true });
}

const fontPath = path.join(fontDir, 'Roboto-Regular.ttf');
let cachedFontBuffer = null;

/**
 * Load or fetch TTF font for Satori renderer
 */
async function getFontBuffer() {
  if (cachedFontBuffer) return cachedFontBuffer;

  if (fs.existsSync(fontPath)) {
    cachedFontBuffer = fs.readFileSync(fontPath);
    return cachedFontBuffer;
  }

  console.log('⏳ [Poster] Fetching Roboto font for Satori rendering...');
  try {
    const fontUrl = 'https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-400-normal.ttf';
    const res = await fetch(fontUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    cachedFontBuffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(fontPath, cachedFontBuffer);
    return cachedFontBuffer;
  } catch (err) {
    console.warn('⚠️ [Poster] Font download failed, fetching secondary CDN:', err.message);
    const backupUrl = 'https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Regular.ttf';
    const res = await fetch(backupUrl);
    const arrayBuffer = await res.arrayBuffer();
    cachedFontBuffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(fontPath, cachedFontBuffer);
    return cachedFontBuffer;
  }
}

// 8 Dynamic Color Palettes for endless visual variety across thousands of shops
const DYNAMIC_PALETTES = [
  { name: 'Gold Maroon', bg: 'linear-gradient(145deg, #4A0E17 0%, #1F0307 100%)', border: '#D4AF37', accent: '#FFD700', badgeBg: '#FFD700', badgeText: '#4A0E17' },
  { name: 'Midnight Neon', bg: 'linear-gradient(135deg, #0F2027 0%, #203A43 50%, #2C5364 100%)', border: '#00FFF0', accent: '#00FFF0', badgeBg: '#00E676', badgeText: '#000000' },
  { name: 'Sunset Saffron', bg: 'linear-gradient(135deg, #FF4E00 0%, #E60000 60%, #800020 100%)', border: '#FFD700', accent: '#FFD700', badgeBg: '#FFD700', badgeText: '#800020' },
  { name: 'Royal Emerald', bg: 'linear-gradient(135deg, #053b26 0%, #001e12 100%)', border: '#50E3C2', accent: '#50E3C2', badgeBg: '#F5A623', badgeText: '#000000' },
  { name: 'Electric Violet', bg: 'linear-gradient(135deg, #2B0938 0%, #5C1D8F 100%)', border: '#E242E6', accent: '#E242E6', badgeBg: '#00FFFF', badgeText: '#000000' },
  { name: 'Festival Crimson', bg: 'linear-gradient(135deg, #833AB4 0%, #FD1D1D 50%, #FCB045 100%)', border: '#FFFB00', accent: '#FFFB00', badgeBg: '#00E676', badgeText: '#000000' },
  { name: 'Luxury Onyx', bg: 'linear-gradient(135deg, #141414 0%, #282828 100%)', border: '#E5A93C', accent: '#E5A93C', badgeBg: '#E5A93C', badgeText: '#000000' },
  { name: 'Ocean Cyan', bg: 'linear-gradient(135deg, #005C97 0%, #363795 100%)', border: '#00E5FF', accent: '#00E5FF', badgeBg: '#FF4081', badgeText: '#FFFFFF' },
];

/**
 * Generate a deterministic hash number from shop name + occasion name
 */
function getHashSeed(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Main poster generation entry point with 4 dynamic layout styles
 */
export async function generatePosterPNG({
  shopName = 'Occasio Store',
  category = 'restaurant',
  logoUrl = null,
  occasionName = 'Special Occasion',
  discountProduct = null,
  discountAmount = null,
  productPhotoUrl = null,
  captionText = 'Wishing you joy and celebration!',
  layoutStyle = null, // Can be 1, 2, 3, 4 or randomly chosen
}) {
  console.log(`🖼️ [Poster] Rendering poster for "${shopName}" (${occasionName})`);
  
  const fontData = await getFontBuffer();
  const isDiscount = Boolean(discountProduct && discountAmount);
  const productImage = productPhotoUrl || DEFAULT_PRODUCT_IMAGE;
  const safeCaption = cleanText(captionText);
  const safeShopName = cleanText(shopName);
  const safeOccasion = cleanText(occasionName);
  const safeProduct = cleanText(discountProduct || '');

  // Randomly select one of 4 design layouts if not specified
  const chosenLayout = layoutStyle || Math.floor(Math.random() * 4) + 1;
  console.log(`🎨 Using Poster Layout Theme #${chosenLayout}`);

  let markup;

  if (!isDiscount) {
    markup = renderGreetingLayout({ safeShopName, category, logoUrl, safeOccasion, safeCaption });
  } else {
    switch (chosenLayout) {
      case 1:
        markup = renderLuxuryGoldLayout({ safeShopName, category, logoUrl, safeOccasion, safeProduct, discountAmount, productImage, safeCaption });
        break;
      case 2:
        markup = renderGlassmorphismLayout({ safeShopName, category, logoUrl, safeOccasion, safeProduct, discountAmount, productImage, safeCaption });
        break;
      case 3:
        markup = renderSplitBannerLayout({ safeShopName, category, logoUrl, safeOccasion, safeProduct, discountAmount, productImage, safeCaption });
        break;
      case 4:
      default:
        markup = renderSunsetVibrantLayout({ safeShopName, category, logoUrl, safeOccasion, safeProduct, discountAmount, productImage, safeCaption });
        break;
    }
  }

  // Convert SVG using Satori
  const svg = await satori(markup, {
    width: 1080,
    height: 1080,
    fonts: [{ name: 'Roboto', data: fontData, weight: 400, style: 'normal' }],
  });

  // Convert SVG to PNG using Resvg
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  console.log(`✅ [Poster] Successfully rendered PNG (${pngBuffer.length} bytes)`);
  return pngBuffer;
}

/* ==========================================================================
   LAYOUT 1: Luxury Festive Frame (Gold & Maroon)
   ========================================================================== */
function renderLuxuryGoldLayout({ safeShopName, category, logoUrl, safeOccasion, safeProduct, discountAmount, productImage, safeCaption }) {
  return {
    type: 'div',
    props: {
      style: {
        height: '1080px',
        width: '1080px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '50px',
        background: 'linear-gradient(145deg, #4A0E17 0%, #1F0307 100%)',
        fontFamily: 'Roboto',
        color: '#FFFFFF',
        boxSizing: 'border-box',
        border: '14px solid #D4AF37',
      },
      children: [
        // Header
        renderHeaderBlock(safeShopName, category, logoUrl, '#D4AF37'),
        
        // Body Frame
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              marginTop: '10px',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    width: '560px',
                    height: '420px',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    display: 'flex',
                    border: '5px solid #D4AF37',
                    boxShadow: '0 15px 35px rgba(0,0,0,0.7)',
                  },
                  children: [
                    { type: 'img', props: { src: productImage, style: { width: '100%', height: '100%', objectFit: 'cover' } } },
                  ],
                },
              },
              // Badge
              {
                type: 'div',
                props: {
                  style: {
                    position: 'absolute',
                    top: '-25px',
                    right: '-20px',
                    background: '#FFD700',
                    color: '#4A0E17',
                    padding: '14px 30px',
                    borderRadius: '40px',
                    fontSize: '36px',
                    fontWeight: 'bold',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
                  },
                  children: `${discountAmount}% OFF`,
                },
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: '46px', fontWeight: 'bold', color: '#FFD700', marginTop: '20px', textAlign: 'center' },
                  children: safeProduct,
                },
              },
            ],
          },
        },
        // Footer Caption
        renderCaptionFooter(safeCaption, `Happy ${safeOccasion}!`, '#D4AF37'),
      ],
    },
  };
}

/* ==========================================================================
   LAYOUT 2: Modern Dark Glassmorphism (Midnight Cyan & Neon)
   ========================================================================== */
function renderGlassmorphismLayout({ safeShopName, category, logoUrl, safeOccasion, safeProduct, discountAmount, productImage, safeCaption }) {
  return {
    type: 'div',
    props: {
      style: {
        height: '1080px',
        width: '1080px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '60px',
        background: 'linear-gradient(135deg, #0F2027 0%, #203A43 50%, #2C5364 100%)',
        fontFamily: 'Roboto',
        color: '#FFFFFF',
        boxSizing: 'border-box',
      },
      children: [
        renderHeaderBlock(safeShopName, category, logoUrl, '#00FFF0'),
        
        // Glass Card
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '900px',
              padding: '35px',
              borderRadius: '30px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '2px solid rgba(255, 255, 255, 0.18)',
              position: 'relative',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    width: '680px',
                    height: '360px',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    display: 'flex',
                  },
                  children: [{ type: 'img', props: { src: productImage, style: { width: '100%', height: '100%', objectFit: 'cover' } } }],
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    position: 'absolute',
                    top: '20px',
                    left: '40px',
                    background: '#00E676',
                    color: '#000000',
                    padding: '12px 26px',
                    borderRadius: '30px',
                    fontSize: '32px',
                    fontWeight: 'bold',
                  },
                  children: `SPECIAL ${discountAmount}% DISCOUNT`,
                },
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: '44px', fontWeight: 'bold', color: '#00FFF0', marginTop: '20px' },
                  children: safeProduct,
                },
              },
            ],
          },
        },
        renderCaptionFooter(safeCaption, `${safeOccasion} Offer`, '#00FFF0'),
      ],
    },
  };
}

/* ==========================================================================
   LAYOUT 3: Split Banner (Top Hero Image, Bottom Festive Card)
   ========================================================================== */
function renderSplitBannerLayout({ safeShopName, category, logoUrl, safeOccasion, safeProduct, discountAmount, productImage, safeCaption }) {
  return {
    type: 'div',
    props: {
      style: {
        height: '1080px',
        width: '1080px',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Roboto',
        color: '#FFFFFF',
        boxSizing: 'border-box',
        background: '#111111',
      },
      children: [
        // Top 50% Hero Image
        {
          type: 'div',
          props: {
            style: {
              width: '1080px',
              height: '540px',
              position: 'relative',
              display: 'flex',
            },
            children: [
              { type: 'img', props: { src: productImage, style: { width: '100%', height: '100%', objectFit: 'cover' } } },
              {
                type: 'div',
                props: {
                  style: {
                    position: 'absolute',
                    bottom: '30px',
                    left: '40px',
                    background: '#FF0055',
                    color: '#FFFFFF',
                    padding: '16px 36px',
                    borderRadius: '16px',
                    fontSize: '40px',
                    fontWeight: 'bold',
                    boxShadow: '0 10px 20px rgba(0,0,0,0.5)',
                  },
                  children: `SAVE ${discountAmount}% NOW!`,
                },
              },
            ],
          },
        },
        // Bottom 50% Content Card
        {
          type: 'div',
          props: {
            style: {
              width: '1080px',
              height: '540px',
              background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
              padding: '40px 60px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box',
              borderTop: '6px solid #FF0055',
            },
            children: [
              renderHeaderBlock(safeShopName, category, logoUrl, '#FF0055'),
              {
                type: 'div',
                props: {
                  style: { fontSize: '48px', fontWeight: 'bold', color: '#FFFFFF' },
                  children: `${safeOccasion} Special: ${safeProduct}`,
                },
              },
              renderCaptionFooter(safeCaption, null, '#FF0055'),
            ],
          },
        },
      ],
    },
  };
}

/* ==========================================================================
   LAYOUT 4: Sunset Vibrant Splash (Orange & Warm Red)
   ========================================================================== */
function renderSunsetVibrantLayout({ safeShopName, category, logoUrl, safeOccasion, safeProduct, discountAmount, productImage, safeCaption }) {
  return {
    type: 'div',
    props: {
      style: {
        height: '1080px',
        width: '1080px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '50px',
        background: 'linear-gradient(135deg, #FF4E00 0%, #E60000 60%, #800020 100%)',
        fontFamily: 'Roboto',
        color: '#FFFFFF',
        boxSizing: 'border-box',
      },
      children: [
        renderHeaderBlock(safeShopName, category, logoUrl, '#FFD700'),
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    width: '460px',
                    height: '460px',
                    borderRadius: '230px',
                    overflow: 'hidden',
                    display: 'flex',
                    border: '8px solid #FFD700',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                  },
                  children: [{ type: 'img', props: { src: productImage, style: { width: '100%', height: '100%', objectFit: 'cover' } } }],
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    position: 'absolute',
                    top: '10px',
                    right: '-30px',
                    background: '#FFD700',
                    color: '#800020',
                    padding: '16px 28px',
                    borderRadius: '50px',
                    fontSize: '36px',
                    fontWeight: 'bold',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  },
                  children: `${discountAmount}% OFF!`,
                },
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: '46px', fontWeight: 'bold', color: '#FFD700', marginTop: '20px', textAlign: 'center' },
                  children: safeProduct,
                },
              },
            ],
          },
        },
        renderCaptionFooter(safeCaption, `Happy ${safeOccasion}`, '#FFD700'),
      ],
    },
  };
}

/* ==========================================================================
   PLAIN GREETING LAYOUT (Template A)
   ========================================================================== */
function renderGreetingLayout({ safeShopName, category, logoUrl, safeOccasion, safeCaption }) {
  return {
    type: 'div',
    props: {
      style: {
        height: '1080px',
        width: '1080px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '60px',
        background: 'linear-gradient(135deg, #833AB4 0%, #FD1D1D 50%, #FCB045 100%)',
        fontFamily: 'Roboto',
        color: '#FFFFFF',
        boxSizing: 'border-box',
      },
      children: [
        renderHeaderBlock(safeShopName, category, logoUrl, '#FFFB00'),
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '60px 40px',
              borderRadius: '36px',
              background: 'rgba(255, 255, 255, 0.15)',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              width: '90%',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { fontSize: '32px', letterSpacing: '4px', color: '#FFFB00', marginBottom: '16px' },
                  children: 'FESTIVE GREETINGS',
                },
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: '72px', fontWeight: 'bold', textAlign: 'center', color: '#FFFFFF' },
                  children: `HAPPY ${safeOccasion.toUpperCase()}!`,
                },
              },
            ],
          },
        },
        renderCaptionFooter(safeCaption, null, '#FFFB00'),
      ],
    },
  };
}

/* Helper: Render Shop Header */
function renderHeaderBlock(shopName, category, logoUrl, accentColor) {
  return {
    type: 'div',
    props: {
      style: { display: 'flex', alignItems: 'center', width: '100%', gap: '24px' },
      children: [
        logoUrl
          ? {
              type: 'img',
              props: {
                src: logoUrl,
                style: { width: '90px', height: '90px', borderRadius: '45px', border: `4px solid ${accentColor}`, objectFit: 'cover' },
              },
            }
          : {
              type: 'div',
              props: {
                style: {
                  width: '90px',
                  height: '90px',
                  borderRadius: '45px',
                  background: accentColor,
                  color: '#000000',
                  fontSize: '42px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                children: shopName.charAt(0).toUpperCase(),
              },
            },
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column' },
            children: [
              { type: 'div', props: { style: { fontSize: '44px', fontWeight: 'bold', color: '#FFFFFF' }, children: shopName } },
              { type: 'div', props: { style: { fontSize: '24px', color: accentColor, textTransform: 'uppercase', letterSpacing: '2px' }, children: category } },
            ],
          },
        },
      ],
    },
  };
}

/* Helper: Render Footer Caption */
function renderCaptionFooter(captionText, tagText, accentColor) {
  return {
    type: 'div',
    props: {
      style: {
        width: '100%',
        background: 'rgba(0, 0, 0, 0.65)',
        borderRadius: '24px',
        padding: '28px 36px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        border: '1px solid rgba(255, 255, 255, 0.2)',
      },
      children: [
        { type: 'div', props: { style: { fontSize: '30px', textAlign: 'center', color: '#FFFFFF', lineHeight: '1.4' }, children: captionText } },
        tagText ? { type: 'div', props: { style: { fontSize: '20px', color: accentColor, marginTop: '10px' }, children: tagText } } : null,
      ].filter(Boolean),
    },
  };
}
