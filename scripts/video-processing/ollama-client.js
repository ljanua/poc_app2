'use strict';

const { getOllamaBaseUrl, getOllamaVideoModel } = require('./config');
const { logAuditEvent } = require('./audit-logger');

function buildAssessmentPrompt({ sportType, situation, ageOfPlayer, skillFocusList }) {
  const skills = skillFocusList.length ? skillFocusList.join(', ') : 'General';
  return [
    'Review this video for sport:',
    String(sportType).trim(),
    'and consider the situation:',
    String(situation).trim(),
    'for a player at the age of:',
    String(ageOfPlayer).trim(),
    'and provide me ratings from 0.00 to 0.99 for the following skills:',
    String(skills).trim() + '.',
    'Include a comments field with a brief comments about what you observed in the video.',
    'Respond with JSON only in this shape:',
    '{"ratings":[{"skill":"Skill Name","rating":0.75}],"comments":"brief observation about the video"}'
  ].join(' ');
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch (innerError) {
        return null;
      }
    }
    return null;
  }
}

function normalizeRating(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (parsed < 0) {
    return 0;
  }
  if (parsed > 0.99) {
    return 0.99;
  }
  return Math.round(parsed * 100) / 100;
}

function extractComments(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return '';
  }
  if (parsed.comments != null && String(parsed.comments).trim()) {
    return String(parsed.comments).trim();
  }
  // Legacy models may still return summary instead of comments.
  if (parsed.summary != null && String(parsed.summary).trim()) {
    return String(parsed.summary).trim();
  }
  return '';
}

function parseRatingsFromResponse(content, skillFocusList) {
  const parsed = extractJsonObject(content);
  const ratings = {};
  const list = Array.isArray(parsed && parsed.ratings) ? parsed.ratings : [];
  const comments = extractComments(parsed);

  list.forEach((entry) => {
    const skill = String(entry.skill || '').trim();
    const rating = normalizeRating(entry.rating);
    if (!skill || rating == null) {
      return;
    }
    ratings[skill.toLowerCase()] = { skill, rating };
  });

  if (!skillFocusList.length) {
    return { ratings, comments };
  }

  const focused = {};
  skillFocusList.forEach((skillName) => {
    const key = String(skillName).toLowerCase();
    if (ratings[key]) {
      focused[skillName] = ratings[key].rating;
      return;
    }
    const fuzzy = Object.values(ratings).find((entry) => entry.skill.toLowerCase() === key);
    if (fuzzy) {
      focused[skillName] = fuzzy.rating;
    }
  });

  return {
    ratings: focused,
    comments
  };
}

async function reviewSegment(pool, context, frameBase64Images) {
  const baseUrl = (await getOllamaBaseUrl(pool)).replace(/\/$/, '');
  const model = await getOllamaVideoModel(pool);
  const prompt = buildAssessmentPrompt(context);
  const skillCount = Array.isArray(context.skillFocusList) ? context.skillFocusList.length : 0;
  const frameCount = Array.isArray(frameBase64Images) ? frameBase64Images.length : 0;

  logAuditEvent('ollama.request', { model, skillCount, frameCount });
  const startedAt = Date.now();

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{
          role: 'user',
          content: prompt,
          images: frameBase64Images
        }]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      logAuditEvent('ollama.error', {
        model,
        status: response.status,
        error: body.slice(0, 200)
      });
      throw new Error(`Ollama request failed (${response.status}): ${body}`);
    }

    const payload = await response.json();
    const content = payload && payload.message && payload.message.content
      ? payload.message.content
      : '';
    const parsed = parseRatingsFromResponse(content, context.skillFocusList);
    logAuditEvent('ollama.response', {
      model,
      durationMs: Date.now() - startedAt,
      parsedRatingCount: Object.keys(parsed.ratings || {}).length
    });
    return parsed;
  } catch (error) {
    if (!String(error.message || '').startsWith('Ollama request failed')) {
      logAuditEvent('ollama.error', {
        model,
        error: error && error.message ? error.message : String(error)
      });
    }
    throw error;
  }
}

module.exports = {
  buildAssessmentPrompt,
  parseRatingsFromResponse,
  reviewSegment
};
