import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { testConnection } from './config/supabase.js';
import { requireAuth, requireApiKey, requireAuthOrApiKey } from './middleware/auth.js';
import clientsRouter from './routes/clients.js';
import documentsRouter from './routes/documents.js';
import chatRouter from './routes/chat.js';
import sheetsRouter from './routes/sheets.js';
import dashboardsRouter from './routes/dashboards.js';
import leadsRouter from './routes/leads.js';
import agentRouter from './routes/agent.js';
import sourcesRouter from './routes/sources.js';

dotenv.config({ override: true });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:3004', 'http://localhost:5173'],
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 120, // 120 requests per minute (2 per second average)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Protected Routes - require authentication
app.use('/api/clients', requireAuth, clientsRouter);
app.use('/api/documents', requireAuthOrApiKey, documentsRouter);
app.use('/api/chat', requireAuth, chatRouter);
app.use('/api/sheets', requireAuth, sheetsRouter);
app.use('/api/dashboards', requireAuth, dashboardsRouter);
app.use('/api/leads', requireAuth, leadsRouter);

// Agent API - requires API key (for external services/tools)
app.use('/api/agent', requireApiKey, agentRouter);

// Sources API - cleaner external API for uploading sources (requires API key)
app.use('/api/sources', requireApiKey, sourcesRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Internal Client Application API',
    version: '1.0.0',
    endpoints: {
      clients: '/api/clients',
      documents: '/api/documents',
      sources: '/api/sources',
      chat: '/api/chat',
      sheets: '/api/sheets',
      agent: '/api/agent',
      health: '/health'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size is 10MB.'
      });
    }
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    console.log('Testing Supabase connection...');
    await testConnection();

    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`📍 API: http://localhost:${PORT}`);
      console.log(`🏥 Health: http://localhost:${PORT}/health`);
      console.log(`\n📚 API Endpoints:`);
      console.log(`   - GET    /api/clients`);
      console.log(`   - POST   /api/clients`);
      console.log(`   - GET    /api/clients/:id`);
      console.log(`   - PUT    /api/clients/:id`);
      console.log(`   - DELETE /api/clients/:id`);
      console.log(`   - GET    /api/documents/:clientId`);
      console.log(`   - POST   /api/documents/:clientId/upload`);
      console.log(`   - DELETE /api/documents/:documentId`);
      console.log(`   - POST   /api/documents/search/:clientId`);
      console.log(`   - GET    /api/chat/:clientId`);
      console.log(`   - POST   /api/chat/:clientId`);
      console.log(`   - DELETE /api/chat/:clientId`);
      console.log(`\n🤖 Agent API (requires X-API-Key):`);
      console.log(`   - POST   /api/agent/query`);
      console.log(`   - GET    /api/agent/clients`);
      console.log(`   - GET    /api/agent/clients/:clientId/context`);
      console.log(`\n📁 Sources API (requires X-API-Key):`);
      console.log(`   - POST   /api/sources/upload`);
      console.log(`   - POST   /api/sources/create-client`);
      console.log(`   - GET    /api/sources/clients`);
      console.log(`   - GET    /api/sources/:clientId`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
