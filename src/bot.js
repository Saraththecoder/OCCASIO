import { bot, isTelegramConfigured, config } from './config.js';
import { saveShop, getShopByChatId, createPost, updatePostStatus, uploadPosterImage, getOccasions, getOccasionById } from './db.js';
import { generateCaption } from './ai.js';
import { generatePosterPNG } from './poster.js';

// In-memory conversation state map keyed by Telegram chat_id
export const userStates = new Map();

/**
 * Helper to get or reset user state
 */
function getState(chatId) {
  return userStates.get(String(chatId)) || { step: 'IDLE' };
}

function setState(chatId, stateObj) {
  userStates.set(String(chatId), stateObj);
}

function clearState(chatId) {
  userStates.delete(String(chatId));
}

/**
 * Initialize Telegram Bot Event Handlers
 */
export function initBotHandlers(expressPort = 3000) {
  if (!bot || !isTelegramConfigured) {
    console.warn('⚠️ Telegram Bot handlers not attached (token missing or mock).');
    return;
  }

  console.log('🤖 Registering Telegram bot handlers...');

  // Flow 1: Onboarding /start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`📩 [Bot] Received /start from chat: ${chatId}`);

    const existingShop = await getShopByChatId(chatId);
    if (existingShop) {
      await bot.sendMessage(
        chatId,
        `Welcome back to *Occasio*, *${existingShop.shop_name}*! 🎉\n\nChoose an upcoming occasion to generate a poster, or tap below to browse upcoming events:`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📅 See Upcoming Events', callback_data: 'show_events' }],
            ],
          },
        }
      );
      return;
    }

    setState(chatId, { step: 'ONBOARDING_NAME' });
    await bot.sendMessage(
      chatId,
      '👋 *Welcome to Occasio!*\nLet\'s set up your shop profile in 3 quick steps.\n\n1️⃣ *What\'s your shop name?*',
      { parse_mode: 'Markdown' }
    );
  });

  // Command /events or /occasions
  bot.onText(/\/(events|occasions)/, async (msg) => {
    const chatId = msg.chat.id;
    await sendEventsMenu(chatId);
  });

  // Incoming Message Handler (Text & Photo)
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim() : '';

    // Ignore commands like /start
    if (text.startsWith('/')) return;

    const state = getState(chatId);
    console.log(`📩 [Bot Message] Chat: ${chatId} | Step: ${state.step} | Text: "${text}" | Photos: ${msg.photo ? msg.photo.length : 0}`);

    try {
      // Step 1: Onboarding Shop Name
      if (state.step === 'ONBOARDING_NAME') {
        if (!text) {
          await bot.sendMessage(chatId, 'Please type a valid shop name.');
          return;
        }
        setState(chatId, { step: 'ONBOARDING_CATEGORY', shopName: text });

        await bot.sendMessage(
          chatId,
          `Great! *${text}* sounds awesome! 🏪\n\n2️⃣ *What type of shop is it?*\n(Choose below or type: restaurant, cafe, retail, salon, other)`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🍽️ Restaurant', callback_data: 'cat_restaurant' }, { text: '☕ Cafe', callback_data: 'cat_cafe' }],
                [{ text: '🛍️ Retail', callback_data: 'cat_retail' }, { text: '✂️ Salon', callback_data: 'cat_salon' }],
                [{ text: '📦 Other', callback_data: 'cat_other' }],
              ],
            },
          }
        );
        return;
      }

      // Step 2: Onboarding Category via text fallback
      if (state.step === 'ONBOARDING_CATEGORY') {
        const category = text.toLowerCase() || 'other';
        await handleCategorySelection(chatId, state.shopName, category);
        return;
      }

      // Step 3: Onboarding Logo Upload / Skip
      if (state.step === 'ONBOARDING_LOGO') {
        let logoUrl = null;

        if (msg.photo && msg.photo.length > 0) {
          const fileId = msg.photo[msg.photo.length - 1].file_id;
          logoUrl = await bot.getFileLink(fileId);
          console.log(`📷 [Bot] Shop logo received: ${logoUrl}`);
        } else if (text.toLowerCase() !== 'skip') {
          await bot.sendMessage(chatId, 'Please send your logo as an image photo, or type "skip".');
          return;
        }

        // Save shop profile
        const savedShop = await saveShop({
          telegramChatId: chatId,
          shopName: state.shopName,
          category: state.category,
          logoUrl,
        });

        clearState(chatId);
        await bot.sendMessage(
          chatId,
          `🎉 *Setup Complete!*\n*${savedShop.shop_name}* is now registered on Occasio.\n\nTap below to view upcoming occasions and create your first festive poster! 🚀`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📅 See Upcoming Events', callback_data: 'show_events' }],
              ],
            },
          }
        );
        return;
      }

      // Flow 3: Handling Owner's Reply for Discount
      if (state.step === 'WAITING_DISCOUNT') {
        if (text.toLowerCase() === 'no' || text.toLowerCase() === 'none' || text.toLowerCase() === 'plain') {
          // Plain occasion greeting (no discount)
          await bot.sendMessage(chatId, '👍 Got it! Generating a festive greeting poster without discounts...');
          await processPosterGeneration({
            chatId,
            shop: state.shop,
            occasion: state.occasion,
            discountProduct: null,
            discountAmount: null,
            productPhotoUrl: null,
            expressPort,
          });
          return;
        }

        // Parse "Product Name, Discount %"
        const parts = text.split(',');
        if (parts.length < 2) {
          await bot.sendMessage(
            chatId,
            `⚠️ Please reply with format: *product name, discount %*\n(e.g., 'Chicken Biryani, 20') or type 'no' for plain greeting.`,
            { parse_mode: 'Markdown' }
          );
          return;
        }

        const discountProduct = parts[0].trim();
        const discountAmount = parts[1].replace(/[^0-9]/g, '').trim();

        if (!discountAmount) {
          await bot.sendMessage(chatId, '⚠️ Please specify a valid discount percentage number (e.g. 20).');
          return;
        }

        setState(chatId, {
          step: 'WAITING_PHOTO',
          shopId: state.shopId,
          shop: state.shop,
          occasionId: state.occasionId,
          occasion: state.occasion,
          discountProduct,
          discountAmount,
        });

        await bot.sendMessage(
          chatId,
          `Offer registered: *${discountAmount}% OFF on ${discountProduct}* 🎁\n\n📷 Send a product photo, or type *'skip'* to use a default festive image.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Handling Product Photo upload / skip
      if (state.step === 'WAITING_PHOTO') {
        let productPhotoUrl = null;

        if (msg.photo && msg.photo.length > 0) {
          const fileId = msg.photo[msg.photo.length - 1].file_id;
          productPhotoUrl = await bot.getFileLink(fileId);
          console.log(`📷 [Bot] Product photo link: ${productPhotoUrl}`);
        } else if (text.toLowerCase() !== 'skip') {
          await bot.sendMessage(chatId, 'Please send a photo of the item, or type "skip".');
          return;
        }

        await bot.sendMessage(chatId, '✨ Creating your customized AI poster and caption...');

        await processPosterGeneration({
          chatId,
          shop: state.shop,
          occasion: state.occasion,
          discountProduct: state.discountProduct,
          discountAmount: state.discountAmount,
          productPhotoUrl,
          expressPort,
        });
        return;
      }

      // Flow 4: Edit Poster Requested
      if (state.step === 'WAITING_EDIT') {
        await bot.sendMessage(chatId, `✨ Updating poster based on: "${text}"...`);
        await processPosterGeneration({
          chatId,
          shop: state.post.shop || state.shop,
          occasion: state.post.occasion || state.occasion,
          discountProduct: state.post.discount_product,
          discountAmount: state.post.discount_amount,
          productPhotoUrl: state.post.product_photo_url,
          customInstruction: text,
          postId: state.postId,
          expressPort,
        });
        return;
      }
    } catch (err) {
      console.error('❌ [Bot Error] Error processing message:', err);
      await bot.sendMessage(chatId, '⚠️ Oops, something went wrong while processing your request. Please try again!');
    }
  });

  // Callback Query Handler (Buttons)
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    console.log(`🔘 [Bot Callback] Chat: ${chatId} | Data: ${data}`);

    await bot.answerCallbackQuery(query.id);

    // Category button selection during onboarding
    if (data.startsWith('cat_')) {
      const category = data.replace('cat_', '');
      const state = getState(chatId);
      await handleCategorySelection(chatId, state.shopName || 'Shop', category);
      return;
    }

    // Show Events Menu callback
    if (data === 'show_events') {
      await sendEventsMenu(chatId);
      return;
    }

    // Trigger specific occasion callback
    if (data.startsWith('trig_')) {
      const occasionId = data.replace('trig_', '');
      const occasion = await getOccasionById(occasionId);
      const shop = await getShopByChatId(chatId);

      if (!shop) {
        await bot.sendMessage(chatId, 'Please register your shop first by typing /start.');
        return;
      }

      if (!occasion) {
        await bot.sendMessage(chatId, 'Occasion not found.');
        return;
      }

      // Set user state expecting discount reply
      userStates.set(String(chatId), {
        step: 'WAITING_DISCOUNT',
        shopId: shop.id,
        shop,
        occasionId: occasion.id,
        occasion,
      });

      await bot.sendMessage(
        chatId,
        `🎉 *${occasion.name} is coming up!*\nWant to add a discount or special offer to your poster?\n\nReply with: *'product name, discount %'*\n(e.g., 'Chicken Biryani, 20')\n\nor reply *'no'* for a plain occasion greeting poster.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Flow 4: Post Approval Callbacks
    if (data.startsWith('approve_')) {
      const postId = data.replace('approve_', '');
      const post = await updatePostStatus(postId, 'approved');

      // Send to Demo Storefront Telegram Channel if configured
      if (config.demoChannelId && post && post.poster_image_url) {
        try {
          await bot.sendPhoto(config.demoChannelId, post.poster_image_url, {
            caption: `📢 *NEW POST FROM ${post.shop_name || 'STORE'}*\n\n${post.caption_text}`,
            parse_mode: 'Markdown',
          });
          console.log(`🚀 [Demo Channel] Posted image to ${config.demoChannelId}`);
        } catch (e) {
          console.warn(`⚠️ Could not post to demo channel (${config.demoChannelId}):`, e.message);
        }
      }

      const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${expressPort}`;
      const instaLink = `${baseUrl}/instagram`;

      await bot.sendMessage(
        chatId,
        `Posted! 🎉 Your occasion poster is published!\n\n📸 *View your live post on Instagram Storefront:*\n${instaLink}`,
        { parse_mode: 'Markdown' }
      );
      clearState(chatId);
      return;
    }

    if (data.startsWith('edit_')) {
      const postId = data.replace('edit_', '');
      const state = getState(chatId);
      setState(chatId, { ...state, step: 'WAITING_EDIT', postId });
      await bot.sendMessage(chatId, '✏️ *What should I change?*\n(e.g., "Make it sound more exciting", "Change discount to 30%")', { parse_mode: 'Markdown' });
      return;
    }

    if (data.startsWith('reject_')) {
      const postId = data.replace('reject_', '');
      await updatePostStatus(postId, 'rejected');
      await bot.sendMessage(chatId, '❌ No problem, poster skipped.');
      clearState(chatId);
      return;
    }
  });
}

/**
 * Process Category selection during onboarding
 */
async function handleCategorySelection(chatId, shopName, category) {
  setState(chatId, { step: 'ONBOARDING_LOGO', shopName, category });
  await bot.sendMessage(
    chatId,
    `3️⃣ *Send your shop logo as a photo*, or type *'skip'* to use a default logo.`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Generate Caption + Render Poster + Upload + Send Preview to Telegram Chat
 */
async function processPosterGeneration({
  chatId,
  shop,
  occasion,
  discountProduct = null,
  discountAmount = null,
  productPhotoUrl = null,
  customInstruction = null,
  postId = null,
  expressPort = 3000,
}) {
  // 1. Generate Caption via Gemini AI
  const captionText = await generateCaption({
    shopCategory: shop?.category || 'store',
    shopName: shop?.shop_name || 'Our Shop',
    occasionName: occasion?.name || 'Festival',
    discountProduct,
    discountAmount,
    customInstruction,
  });

  // 2. Render Poster PNG via Satori & Resvg
  const pngBuffer = await generatePosterPNG({
    shopName: shop?.shop_name || 'Occasio Store',
    category: shop?.category || 'store',
    logoUrl: shop?.logo_url,
    occasionName: occasion?.name || 'Festival',
    discountProduct,
    discountAmount,
    productPhotoUrl,
    captionText,
  });

  // 3. Upload to Supabase Storage / Local static folder
  const filename = `poster-${shop?.id || 'demo'}-${Date.now()}.png`;
  const posterImageUrl = await uploadPosterImage(pngBuffer, filename, expressPort);

  // 4. Save to Database
  let savedPost;
  if (postId) {
    savedPost = await updatePostStatus(postId, 'pending');
  } else {
    savedPost = await createPost({
      shopId: shop?.id,
      occasionId: occasion?.id,
      discountProduct,
      discountAmount,
      productPhotoUrl,
      captionText,
      posterImageUrl,
      status: 'pending',
    });
  }

  // Attach shop and occasion data for reference
  savedPost.shop = shop;
  savedPost.occasion = occasion;

  // 5. Send Preview Image back to Telegram Chat with Inline Buttons
  if (bot && isTelegramConfigured) {
    await bot.sendPhoto(chatId, pngBuffer, {
      caption: `🎨 *Here is your ${occasion?.name || 'Occasion'} Poster!*\n\n*Caption:*\n${captionText}`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Approve', callback_data: `approve_${savedPost.id}` },
            { text: '✏️ Edit', callback_data: `edit_${savedPost.id}` },
            { text: '❌ Reject', callback_data: `reject_${savedPost.id}` },
          ],
        ],
      },
    });
  }

  clearState(chatId);
  return savedPost;
}

/**
 * Trigger Occasion Flow for all registered shops (Flow 2)
 */
export async function triggerOccasionForShops(shops, occasion) {
  console.log(`🔔 [Trigger Occasion] Sending "${occasion.name}" prompt to ${shops.length} shop(s)`);

  for (const shop of shops) {
    const chatId = shop.telegram_chat_id;

    // Store bot state expecting discount reply
    userStates.set(String(chatId), {
      step: 'WAITING_DISCOUNT',
      shopId: shop.id,
      shop,
      occasionId: occasion.id,
      occasion,
    });

    if (bot && isTelegramConfigured) {
      try {
        await bot.sendMessage(
          chatId,
          `🎉 *${occasion.name} is coming up!*\nWant to add a discount or special offer to your poster?\n\nReply with: *'product name, discount %'*\n(e.g., 'Chicken Biryani, 20')\n\nor reply *'no'* for a plain occasion greeting poster.`,
          { parse_mode: 'Markdown' }
        );
        console.log(`✅ Message sent to shop "${shop.shop_name}" (Chat ID: ${chatId})`);
      } catch (err) {
        console.error(`❌ Failed to send Telegram message to chat ${chatId}:`, err.message);
      }
    }
  }
}

/**
 * Send interactive menu with all upcoming events/occasions
 */
export async function sendEventsMenu(chatId) {
  const occasions = await getOccasions();

  if (!occasions || occasions.length === 0) {
    await bot.sendMessage(chatId, 'No upcoming events found at the moment.');
    return;
  }

  const buttons = occasions.map((occ) => [
    { text: `✨ ${occ.name} (${occ.date})`, callback_data: `trig_${occ.id}` },
  ]);

  await bot.sendMessage(
    chatId,
    `🎉 *Upcoming Festivals & Occasions*\n\nSelect an event below to create a poster for your shop:`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: buttons,
      },
    }
  );
}
