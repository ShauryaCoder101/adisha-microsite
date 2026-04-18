import { Router } from 'express';
import { dbAll, dbGet } from '../db/database.js';

const router = Router();

// ───────────────────────────────────────────────
// GET /api/snippets?type=keynote|panel
// ───────────────────────────────────────────────
router.get('/', (req, res) => {
  const { type } = req.query;

  let snippets;
  if (type && ['keynote', 'panel'].includes(type)) {
    snippets = dbAll('SELECT * FROM snippets WHERE type = ? ORDER BY created_at ASC', [type]);
  } else {
    snippets = dbAll('SELECT * FROM snippets ORDER BY type, created_at ASC');
  }

  const results = snippets.map((s) => ({
    id: s.id,
    type: s.type,
    title: s.title,
    description: s.description,
    speakerName: s.speaker_name,
    videoUrl: s.s3_url || s.local_path,
    thumbnailUrl: s.thumbnail_url || s.thumbnail_local_path,
    durationSeconds: s.duration_seconds,
    startTime: s.start_time,
    endTime: s.end_time,
    createdAt: s.created_at,
  }));

  res.json({ success: true, type: type || 'all', total: results.length, snippets: results });
});

// ───────────────────────────────────────────────
// GET /api/snippets/:id
// ───────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const snippet = dbGet('SELECT * FROM snippets WHERE id = ?', [req.params.id]);

  if (!snippet) {
    return res.status(404).json({ error: 'Snippet not found' });
  }

  res.json({
    success: true,
    snippet: {
      id: snippet.id,
      type: snippet.type,
      title: snippet.title,
      description: snippet.description,
      speakerName: snippet.speaker_name,
      videoUrl: snippet.s3_url || snippet.local_path,
      thumbnailUrl: snippet.thumbnail_url || snippet.thumbnail_local_path,
      durationSeconds: snippet.duration_seconds,
      startTime: snippet.start_time,
      endTime: snippet.end_time,
    },
  });
});

export default router;
