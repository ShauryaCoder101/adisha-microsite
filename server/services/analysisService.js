import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Analyze a transcript to classify the video type and extract best snippets.
 * Uses Gemini 3.1 Pro to intelligently identify keynote vs panel discussions
 * and find the most impactful moments.
 *
 * @param {string} transcript - Full transcript text
 * @param {Array<{start: number, end: number, text: string}>} segments - Timestamped segments
 * @param {number} videoDuration - Total video duration in seconds
 * @returns {Object} { type: 'keynote'|'panel', snippets: [...] }
 */
export async function analyzeTranscript(transcript, segments, videoDuration) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-preview-05-06' });

  const segmentText = segments
    .map((s) => `[${formatTime(s.start)} - ${formatTime(s.end)}] ${s.text}`)
    .join('\n');

  const prompt = `You are an expert video editor and content analyst for a corporate health insurance event (Niva Bupa).

Analyze this timestamped transcript from an event video recording.

TRANSCRIPT WITH TIMESTAMPS:
${segmentText}

TOTAL VIDEO DURATION: ${formatTime(videoDuration)}

Please perform the following analysis and return a JSON response:

1. **CLASSIFY** the video as either:
   - "keynote" — A structured presentation by one or two speakers. Characteristics: single voice dominates, formal tone, structured narrative, slides being discussed.
   - "panel" — A discussion between multiple speakers. Characteristics: multiple voices, Q&A format, conversational tone, moderator present.

2. **EXTRACT SNIPPETS** — Identify the 3-8 most impactful, interesting, or informative segments. For each snippet:
   - Choose segments that are self-contained and make sense standalone
   - Prefer moments with key insights, memorable quotes, important announcements, or engaging discussions
   - Each snippet should be 30 seconds to 3 minutes long
   - Ensure snippets don't overlap

Return ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "type": "keynote" or "panel",
  "classification_reasoning": "Brief explanation of why you classified it this way",
  "snippets": [
    {
      "title": "Descriptive title for this snippet",
      "description": "2-3 sentence summary of what is discussed in this segment",
      "speaker_name": "Name of the main speaker if identifiable, or 'Speaker' if not",
      "start_time": "HH:MM:SS",
      "end_time": "HH:MM:SS",
      "importance": "high/medium"
    }
  ]
}`;

  console.log('  🤖 Sending transcript to Gemini for analysis...');

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  // Parse the JSON response (handle potential markdown fences)
  let parsed;
  try {
    // Try direct parse
    parsed = JSON.parse(responseText);
  } catch {
    // Try extracting from markdown code fence
    const jsonMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      // Try finding JSON object in the text
      const objMatch = responseText.match(/\{[\s\S]*\}/);
      if (objMatch) {
        parsed = JSON.parse(objMatch[0]);
      } else {
        throw new Error('Failed to parse Gemini response as JSON');
      }
    }
  }

  console.log(`  ✅ Analysis complete: type=${parsed.type}, ${parsed.snippets?.length || 0} snippets found`);

  return {
    type: parsed.type,
    reasoning: parsed.classification_reasoning,
    snippets: parsed.snippets || [],
  };
}

/**
 * Format seconds to HH:MM:SS
 */
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Parse HH:MM:SS to seconds
 */
export function parseTime(timeStr) {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

/**
 * Check if Gemini is configured
 */
export function isGeminiConfigured() {
  return !!process.env.GEMINI_API_KEY;
}
