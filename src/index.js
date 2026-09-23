import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config.js';
import routes from './routes.js';
import { initBotHandlers } from './bot.js';

const app = express();
const PORT = config.port;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static poster uploads folder
app.use('/uploads', express.static(path.resolve('public', 'uploads')));

// Serve Instagram Demo Feed UI
app.get('/instagram', (req, res) => {
  res.sendFile(path.resolve('public', 'instagram.html'));
});

// Mount API Routes
app.use('/api', routes);

// Base / Health check route
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    app: 'Occasio Backend MVP',
    version: '1.0.0',
    endpoints: {
      triggerOccasion: 'POST /api/trigger-occasion?occasionId=X',
      shopsList: 'GET /api/shops',
      postsList: 'GET /api/posts',
      occasionsList: 'GET /api/occasions',
    },
  });
});

// Initialize Telegram Bot Listeners
initBotHandlers(PORT);

// Start Express Server
app.listen(PORT, () => {
  console.log(`\n🚀 Occasio Backend running on http://localhost:${PORT}`);
  console.log(`📡 API Endpoints available at http://localhost:${PORT}/api`);
  console.log(`🛠️ Mode: ${process.env.NODE_ENV || 'development'}\n`);
});
