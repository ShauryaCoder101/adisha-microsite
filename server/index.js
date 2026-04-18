import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import express from 'express';
import cors from 'cors';
import { initDB } from './db/database.js';
import adminRoutes from './routes/admin.js';
import faceSearchRoutes from './routes/faceSearch.js';
import snippetsRoutes from './routes/snippets.js';
import coupleRoutes from './routes/couple.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || origin.startsWith('http://localhost') || origin.includes('vercel.app') || origin.includes('adisha.net')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json({ limit: '50mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ──
app.use('/api/admin', adminRoutes);
app.use('/api/face-search', faceSearchRoutes);
app.use('/api/snippets', snippetsRoutes);
app.use('/api/couple', coupleRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Initialize & Start ──
async function start() {
  await initDB();

  app.listen(PORT, () => {
    console.log(`\n🚀 Niva Bupa Microsite Server`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health\n`);

    const services = {
      'AWS S3': !!process.env.AWS_ACCESS_KEY_ID && !!process.env.S3_BUCKET_NAME,
      'AWS Rekognition': !!process.env.AWS_ACCESS_KEY_ID,
      'OpenAI Whisper': !!process.env.OPENAI_API_KEY,
      'Gemini': !!process.env.GEMINI_API_KEY,
    };

    console.log('   Service Status:');
    Object.entries(services).forEach(([name, configured]) => {
      console.log(`   ${configured ? '✅' : '⬜'} ${name}`);
    });
    console.log('');
  });
}

start().catch(console.error);
