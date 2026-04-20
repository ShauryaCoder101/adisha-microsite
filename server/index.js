import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import express from 'express';
import cors from 'cors';
import { initDB, dbAll, dbRun } from './db/database.js';
import adminRoutes from './routes/admin.js';
import faceSearchRoutes from './routes/faceSearch.js';
import snippetsRoutes from './routes/snippets.js';
import coupleRoutes from './routes/couple.js';

import { isS3Configured, listS3Photos, uploadBufferToS3, getS3Client, getBucket } from './services/s3Service.js';
import { searchFaces, isRekognitionConfigured } from './services/rekognitionService.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';

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

/**
 * Rebuild couple profiles from S3 on startup.
 * Reads the match JSON files saved by set-profile and restores them.
 */
async function rebuildCoupleProfilesFromS3() {
  if (!isS3Configured()) return;

  const existingProfiles = dbAll('SELECT COUNT(*) as count FROM couple_profiles');
  const count = existingProfiles[0]?.count || 0;

  if (count > 0) {
    console.log(`   ✅ Couple profiles: ${count} profiles loaded`);
    return;
  }

  console.log('   🔄 Rebuilding couple profiles from S3...');
  try {
    const profileFiles = await listS3Photos('profiles/');
    const matchFiles = profileFiles.filter(f => f.filename.endsWith('_matches.json'));

    if (matchFiles.length > 0) {
      // ── Strategy 1: Restore from cached match-data JSON files ──
      for (const file of matchFiles) {
        try {
          const response = await getS3Client().send(new GetObjectCommand({ Bucket: getBucket(), Key: file.key }));
          const body = await response.Body.transformToString();
          const data = JSON.parse(body);

          const nameId = data.name.toLowerCase();
          const selfieFile = profileFiles.find(f => f.filename.startsWith(nameId) && !f.filename.endsWith('.json'));
          const selfiePath = selfieFile ? selfieFile.url : null;

          dbRun(
            'INSERT OR IGNORE INTO couple_profiles (id, name, selfie_path, matched_photo_ids) VALUES (?, ?, ?, ?)',
            [nameId, data.name, selfiePath, JSON.stringify(data.matchedPhotoIds)]
          );
          console.log(`   ✅ Restored profile: ${data.name} (${data.matchedPhotoIds.length} matches)`);
        } catch (err) {
          console.error(`   ❌ Failed to restore profile from ${file.key}:`, err.message);
        }
      }
    } else {
      // ── Strategy 2: Re-run Rekognition face matching from selfie images on S3 ──
      console.log('   ⚠️  No match data JSONs found — attempting face re-match from selfie images...');
      const selfieImages = profileFiles.filter(f => !f.filename.endsWith('.json'));

      if (selfieImages.length > 0 && isRekognitionConfigured()) {
        for (const selfie of selfieImages) {
          try {
            const nameFromFile = selfie.filename.replace(/\.[^.]+$/, '');
            const name = nameFromFile.charAt(0).toUpperCase() + nameFromFile.slice(1);

            // Download selfie image from S3
            const response = await getS3Client().send(new GetObjectCommand({ Bucket: getBucket(), Key: selfie.key }));
            const chunks = [];
            for await (const chunk of response.Body) {
              chunks.push(chunk);
            }
            const imageBuffer = Buffer.concat(chunks);

            // Run Rekognition face search against indexed photos
            const matches = await searchFaces(imageBuffer, 80, 100);
            const matchedPhotoIds = [...new Set(matches.map(m => m.externalImageId))];

            // Persist to SQLite
            dbRun(
              'INSERT OR IGNORE INTO couple_profiles (id, name, selfie_path, matched_photo_ids) VALUES (?, ?, ?, ?)',
              [nameFromFile, name, selfie.url, JSON.stringify(matchedPhotoIds)]
            );

            // Cache match data back to S3 for faster restores next time
            const matchData = JSON.stringify({ name, matchedPhotoIds, updatedAt: new Date().toISOString() });
            await uploadBufferToS3(Buffer.from(matchData), `profiles/${nameFromFile}_matches.json`, 'application/json');

            console.log(`   ✅ Re-matched profile: ${name} (${matchedPhotoIds.length} photos)`);
          } catch (err) {
            console.error(`   ❌ Failed to re-match from ${selfie.key}:`, err.message);
          }
        }
      } else {
        console.log('   ⬜ No selfie images on S3 or Rekognition not configured — skipping');
      }
    }
  } catch (err) {
    console.error('   ❌ Couple profile rebuild failed:', err.message);
  }
}

// ── Initialize & Start ──
async function start() {
  await initDB();
  await rebuildPhotosFromS3();
  await rebuildCoupleProfilesFromS3();

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
