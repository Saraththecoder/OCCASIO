import { config } from './src/config.js';
import { saveShop, getOccasions } from './src/db.js';

async function runApiTest() {
  console.log('🧪 Testing Occasio Express & Database layer...');

  const port = config.port || 3000;
  const baseUrl = `http://localhost:${port}`;

  // 1. Seed a test shop in DB / memory
  const shop = await saveShop({
    telegramChatId: '123456789',
    shopName: 'Desi Spice Restaurant',
    category: 'restaurant',
    logoUrl: null,
  });
  console.log('✅ Created mock shop:', shop.shop_name);

  // 2. Fetch Occasions
  const occasions = await getOccasions();
  console.log(`✅ Fetched ${occasions.length} occasion(s):`, occasions.map((o) => o.name).join(', '));

  // 3. Test HTTP GET /api/shops
  const resShops = await fetch(`${baseUrl}/api/shops`);
  const dataShops = await resShops.json();
  console.log('✅ GET /api/shops:', dataShops.success ? `${dataShops.count} shop(s)` : 'Failed');

  // 4. Test HTTP GET /api/occasions
  const resOccasions = await fetch(`${baseUrl}/api/occasions`);
  const dataOccasions = await resOccasions.json();
  console.log('✅ GET /api/occasions:', dataOccasions.success ? `${dataOccasions.count} occasion(s)` : 'Failed');

  // 5. Test HTTP POST /api/trigger-occasion
  const targetOccasion = occasions[0];
  const resTrigger = await fetch(`${baseUrl}/api/trigger-occasion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ occasionId: targetOccasion.id }),
  });
  const dataTrigger = await resTrigger.json();
  console.log('✅ POST /api/trigger-occasion:', dataTrigger.message || dataTrigger.error);

  // 6. Test HTTP GET /api/posts
  const resPosts = await fetch(`${baseUrl}/api/posts`);
  const dataPosts = await resPosts.json();
  console.log('✅ GET /api/posts:', dataPosts.success ? `${dataPosts.count} post(s)` : 'Failed');

  console.log('🎉 API Test completed successfully!');
}

runApiTest().catch((err) => {
  console.error('❌ API test error:', err.message);
  process.exit(1);
});
