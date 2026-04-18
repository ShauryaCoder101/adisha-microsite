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

import { isS3Configured, listS3Photos } from './services/s3Service.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(cors());
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

/**
 * Rebuild SQLite photo records from S3 bucket on startup.
 * This ensures the DB is always in sync even after a redeploy wipes SQLite.
 */
async function rebuildPhotosFromS3() {
  if (!isS3Configured()) {
    console.log('   ⬜ S3 not configured, skipping DB rebuild');
    return;
  }

  const { dbAll, dbRun } = await import('./db/database.js');
  const existingPhotos = dbAll('SELECT COUNT(*) as count FROM photos');
  const count = existingPhotos[0]?.count || 0;

  if (count > 0) {
    console.log(`   ✅ Database has ${count} photos, skipping rebuild`);
    return;
  }

  console.log('   🔄 Database empty — rebuilding from S3...');
  try {
    const s3Photos = await listS3Photos('photos/');
    console.log(`   📦 Found ${s3Photos.length} photos in S3`);

    for (const photo of s3Photos) {
      const photoId = photo.filename.replace(/\.[^.]+$/, ''); // strip extension
      dbRun(
        `INSERT OR IGNORE INTO photos (id, filename, s3_key, s3_url, local_path, face_ids) VALUES (?, ?, ?, ?, ?, ?)`,
        [photoId, photo.filename, photo.key, photo.url, null, '[]']
      );
    }

    console.log(`   ✅ Rebuilt ${s3Photos.length} photo records from S3`);
  } catch (err) {
    console.error('   ❌ S3 rebuild failed:', err.message);
  }
}

// ── Initialize & Start ──
async function start() {
  await initDB();
  await rebuildPhotosFromS3();

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
