import express from 'express';
import { getAllShops, getAllPosts, getOccasions, getOccasionById } from './db.js';
import { triggerOccasionForShops } from './bot.js';

const router = express.Router();

/**
 * GET /api - API Overview
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Occasio API',
    endpoints: [
      { path: 'GET /api/shops', description: 'List registered shops' },
      { path: 'GET /api/posts', description: 'List generated posts and statuses' },
      { path: 'GET /api/occasions', description: 'List available festival occasions' },
      { path: 'POST /api/trigger-occasion', description: 'Trigger occasion prompt for shops (body: { occasionId })' },
    ],
  });
});

/**
 * GET /api/shops - List all registered shops
 */
router.get('/shops', async (req, res) => {
  try {
    const shops = await getAllShops();
    res.json({ success: true, count: shops.length, shops });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/posts - List generated posts + status
 */
router.get('/posts', async (req, res) => {
  try {
    const posts = await getAllPosts();
    res.json({ success: true, count: posts.length, posts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/occasions - List all occasions
 */
router.get('/occasions', async (req, res) => {
  try {
    const occasions = await getOccasions();
    res.json({ success: true, count: occasions.length, occasions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/trigger-occasion - Trigger occasion notification for all shops
 * Body or query param: { occasionId }
 */
router.post('/trigger-occasion', async (req, res) => {
  try {
    const occasionId = req.body?.occasionId || req.query?.occasionId;

    if (!occasionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing occasionId in body or query param.',
      });
    }

    const occasion = await getOccasionById(occasionId);
    if (!occasion) {
      return res.status(404).json({
        success: false,
        error: `Occasion with ID "${occasionId}" not found.`,
      });
    }

    const shops = await getAllShops();
    if (shops.length === 0) {
      return res.json({
        success: true,
        message: 'Trigger registered, but no shops are registered yet in the database.',
        occasion,
        shopsCount: 0,
      });
    }

    // Trigger Flow 2 for each registered shop
    await triggerOccasionForShops(shops, occasion);

    res.json({
      success: true,
      message: `Triggered occasion "${occasion.name}" for ${shops.length} shop(s).`,
      occasion,
      shopsCount: shops.length,
      shops: shops.map((s) => ({ id: s.id, shop_name: s.shop_name, telegram_chat_id: s.telegram_chat_id })),
    });
  } catch (err) {
    console.error('❌ Error triggering occasion:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
