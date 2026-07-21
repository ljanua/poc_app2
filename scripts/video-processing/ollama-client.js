'use strict';

const { getOllamaBaseUrl, getOllamaVideoModel, isVideoProcessingDebugEnabled } = require('./config');
const { logAuditEvent } = require('./audit-logger');

const DEBUG_RAW_CONTENT_MAX_LEN = 8192;

function isPositionAssigned(position) {
  const value = String(position == null ? '' : position).trim();
  if (!value) {
    return false;
  }
  return value.toLowerCase() !== 'position not set';
}

function resolveCoreSkill(skillFocusList) {
  if (Array.isArray(skillFocusList) && skillFocusList.length) {
    const first = String(skillFocusList[0] || '').trim();
    if (first) {
      return first;
    }
  }
  return 'General';
}

function resolvePositionLabel({ position, skillFocusList, coreSkill }) {
  if (isPositionAssigned(position)) {
    return String(position).trim();
  }
  return coreSkill || resolveCoreSkill(skillFocusList);
}

function buildAssessmentPrompt({
  situation,
  ageOfPlayer,
  skillFocusList,
  position,
  coreSkill
}) {
  const skills = Array.isArray(skillFocusList) && skillFocusList.length
    ? skillFocusList.join(', ')
    : 'General';
  const positionLabel = resolvePositionLabel({ position, skillFocusList, coreSkill });

  return [
    'Act as an elite soccer scout and tactical analyst. I want you to conduct a comprehensive Player Assessment Profile for the following player:',
    `- Position: ${positionLabel}`,
    `- Consider the situation: ${String(situation).trim()} for a player at the age of: ${String(ageOfPlayer).trim()} and`,
    `- Provide ratings from 0.00 to 0.99 for the following skills: ${String(skills).trim()}.`,
    '',
    'Based on this information and your knowledge of modern tactical systems, provide a detailed analysis divided into the following categories:',
    '',
    '1. STRENGTHS: Identify 3-4 core technical, tactical, physical, or mental attributes where this player excels. Explain how these strengths impact the team positively during matches.',
    '2. WEAKNESSES: Identify 2-3 areas that limit the player\'s performance or hold them back from reaching the next level. Frame these as specific technical gaps or decision-making flaws.',
    '3. OPPORTUNITIES: Provide 3 actionable development pathways. Include specific training drills, tactical adjustments, or stylistic shifts that will help the player maximize their potential or adapt to higher levels of competition.',
    '',
    'Keep the tone professional, constructive, and highly analytical, using modern footballing terminology.',
    '',
    'Respond with JSON only. Requirements:',
    '- strengths, weaknesses, and opportunities are REQUIRED non-empty string arrays (put the full analysis there — do not collapse them into comments).',
    '- strengths: 3-4 items; weaknesses: 2-3 items; opportunities: exactly 3 items.',
    '- comments: Provide a short a short closing sentence. Never put the SWOT analysis only in comments.',
    '',
    'JSON shape:',
    '{"ratings":[{"skill":"Skill Name","rating":0.75}],"strengths":["...","...","..."],"weaknesses":["...","..."],"opportunities":["...","...","..."],"comments":"one-sentence coda"}'
  ].join('\n');
}

function buildSwotRetryPrompt(context) {
  return [
    buildAssessmentPrompt(context),
    '',
    'CRITICAL RETRY: Your prior response was incomplete.',
    'Return JSON only with non-empty strengths, weaknesses, and opportunities arrays as specified.',
    'Do not return a single prose comments/summary blob instead of those arrays.'
  ].join('\n');
}

function assessmentHasSwot({ strengths, weaknesses, opportunities }) {
  return (
    normalizeStringList(strengths).length > 0 &&
    normalizeStringList(weaknesses).length > 0 &&
    normalizeStringList(opportunities).length > 0
  );
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

function normalizeStringList(value) {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry == null ? '' : entry).trim())
      .filter(Boolean);
  }
  const asString = String(value).trim();
  return asString ? [asString] : [];
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

function formatAssessmentComments({ strengths, weaknesses, opportunities, comments }) {
  const parts = [];
  const strengthList = normalizeStringList(strengths);
  const weaknessList = normalizeStringList(weaknesses);
  const opportunityList = normalizeStringList(opportunities);
  const note = comments != null ? String(comments).trim() : '';

  if (strengthList.length) {
    parts.push('STRENGTHS:');
    strengthList.forEach((line) => {
      parts.push(`- ${line}`);
    });
  }
  if (weaknessList.length) {
    if (parts.length) {
      parts.push('');
    }
    parts.push('WEAKNESSES:');
    weaknessList.forEach((line) => {
      parts.push(`- ${line}`);
    });
  }
  if (opportunityList.length) {
    if (parts.length) {
      parts.push('');
    }
    parts.push('OPPORTUNITIES:');
    opportunityList.forEach((line) => {
      parts.push(`- ${line}`);
    });
  }
  if (note) {
    if (parts.length) {
      parts.push('');
    }
    parts.push(note);
  }
  return parts.join('\n').trim();
}

function parseRatingsFromResponse(content, skillFocusList) {
  const parsed = extractJsonObject(content);
  const ratings = {};
  const list = Array.isArray(parsed && parsed.ratings) ? parsed.ratings : [];
  const strengths = normalizeStringList(parsed && parsed.strengths);
  const weaknesses = normalizeStringList(parsed && parsed.weaknesses);
  const opportunities = normalizeStringList(parsed && parsed.opportunities);
  const legacyComments = extractComments(parsed);
  const comments = formatAssessmentComments({
    strengths,
    weaknesses,
    opportunities,
    comments: legacyComments
  });

  list.forEach((entry) => {
    const skill = String(entry.skill || '').trim();
    const rating = normalizeRating(entry.rating);
    if (!skill || rating == null) {
      return;
    }
    ratings[skill.toLowerCase()] = { skill, rating };
  });

  if (!skillFocusList.length) {
    return {
      ratings,
      comments,
      strengths,
      weaknesses,
      opportunities
    };
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
    comments,
    strengths,
    weaknesses,
    opportunities
  };
}

function truncateDebugRawContent(content, maxLen) {
  const raw = String(content || '');
  const limit = maxLen || DEBUG_RAW_CONTENT_MAX_LEN;
  if (raw.length <= limit) {
    return raw;
  }
  return raw.slice(0, limit - 1) + '…';
}

function logOllamaResponseDebug(context, model, attempt, swotRetry, rawContent, parsed) {
  if (!isVideoProcessingDebugEnabled()) {
    return;
  }
  logAuditEvent('ollama.response.debug', {
    clipId: context && context.clipId != null ? context.clipId : null,
    segmentIndex: context && context.segmentIndex != null ? context.segmentIndex : null,
    model,
    attempt,
    swotRetry: Boolean(swotRetry),
    rawContent: truncateDebugRawContent(rawContent),
    parsed: {
      ratings: parsed && parsed.ratings ? parsed.ratings : {},
      strengths: parsed && parsed.strengths ? parsed.strengths : [],
      weaknesses: parsed && parsed.weaknesses ? parsed.weaknesses : [],
      opportunities: parsed && parsed.opportunities ? parsed.opportunities : [],
      comments: parsed && parsed.comments ? parsed.comments : ''
    }
  });
}

async function callOllamaChat(baseUrl, model, prompt, frameBase64Images) {
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
    const error = new Error(`Ollama request failed (${response.status}): ${body}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  const payload = await response.json();
  return payload && payload.message && payload.message.content
    ? payload.message.content
    : '';
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
    let content = await callOllamaChat(baseUrl, model, prompt, frameBase64Images);
    let parsed = parseRatingsFromResponse(content, context.skillFocusList);
    let swotRetry = false;
    logOllamaResponseDebug(context, model, 'initial', false, content, parsed);

    if (!assessmentHasSwot(parsed)) {
      logAuditEvent('ollama.swot_incomplete', {
        model,
        strengthCount: (parsed.strengths || []).length,
        weaknessCount: (parsed.weaknesses || []).length,
        opportunityCount: (parsed.opportunities || []).length
      });
      content = await callOllamaChat(baseUrl, model, buildSwotRetryPrompt(context), frameBase64Images);
      parsed = parseRatingsFromResponse(content, context.skillFocusList);
      swotRetry = true;
      logOllamaResponseDebug(context, model, 'retry', true, content, parsed);
      if (!assessmentHasSwot(parsed)) {
        logAuditEvent('ollama.swot_incomplete_after_retry', {
          model,
          strengthCount: (parsed.strengths || []).length,
          weaknessCount: (parsed.weaknesses || []).length,
          opportunityCount: (parsed.opportunities || []).length
        });
      }
    }

    logAuditEvent('ollama.response', {
      model,
      durationMs: Date.now() - startedAt,
      parsedRatingCount: Object.keys(parsed.ratings || {}).length,
      strengthCount: (parsed.strengths || []).length,
      weaknessCount: (parsed.weaknesses || []).length,
      opportunityCount: (parsed.opportunities || []).length,
      swotRetry
    });
    return parsed;
  } catch (error) {
    if (!String(error.message || '').startsWith('Ollama request failed')) {
      logAuditEvent('ollama.error', {
        model,
        error: error && error.message ? error.message : String(error)
      });
    } else {
      logAuditEvent('ollama.error', {
        model,
        status: error.status,
        error: String(error.body || error.message || '').slice(0, 200)
      });
    }
    throw error;
  }
}

module.exports = {
  isPositionAssigned,
  resolveCoreSkill,
  resolvePositionLabel,
  buildAssessmentPrompt,
  buildSwotRetryPrompt,
  assessmentHasSwot,
  normalizeStringList,
  formatAssessmentComments,
  parseRatingsFromResponse,
  reviewSegment
};
