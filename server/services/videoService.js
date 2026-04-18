import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

/**
 * Trim a video clip between start and end timestamps
 * @param {string} inputPath - Path to source video
 * @param {string} startTime - Start time (HH:MM:SS or seconds)
 * @param {string} endTime - End time (HH:MM:SS or seconds)
 * @param {string} outputPath - Path for the trimmed output
 * @returns {Promise<{outputPath: string, duration: number}>}
 */
export function trimVideo(inputPath, startTime, endTime, outputPath) {
  return new Promise((resolve, reject) => {
    const startSeconds = typeof startTime === 'string' ? parseTimeToSeconds(startTime) : startTime;
    const endSeconds = typeof endTime === 'string' ? parseTimeToSeconds(endTime) : endTime;
    const duration = endSeconds - startSeconds;

    ffmpeg(inputPath)
      .setStartTime(startSeconds)
      .setDuration(duration)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-preset fast', '-crf 23', '-movflags +faststart'])
      .output(outputPath)
      .on('start', (cmd) => {
        console.log(`  ✂️  Trimming: ${startTime} → ${endTime}`);
      })
      .on('end', () => {
        console.log(`  ✅ Clip saved: ${path.basename(outputPath)}`);
        resolve({ outputPath, duration });
      })
      .on('error', (err) => {
        console.error(`  ❌ Trim failed: ${err.message}`);
        reject(err);
      })
      .run();
  });
}

/**
 * Generate a thumbnail from a video at a specific timestamp
 * @param {string} videoPath - Path to the video
 * @param {number|string} timestamp - Time position for the thumbnail
 * @param {string} outputDir - Directory to save the thumbnail
 * @param {string} filename - Output filename
 * @returns {Promise<string>} Path to the generated thumbnail
 */
export function generateThumbnail(videoPath, timestamp, outputDir, filename) {
  return new Promise((resolve, reject) => {
    const seconds = typeof timestamp === 'string' ? parseTimeToSeconds(timestamp) : timestamp;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    ffmpeg(videoPath)
      .screenshots({
        timestamps: [seconds],
        filename: filename,
        folder: outputDir,
        size: '640x360',
      })
      .on('end', () => {
        const thumbPath = path.join(outputDir, filename);
        console.log(`  🖼️  Thumbnail: ${filename}`);
        resolve(thumbPath);
      })
      .on('error', (err) => {
        console.error(`  ❌ Thumbnail failed: ${err.message}`);
        reject(err);
      });
  });
}

/**
 * Get video metadata (duration, resolution, etc.)
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<Object>} Video metadata
 */
export function getVideoInfo(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
      const audioStream = metadata.streams.find((s) => s.codec_type === 'audio');
      resolve({
        duration: metadata.format.duration,
        width: videoStream?.width,
        height: videoStream?.height,
        fps: videoStream?.r_frame_rate,
        hasAudio: !!audioStream,
        format: metadata.format.format_name,
        size: metadata.format.size,
      });
    });
  });
}

/**
 * Parse time string "HH:MM:SS" or "MM:SS" to seconds
 */
function parseTimeToSeconds(timeStr) {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}
