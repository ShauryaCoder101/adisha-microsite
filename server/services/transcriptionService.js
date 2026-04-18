import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

let openai;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Extract audio from a video file
 * @param {string} videoPath - Path to the video file
 * @param {string} outputDir - Directory to save the audio file
 * @returns {string} Path to the extracted audio file
 */
export function extractAudio(videoPath, outputDir) {
  return new Promise((resolve, reject) => {
    const audioPath = path.join(outputDir, `audio_${Date.now()}.mp3`);

    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .output(audioPath)
      .on('end', () => {
        console.log('  ✅ Audio extracted:', audioPath);
        resolve(audioPath);
      })
      .on('error', (err) => {
        console.error('  ❌ Audio extraction failed:', err.message);
        reject(err);
      })
      .run();
  });
}

/**
 * Transcribe audio using OpenAI Whisper API with timestamps
 * @param {string} audioPath - Path to audio file
 * @returns {Object} Transcription with segments and timestamps
 */
export async function transcribeAudio(audioPath) {
  console.log('  🎙️ Sending audio to Whisper API...');

  const audioFile = fs.createReadStream(audioPath);

  const transcription = await getOpenAI().audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  });

  console.log(`  ✅ Transcription complete: ${transcription.segments?.length || 0} segments`);

  return {
    text: transcription.text,
    segments: transcription.segments?.map((seg) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text,
    })) || [],
    language: transcription.language,
    duration: transcription.duration,
  };
}

/**
 * Full pipeline: extract audio from video and transcribe
 * @param {string} videoPath - Path to video file
 * @param {string} tempDir - Temp directory for intermediate files
 * @returns {Object} Transcription result
 */
export async function transcribeVideo(videoPath, tempDir) {
  // Ensure temp dir exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Step 1: Extract audio
  const audioPath = await extractAudio(videoPath, tempDir);

  try {
    // Step 2: Transcribe
    const result = await transcribeAudio(audioPath);
    return result;
  } finally {
    // Clean up audio file
    try {
      fs.unlinkSync(audioPath);
    } catch (e) {
      // ignore cleanup error
    }
  }
}

/**
 * Check if Whisper API is configured
 */
export function isWhisperConfigured() {
  return !!process.env.OPENAI_API_KEY;
}
