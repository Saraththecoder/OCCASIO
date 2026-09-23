import { supabase, isSupabaseConfigured } from './config.js';
import fs from 'fs';
import path from 'path';

// In-memory fallback stores for offline/mock testing
const memoryShops = [];
const memoryOccasions = [
  { id: 'occ-1', name: 'Dasara', date: '2026-10-12', category_tags: ['restaurant', 'cafe', 'retail', 'salon', 'other'] },
  { id: 'occ-2', name: 'Diwali', date: '2026-11-01', category_tags: ['restaurant', 'cafe', 'retail', 'salon', 'other'] },
  { id: 'occ-3', name: 'New Year', date: '2027-01-01', category_tags: ['restaurant', 'cafe', 'retail', 'salon', 'other'] },
  { id: 'occ-4', name: 'Independence Day', date: '2026-08-15', category_tags: ['restaurant', 'cafe', 'retail', 'salon', 'other'] },
  { id: 'occ-5', name: 'Weekend Special', date: 'Weekly', category_tags: ['restaurant', 'cafe', 'retail', 'salon', 'other'] },
];
const memoryPosts = [];

// Ensure public uploads directory exists for fallback image storage
const uploadsDir = path.resolve('public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Get shop by telegram_chat_id
 */
export async function getShopByChatId(chatId) {
  console.log(`🔍 [DB] Fetching shop for chat_id: ${chatId}`);
  if (!isSupabaseConfigured) {
    return memoryShops.find((s) => String(s.telegram_chat_id) === String(chatId)) || null;
  }
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('telegram_chat_id', String(chatId))
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('❌ [DB Error] getShopByChatId:', error.message);
  }
  return data || null;
}

/**
 * Get all shops
 */
export async function getAllShops() {
  console.log('🔍 [DB] Fetching all shops');
  if (!isSupabaseConfigured) {
    return memoryShops;
  }
  const { data, error } = await supabase.from('shops').select('*');
  if (error) {
    console.error('❌ [DB Error] getAllShops:', error.message);
    return memoryShops;
  }
  return data || [];
}

/**
 * Save or update shop in DB
 */
export async function saveShop({ telegramChatId, shopName, category, logoUrl }) {
  console.log(`💾 [DB] Saving shop: "${shopName}" (${category}) for chat: ${telegramChatId}`);
  
  const shopObj = {
    telegram_chat_id: String(telegramChatId),
    shop_name: shopName,
    category,
    logo_url: logoUrl || null,
  };

  if (!isSupabaseConfigured) {
    const existingIndex = memoryShops.findIndex((s) => String(s.telegram_chat_id) === String(telegramChatId));
    if (existingIndex >= 0) {
      memoryShops[existingIndex] = { ...memoryShops[existingIndex], ...shopObj };
      return memoryShops[existingIndex];
    }
    const newShop = { id: `shop-${Date.now()}`, ...shopObj, created_at: new Date().toISOString() };
    memoryShops.push(newShop);
    return newShop;
  }

  const { data, error } = await supabase
    .from('shops')
    .upsert(shopObj, { onConflict: 'telegram_chat_id' })
    .select()
    .single();

  if (error) {
    console.error('❌ [DB Error] saveShop:', error.message);
    throw error;
  }
  return data;
}

/**
 * Get all occasions
 */
export async function getOccasions() {
  console.log('🔍 [DB] Fetching occasions');
  if (!isSupabaseConfigured) {
    return memoryOccasions;
  }
  const { data, error } = await supabase.from('occasions').select('*');
  if (error || !data || data.length === 0) {
    console.warn('⚠️ [DB] Fetching occasions from DB failed or empty, returning default memory seed.');
    return memoryOccasions;
  }
  return data;
}

/**
 * Get single occasion by ID or name
 */
export async function getOccasionById(occasionId) {
  console.log(`🔍 [DB] Fetching occasion ID: ${occasionId}`);
  if (!isSupabaseConfigured) {
    return memoryOccasions.find((o) => o.id === occasionId || o.name.toLowerCase() === String(occasionId).toLowerCase()) || memoryOccasions[0];
  }
  const { data, error } = await supabase
    .from('occasions')
    .select('*')
    .eq('id', occasionId)
    .single();

  if (error) {
    // Try matching by name if UUID lookup failed
    const { data: byName } = await supabase
      .from('occasions')
      .select('*')
      .ilike('name', `%${occasionId}%`)
      .limit(1);

    if (byName && byName.length > 0) return byName[0];

    return memoryOccasions.find((o) => o.id === occasionId || o.name.toLowerCase() === String(occasionId).toLowerCase()) || memoryOccasions[0];
  }
  return data;
}

/**
 * Create a new post
 */
export async function createPost({
  shopId,
  occasionId,
  discountProduct,
  discountAmount,
  productPhotoUrl,
  captionText,
  posterImageUrl,
  status = 'pending',
}) {
  console.log(`💾 [DB] Creating post for shop: ${shopId}, occasion: ${occasionId}`);
  
  const postObj = {
    shop_id: shopId,
    occasion_id: occasionId,
    discount_product: discountProduct || null,
    discount_amount: discountAmount || null,
    product_photo_url: productPhotoUrl || null,
    caption_text: captionText,
    poster_image_url: posterImageUrl,
    status,
  };

  if (!isSupabaseConfigured) {
    const newPost = { id: `post-${Date.now()}`, ...postObj, created_at: new Date().toISOString() };
    memoryPosts.push(newPost);
    return newPost;
  }

  const { data, error } = await supabase.from('posts').insert(postObj).select().single();
  if (error) {
    console.error('❌ [DB Error] createPost:', error.message);
    const newPost = { id: `post-${Date.now()}`, ...postObj, created_at: new Date().toISOString() };
    memoryPosts.push(newPost);
    return newPost;
  }
  return data;
}

/**
 * Update post status (approved / rejected)
 */
export async function updatePostStatus(postId, status) {
  console.log(`💾 [DB] Updating post ${postId} status to "${status}"`);
  if (!isSupabaseConfigured) {
    const post = memoryPosts.find((p) => p.id === postId);
    if (post) post.status = status;
    return post;
  }

  const { data, error } = await supabase
    .from('posts')
    .update({ status })
    .eq('id', postId)
    .select()
    .single();

  if (error) {
    console.error('❌ [DB Error] updatePostStatus:', error.message);
    const post = memoryPosts.find((p) => p.id === postId);
    if (post) post.status = status;
    return post;
  }
  return data;
}

/**
 * Get all posts with status
 */
export async function getAllPosts() {
  console.log('🔍 [DB] Fetching all posts');
  if (!isSupabaseConfigured) {
    return memoryPosts;
  }
  const { data, error } = await supabase.from('posts').select('*, shops(shop_name, category), occasions(name)');
  if (error) {
    console.error('❌ [DB Error] getAllPosts:', error.message);
    return memoryPosts;
  }
  return data || [];
}

/**
 * Save PNG image buffer to Supabase Storage, with fallback to local Express static directory
 */
export async function uploadPosterImage(imageBuffer, filename = `poster-${Date.now()}.png`, port = 3000) {
  console.log(`📤 [Storage] Uploading poster image: ${filename}`);

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.storage
        .from('posters')
        .upload(filename, imageBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from('posters')
          .getPublicUrl(filename);
        
        console.log(`✅ [Storage] Uploaded to Supabase Storage: ${publicUrlData.publicUrl}`);
        return publicUrlData.publicUrl;
      } else {
        console.warn('⚠️ [Storage] Supabase upload error (bucket missing?), using local file fallback:', error?.message);
      }
    } catch (err) {
      console.warn('⚠️ [Storage] Supabase upload exception, using local file fallback:', err.message);
    }
  }

  // Local File Fallback
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, imageBuffer);
  const localUrl = `http://localhost:${port}/uploads/${filename}`;
  console.log(`✅ [Storage] Saved image locally: ${localUrl}`);
  return localUrl;
}
