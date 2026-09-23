import { genAI, isGeminiConfigured } from './config.js';

// Caption tones to cycle through for maximum variety
const CAPTION_STYLES = [
  'warm & festive',
  'punchy & urgent',
  'humorous & mouth-watering',
  'friendly neighborhood vibe',
  'exclusive VIP deal',
];

/**
 * Generate catchy social media caption using Google Gemini API
 */
export async function generateCaption({
  shopCategory = 'restaurant',
  shopName = 'Our Shop',
  occasionName = 'Festive Celebration',
  discountProduct = null,
  discountAmount = null,
  customInstruction = null,
}) {
  console.log(`🤖 [AI] Generating caption for ${shopName} (${occasionName})`);

  // Pick a random style for variety
  const randomStyle = CAPTION_STYLES[Math.floor(Math.random() * CAPTION_STYLES.length)];

  let prompt = `Write a short, creative Instagram caption in a ${randomStyle} Indian tone for a ${shopCategory} named "${shopName}" celebrating ${occasionName}.`;

  if (discountProduct && discountAmount) {
    prompt += ` Offer: ${discountAmount}% off on ${discountProduct}. Highlight this delicious offer!`;
  } else {
    prompt += ` Wish customers a joyful ${occasionName}.`;
  }

  if (customInstruction) {
    prompt += ` Change instruction: "${customInstruction}".`;
  }

  prompt += ` Keep it under 20 words. Do NOT include hashtags, quotes, or rare unicode emojis. Keep text simple and punchy.`;

  if (isGeminiConfigured && genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim().replace(/^["']|["']$/g, '');
      
      console.log(`✨ [AI Generated Caption - ${randomStyle}]: ${text}`);
      return cleanText(text);
    } catch (err) {
      console.error('❌ [AI Error] Gemini generation failed, using dynamic template fallback:', err.message);
    }
  } else {
    console.warn('⚠️ [AI] Gemini API not configured, using dynamic template fallback.');
  }

  // Fallback caption with random variety
  return generateDynamicFallbackCaption({ shopName, occasionName, discountProduct, discountAmount });
}

/**
 * Clean text to prevent square unicode boxes in Satori rendering
 */
export function cleanText(str = '') {
  if (!str) return '';
  // Remove emojis/symbols that cause square boxes in standard TTF fonts
  return str
    .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 5 Diverse fallback caption templates
 */
function generateDynamicFallbackCaption({ shopName, occasionName, discountProduct, discountAmount }) {
  if (discountProduct && discountAmount) {
    const templates = [
      `Celebrate ${occasionName} at ${shopName}! Enjoy ${discountAmount}% OFF on ${discountProduct}!`,
      `Festive Special! Grab a huge ${discountAmount}% discount on ${discountProduct} at ${shopName}!`,
      `${occasionName} cravings sorted! ${discountAmount}% OFF on delicious ${discountProduct} today!`,
      `Special deal at ${shopName}! Get ${discountAmount}% OFF on your favorite ${discountProduct}!`,
      `Brighten your ${occasionName} with ${shopName}! ${discountAmount}% OFF on ${discountProduct} for a limited time!`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  const plainTemplates = [
    `Happy ${occasionName} from all of us at ${shopName}! Wishing you joy and prosperity!`,
    `Warm greetings on ${occasionName} from ${shopName}! Celebrate with your loved ones today!`,
    `Wishing you a bright and joyful ${occasionName}! Thank you for choosing ${shopName}!`,
    `Celebrations start here! ${shopName} wishes you a wonderful ${occasionName}!`,
  ];
  return plainTemplates[Math.floor(Math.random() * plainTemplates.length)];
}
