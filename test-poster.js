import { generatePosterPNG } from './src/poster.js';
import fs from 'fs';
import path from 'path';

async function runTest() {
  console.log('🧪 Testing All 4 Poster Design Layouts...');
  const outDir = path.resolve('public', 'uploads');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (let layout = 1; layout <= 4; layout++) {
    const png = await generatePosterPNG({
      shopName: 'Paradise Restaurant',
      category: 'restaurant',
      occasionName: 'Diwali',
      discountProduct: 'Special Momos & Biryani',
      discountAmount: '50',
      captionText: 'Celebrate Diwali with Paradise! Grab 50% OFF on Special Momos today!',
      layoutStyle: layout,
    });

    const file = path.join(outDir, `layout-theme-${layout}.png`);
    fs.writeFileSync(file, png);
    console.log(`✅ Saved Layout #${layout}: public/uploads/layout-theme-${layout}.png (${png.length} bytes)`);
  }

  console.log('🎉 All 4 Poster Layouts rendered successfully!');
}

runTest().catch((err) => {
  console.error('❌ Poster test error:', err);
});
