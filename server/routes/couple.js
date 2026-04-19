import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dbRun, dbAll, dbGet } from '../db/database.js';
import { searchFaces, isRekognitionConfigured } from '../services/rekognitionService.js';
import { getPresignedUrl, uploadBufferToS3, listS3Photos } from '../services/s3Service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

const profileDir = path.join(__dirname, '..', 'uploads', 'profiles');
if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, profileDir),
    filename: (req, file, cb) => {
      const name = req.body.name?.toLowerCase() || 'unknown';
      const ext = path.extname(file.originalname);
      cb(null, `${name}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ───────────────────────────────────────────────
// POST /api/couple/set-profile
// Upload a selfie for Aditya or Disha, run face search, cache results
// ───────────────────────────────────────────────
router.post('/set-profile', upload.single('selfie'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !req.file) {
      return res.status(400).json({ error: 'Name and selfie are required' });
    }

    if (!isRekognitionConfigured()) {
      return res.status(400).json({ error: 'Rekognition not configured' });
    }

    console.log(`\n💑 Setting couple profile for: ${name}`);

    // Search for this face in all indexed photos
    const imageBuffer = fs.readFileSync(req.file.path);
    const matches = await searchFaces(imageBuffer, 80, 100);
    console.log(`  Found ${matches.length} face matches for ${name}`);

    // Get unique photo IDs from matches
    const matchedPhotoIds = [...new Set(matches.map((m) => m.externalImageId))];

    // Upload selfie to S3 for persistence
    const s3SelfieKey = `profiles/${name.toLowerCase()}${path.extname(req.file.originalname)}`;
    let s3SelfieUrl = null;
    try {
      s3SelfieUrl = await uploadBufferToS3(imageBuffer, s3SelfieKey, req.file.mimetype);
      console.log(`  Selfie uploaded to S3: ${s3SelfieKey}`);
    } catch (err) {
      console.error(`  S3 selfie upload failed: ${err.message}`);
    }

    // Save matched photo IDs as a JSON file on S3 for persistence
    const matchDataKey = `profiles/${name.toLowerCase()}_matches.json`;
    try {
      const matchData = JSON.stringify({ name, matchedPhotoIds, updatedAt: new Date().toISOString() });
      await uploadBufferToS3(Buffer.from(matchData), matchDataKey, 'application/json');
      console.log(`  Match data saved to S3: ${matchDataKey}`);
    } catch (err) {
      console.error(`  S3 match data save failed: ${err.message}`);
    }

    // Upsert the profile in SQLite
    const selfiePath = s3SelfieUrl || `/uploads/profiles/${req.file.filename}`;
    const existing = dbGet('SELECT * FROM couple_profiles WHERE id = ?', [name.toLowerCase()]);
    if (existing) {
      dbRun(
        'UPDATE couple_profiles SET name = ?, selfie_path = ?, matched_photo_ids = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, selfiePath, JSON.stringify(matchedPhotoIds), name.toLowerCase()]
      );
    } else {
      dbRun(
        'INSERT INTO couple_profiles (id, name, selfie_path, matched_photo_ids) VALUES (?, ?, ?, ?)',
        [name.toLowerCase(), name, selfiePath, JSON.stringify(matchedPhotoIds)]
      );
    }

    res.json({
      success: true,
      name,
      matchedPhotos: matchedPhotoIds.length,
      message: `Found ${matchedPhotoIds.length} photos of ${name}`,
    });
  } catch (err) {
    console.error('Couple profile error:', err);

    if (err.name === 'InvalidParameterException') {
      return res.status(400).json({
        error: 'No face detected in the uploaded image. Please try with a clearer photo.',
      });
    }

    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────
// GET /api/couple/profiles
// Get all couple profiles (for admin)
// ───────────────────────────────────────────────
router.get('/profiles', (req, res) => {
  const profiles = dbAll('SELECT * FROM couple_profiles');
  res.json({
    profiles: profiles.map((p) => ({
      id: p.id,
      name: p.name,
      selfiePath: p.selfie_path,
      matchedPhotos: JSON.parse(p.matched_photo_ids || '[]').length,
      updatedAt: p.updated_at,
    })),
  });
});

// ───────────────────────────────────────────────
// GET /api/couple/photos
// Get all photos where either Aditya or Disha appear (served from DB cache)
// ───────────────────────────────────────────────
router.get('/photos', async (req, res) => {
  try {
    const profiles = dbAll('SELECT * FROM couple_profiles');

    if (profiles.length === 0) {
      return res.json({ success: true, photos: [], message: 'No couple profiles set yet' });
    }

    // Combine all matched photo IDs from both profiles
    const allPhotoIds = new Set();
    profiles.forEach((p) => {
      const ids = JSON.parse(p.matched_photo_ids || '[]');
      ids.forEach((id) => allPhotoIds.add(id));
    });

    if (allPhotoIds.size === 0) {
      return res.json({ success: true, photos: [], message: 'No matching photos found' });
    }

    const idArray = [...allPhotoIds];
    const placeholders = idArray.map(() => '?').join(',');
    const photos = dbAll(`SELECT * FROM photos WHERE id IN (${placeholders})`, idArray);

    // Use direct S3 URLs (bucket has public read policy)
    const results = photos.map((photo) => ({
      id: photo.id,
      filename: photo.filename,
      url: photo.s3_url || photo.local_path,
    }));

    res.json({ success: true, photos: results, total: results.length });
  } catch (err) {
    console.error('Couple photos error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
