import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDatabase } from './config/database.js';
// Embeddings are initialized lazily by Pinecone service

// Import routes
import contractsRoutes from './routes/contracts.routes.js';
import proposalsRoutes from './routes/proposals.routes.js';
import templatesRoutes from './routes/templates.routes.js';
import presalesRoutes from './routes/presales.routes.js';
// Vector routes removed (Pinecone deprecated)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// TEMPORARILY DISABLE SUPABASE - Comment out these lines when Supabase is ready
process.env.SUPABASE_URL = '';
process.env.SUPABASE_KEY = '';
console.log('🔧 Supabase temporarily disabled - using SQLite fallback');

const app = express();
const PORT = process.env.PORT || 4000;
const API_VERSION = process.env.API_VERSION || 'v1';

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(`/api/${API_VERSION}`, limiter);
}

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use(`/api/${API_VERSION}/contracts`, contractsRoutes);
app.use(`/api/${API_VERSION}/proposals`, proposalsRoutes);
app.use(`/api/${API_VERSION}/templates`, templatesRoutes);
app.use(`/api/${API_VERSION}/presales`, presalesRoutes);
// Vector routes disabled pending Supabase pgvector migration

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Contract Hub API',
    version: API_VERSION,
    description: 'RAG-based Contract Management System with Presales Knowledge Hub',
    endpoints: {
      health: '/health',
      contracts: `/api/${API_VERSION}/contracts`,
      proposals: `/api/${API_VERSION}/proposals`,
      templates: `/api/${API_VERSION}/templates`,
      presales: `/api/${API_VERSION}/presales`,
      vector: `/api/${API_VERSION}/vector`,
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Initialize application
async function initialize() {
  console.log('🚀 Initializing Contract Hub API...\n');

  // Initialize database
  console.log('📊 Setting up database...');
  initDatabase();

  // Embedding/Pinecone will initialize on demand

  // Gemini connectivity will be validated on demand by RAG service

  console.log('\n✅ Initialization complete!\n');
}

// Start server
async function start() {
  try {
    await initialize();

    app.listen(PORT, () => {
      console.log(`🎯 Server running on http://localhost:${PORT}`);
      console.log(`📚 API version: ${API_VERSION}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`\n📖 Documentation: http://localhost:${PORT}/\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 SIGTERM received, shutting down gracefully...');
  db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 SIGINT received, shutting down gracefully...');
  db.close();
  process.exit(0);
});

// Start the server
start();
