import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dbRun, dbAll, dbGet } from '../db/database.js';
import { indexFace, createCollection, isRekognitionConfigured } from '../services/rekognitionService.js';
import { uploadToS3, isS3Configured } from '../services/s3Service.js';
import { transcribeVideo, isWhisperConfigured } from '../services/transcriptionService.js';
import { analyzeTranscript, parseTime, isGeminiConfigured } from '../services/analysisService.js';
import { trimVideo, generateThumbnail, getVideoInfo } from '../services/videoService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '..', 'uploads');
const tempDir = path.join(__dirname, '..', 'temp');

[uploadDir, tempDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const photosDir = path.join(uploadDir, 'photos');
    if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
    cb(null, photosDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const videosDir = path.join(uploadDir, 'videos');
    if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
    cb(null, videosDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const uploadPhotos = multer({
  storage: photoStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});

// ───────────────────────────────────────────────
// POST /api/admin/upload-photos
// ───────────────────────────────────────────────
router.post('/upload-photos', uploadPhotos.array('photos', 1000), async (req, res) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No photos uploaded' });
    }

    console.log(`\n📸 Processing ${files.length} photos...`);
    const results = [];

    for (const file of files) {
      const photoId = path.basename(file.filename, path.extname(file.filename));
      let s3Key = null;
      let s3Url = null;
      let faceIds = [];

      if (isS3Configured()) {
        try {
          s3Key = `photos/${file.filename}`;
          s3Url = await uploadToS3(file.path, s3Key, file.mimetype);
        } catch (err) {
          console.warn(`  ⚠️ S3 upload failed for ${file.originalname}: ${err.message}`);
          s3Key = null;
          s3Url = null;
        }
      }

      if (isRekognitionConfigured()) {
        try {
          faceIds = await indexFace(file.path, photoId);
        } catch (err) {
          console.warn(`  ⚠️ Face indexing failed for ${file.originalname}: ${err.message}`);
        }
      }

      const localUrl = `/uploads/photos/${file.filename}`;
      dbRun(
        `INSERT INTO photos (id, filename, s3_key, s3_url, local_path, face_ids) VALUES (?, ?, ?, ?, ?, ?)`,
        [photoId, file.originalname, s3Key, s3Url, localUrl, JSON.stringify(faceIds)]
      );

      results.push({
        id: photoId,
        filename: file.originalname,
        facesIndexed: faceIds.length,
        url: s3Url || localUrl,
      });
    }

    res.json({ success: true, processed: results.length, results });
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────
// POST /api/admin/upload-video
// ───────────────────────────────────────────────
router.post('/upload-video', uploadVideo.single('video'), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'No video uploaded' });
  }

  const videoId = path.basename(file.filename, path.extname(file.filename));
  console.log(`\n🎬 Processing video: ${file.originalname} (ID: ${videoId})`);

  dbRun(
    `INSERT INTO source_videos (id, filename, local_path, status) VALUES (?, ?, ?, 'uploaded')`,
    [videoId, file.originalname, file.path]
  );

  // Send immediate response
  res.json({
    success: true,
    videoId,
    filename: file.originalname,
    status: 'processing',
    message: 'Video uploaded. Processing started in background.',
  });

  // Background processing
  processVideo(videoId, file).catch((err) => {
    console.error(`❌ Video processing failed for ${videoId}:`, err);
    dbRun(`UPDATE source_videos SET status = 'error', error_message = ? WHERE id = ?`, [err.message, videoId]);
  });
});

async function processVideo(videoId, file) {
  const snippetsDir = path.join(uploadDir, 'snippets');
  const thumbsDir = path.join(uploadDir, 'thumbnails');

  [snippetsDir, thumbsDir].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  try {
    // Step 1: Get video info
    const videoInfo = await getVideoInfo(file.path);
    console.log(`  📊 Duration: ${Math.round(videoInfo.duration)}s, Resolution: ${videoInfo.width}x${videoInfo.height}`);

    // Step 2: Transcribe
    dbRun(`UPDATE source_videos SET status = 'transcribing' WHERE id = ?`, [videoId]);
    let transcript;

    if (isWhisperConfigured()) {
      transcript = await transcribeVideo(file.path, tempDir);
    } else {
      console.warn('  ⚠️ Whisper not configured, using placeholder');
      transcript = {
        text: 'Whisper API not configured. Please set OPENAI_API_KEY in .env',
        segments: [],
        duration: videoInfo.duration,
      };
    }

    dbRun(`UPDATE source_videos SET transcript = ?, status = 'analyzing' WHERE id = ?`, [JSON.stringify(transcript), videoId]);

    // Step 3: Analyze
    let analysis;
    if (isGeminiConfigured() && transcript.segments.length > 0) {
      analysis = await analyzeTranscript(transcript.text, transcript.segments, videoInfo.duration);
    } else {
      console.warn('  ⚠️ Gemini not configured or no segments, using placeholder');
      analysis = {
        type: 'keynote',
        reasoning: 'Default classification — Gemini API not configured',
        snippets: [],
      };
    }

    dbRun(`UPDATE source_videos SET type = ?, status = 'trimming' WHERE id = ?`, [analysis.type, videoId]);
    console.log(`  📋 Classified as: ${analysis.type} (${analysis.reasoning})`);

    // Step 4: Trim snippets
    for (let i = 0; i < analysis.snippets.length; i++) {
      const snippet = analysis.snippets[i];
      const snippetId = uuidv4();
      const clipFilename = `${snippetId}.mp4`;
      const clipPath = path.join(snippetsDir, clipFilename);
      const thumbFilename = `${snippetId}.jpg`;

      try {
        const { duration } = await trimVideo(file.path, snippet.start_time, snippet.end_time, clipPath);

        const startSec = parseTime(snippet.start_time);
        const endSec = parseTime(snippet.end_time);
        const midpoint = (startSec + endSec) / 2;
        await generateThumbnail(file.path, midpoint, thumbsDir, thumbFilename);

        let s3Key = null, s3Url = null, thumbS3Key = null, thumbUrl = null;
        if (isS3Configured()) {
          s3Key = `snippets/${clipFilename}`;
          s3Url = await uploadToS3(clipPath, s3Key, 'video/mp4');
          thumbS3Key = `thumbnails/${thumbFilename}`;
          thumbUrl = await uploadToS3(path.join(thumbsDir, thumbFilename), thumbS3Key, 'image/jpeg');
        }

        const localClipUrl = `/uploads/snippets/${clipFilename}`;
        const localThumbUrl = `/uploads/thumbnails/${thumbFilename}`;

        dbRun(
          `INSERT INTO snippets (id, type, title, description, speaker_name, s3_key, s3_url, local_path, thumbnail_s3_key, thumbnail_url, thumbnail_local_path, duration_seconds, start_time, end_time, source_video_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [snippetId, analysis.type, snippet.title, snippet.description,
           snippet.speaker_name || 'Speaker', s3Key, s3Url, localClipUrl,
           thumbS3Key, thumbUrl, localThumbUrl, duration,
           snippet.start_time, snippet.end_time, videoId]
        );

        console.log(`  ✅ Snippet ${i + 1}/${analysis.snippets.length}: "${snippet.title}"`);
      } catch (err) {
        console.error(`  ❌ Snippet ${i + 1} failed: ${err.message}`);
      }
    }

    dbRun(`UPDATE source_videos SET status = 'complete', processed_at = CURRENT_TIMESTAMP WHERE id = ?`, [videoId]);
    console.log(`\n🎉 Video processing complete: ${file.originalname}`);
  } catch (err) {
    dbRun(`UPDATE source_videos SET status = 'error', error_message = ? WHERE id = ?`, [err.message, videoId]);
    throw err;
  }
}

// ───────────────────────────────────────────────
// POST /api/admin/init-collection
// ───────────────────────────────────────────────
router.post('/init-collection', async (req, res) => {
  try {
    if (!isRekognitionConfigured()) {
      return res.status(400).json({ error: 'AWS credentials not configured' });
    }
    const result = await createCollection();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────
// GET /api/admin/status
// ───────────────────────────────────────────────
router.get('/status', (req, res) => {
  const photos = dbGet('SELECT COUNT(*) as count FROM photos');
  const videos = dbAll('SELECT id, filename, type, status, error_message, uploaded_at, processed_at FROM source_videos ORDER BY uploaded_at DESC');
  const snippetCounts = dbAll('SELECT COUNT(*) as count, type FROM snippets GROUP BY type');

  res.json({
    photos: { total: photos?.count || 0 },
    videos,
    snippets: snippetCounts.reduce((acc, s) => { acc[s.type] = s.count; return acc; }, {}),
    services: {
      s3: isS3Configured(),
      rekognition: isRekognitionConfigured(),
      whisper: isWhisperConfigured(),
      gemini: isGeminiConfigured(),
    },
  });
});

// ───────────────────────────────────────────────
// DELETE /api/admin/reset
// ───────────────────────────────────────────────
router.delete('/reset', (req, res) => {
  dbRun('DELETE FROM snippets');
  dbRun('DELETE FROM photos');
  dbRun('DELETE FROM source_videos');

  const dirs = ['photos', 'videos', 'snippets', 'thumbnails'];
  dirs.forEach((dir) => {
    const dirPath = path.join(uploadDir, dir);
    if (fs.existsSync(dirPath)) {
      fs.readdirSync(dirPath).forEach((f) => fs.unlinkSync(path.join(dirPath, f)));
    }
  });

  res.json({ success: true, message: 'All data reset' });
});

export default router;
