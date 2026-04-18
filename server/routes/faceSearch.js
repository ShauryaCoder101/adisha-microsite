import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { dbAll } from '../db/database.js';
import { searchFaces, isRekognitionConfigured } from '../services/rekognitionService.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ───────────────────────────────────────────────
// POST /api/face-search
// ───────────────────────────────────────────────
router.post('/', upload.single('selfie'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No selfie image uploaded' });
    }

    if (!isRekognitionConfigured()) {
      // Demo mode: return all photos
      const allPhotos = dbAll('SELECT * FROM photos ORDER BY uploaded_at DESC LIMIT 20');
      return res.json({
        success: true,
        mode: 'demo',
        message: 'Rekognition not configured — showing all photos',
        matches: allPhotos.map((p) => ({
          id: p.id,
          filename: p.filename,
          url: p.s3_url || p.local_path,
          confidence: 100,
        })),
      });
    }

    console.log(`\n🔍 Face search from: ${req.file.originalname}`);

    const matches = await searchFaces(req.file.buffer, 80, 50);
    console.log(`  Found ${matches.length} face matches`);

    if (matches.length === 0) {
      return res.json({
        success: true,
        matches: [],
        message: 'No matching photos found. Try uploading a clearer selfie.',
      });
    }

    // Get unique photo IDs
    const matchedPhotoIds = [...new Set(matches.map((m) => m.externalImageId))];
    const placeholders = matchedPhotoIds.map(() => '?').join(',');
    const photos = dbAll(`SELECT * FROM photos WHERE id IN (${placeholders})`, matchedPhotoIds);

    // Map confidence scores
    const confidenceMap = {};
    matches.forEach((m) => {
      if (!confidenceMap[m.externalImageId] || m.confidence > confidenceMap[m.externalImageId]) {
        confidenceMap[m.externalImageId] = m.confidence;
      }
    });

    const results = photos.map((p) => ({
      id: p.id,
      filename: p.filename,
      url: p.s3_url || p.local_path,
      confidence: Math.round(confidenceMap[p.id] || 0),
    }));

    results.sort((a, b) => b.confidence - a.confidence);

    res.json({ success: true, matches: results, total: results.length });
  } catch (err) {
    console.error('Face search error:', err);

    if (err.name === 'InvalidParameterException') {
      return res.status(400).json({
        error: 'No face detected in the uploaded image. Please try with a clearer photo.',
      });
    }

    res.status(500).json({ error: err.message });
  }
});

export default router;
