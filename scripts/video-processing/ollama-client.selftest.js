'use strict';

const {
  isPositionAssigned,
  resolveCoreSkill,
  resolvePositionLabel,
  buildAssessmentPrompt,
  buildSwotRetryPrompt,
  assessmentHasSwot,
  normalizeStringList,
  formatAssessmentComments,
  parseRatingsFromResponse
} = require('./ollama-client');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

assert(isPositionAssigned('Midfielder') === true, 'midfielder assigned');
assert(isPositionAssigned('') === false, 'empty not assigned');
assert(isPositionAssigned('Position not set') === false, 'default label not assigned');
assert(isPositionAssigned('position not set') === false, 'case insensitive');

assert(resolveCoreSkill(['Decision-making', 'Composure']) === 'Decision-making', 'first skill');
assert(resolveCoreSkill([]) === 'General', 'empty focus');

assert(
  resolvePositionLabel({ position: 'Forward', skillFocusList: ['Pace'] }) === 'Forward',
  'use position when set'
);
assert(
  resolvePositionLabel({ position: 'Position not set', skillFocusList: ['Ball Control'] }) === 'Ball Control',
  'fallback to core skill'
);

const promptWithPosition = buildAssessmentPrompt({
  situation: 'Penalty kick under pressure',
  ageOfPlayer: 17,
  skillFocusList: ['Decision-making', 'Composure'],
  position: 'Midfielder',
  coreSkill: 'Decision-making'
});
assert(promptWithPosition.includes('Act as an elite soccer scout'), 'scout opener');
assert(promptWithPosition.includes('Position: Midfielder'), 'position line');
assert(promptWithPosition.includes('STRENGTHS:'), 'strengths section');
assert(promptWithPosition.includes('WEAKNESSES:'), 'weaknesses section');
assert(promptWithPosition.includes('OPPORTUNITIES:'), 'opportunities section');
assert(promptWithPosition.includes('REQUIRED non-empty string arrays'), 'swot required');
assert(
  promptWithPosition.includes('Never put the SWOT analysis only in comments'),
  'forbid comments-only SWOT'
);
assert(
  promptWithPosition.includes('short closing sentence') ||
    promptWithPosition.includes('one-sentence coda'),
  'comments is short coda'
);
assert(promptWithPosition.includes('Penalty kick under pressure'), 'situation');
assert(promptWithPosition.includes('Decision-making, Composure'), 'skills list');

const promptWithoutPosition = buildAssessmentPrompt({
  situation: 'Counter attack',
  ageOfPlayer: 15,
  skillFocusList: ['Ball Control'],
  position: 'Position not set',
  coreSkill: 'Ball Control'
});
assert(promptWithoutPosition.includes('Position: Ball Control'), 'core skill as position');
assert(!promptWithoutPosition.includes('Position not set'), 'no default placeholder');

const retryPrompt = buildSwotRetryPrompt({
  situation: 'Counter attack',
  ageOfPlayer: 15,
  skillFocusList: ['Ball Control'],
  position: 'Midfielder',
  coreSkill: 'Ball Control'
});
assert(retryPrompt.includes('CRITICAL RETRY'), 'retry banner');
assert(retryPrompt.includes('non-empty strengths'), 'retry requires SWOT');

assert(normalizeStringList('one').length === 1, 'string to list');
assert(normalizeStringList(['a', '', 'b']).join('|') === 'a|b', 'array filter');

const formatted = formatAssessmentComments({
  strengths: ['Strong first touch'],
  weaknesses: ['Late pressing trigger'],
  opportunities: ['Rondo under pressure'],
  comments: 'Overall promising.'
});
assert(formatted.includes('STRENGTHS:'), 'format strengths');
assert(formatted.includes('- Strong first touch'), 'format strength bullet');
assert(formatted.includes('WEAKNESSES:'), 'format weaknesses');
assert(formatted.includes('OPPORTUNITIES:'), 'format opportunities');
assert(formatted.includes('Overall promising.'), 'format note');

const parsed = parseRatingsFromResponse(
  JSON.stringify({
    ratings: [{ skill: 'Decision-making', rating: 0.84 }, { skill: 'Composure', rating: 1.2 }],
    strengths: ['Vision in half-spaces'],
    weaknesses: 'Hesitates on cutbacks',
    opportunities: ['Shadow striker rotations', 'Weak-foot finishing'],
    comments: 'High ceiling.'
  }),
  ['Decision-making', 'Composure']
);
assert(parsed.ratings['Decision-making'] === 0.84, 'rating mapped');
assert(parsed.ratings.Composure === 0.99, 'rating clamped');
assert(parsed.comments.includes('STRENGTHS:'), 'parsed comments strengths');
assert(parsed.comments.includes('Hesitates on cutbacks'), 'string weakness normalized');
assert(parsed.strengths.length === 1, 'strengths array');
assert(parsed.weaknesses.length === 1, 'weaknesses array');
assert(parsed.opportunities.length === 2, 'opportunities array');
assert(assessmentHasSwot(parsed) === true, 'full SWOT present');

const legacy = parseRatingsFromResponse(
  JSON.stringify({
    ratings: [{ skill: 'General', rating: 0.5 }],
    comments: 'Brief note only'
  }),
  ['General']
);
assert(legacy.comments === 'Brief note only', 'legacy comments only');
assert(legacy.ratings.General === 0.5, 'legacy rating');
assert(assessmentHasSwot(legacy) === false, 'legacy lacks SWOT');

const { parseEnvBoolean, isVideoProcessingDebugEnabled } = require('./config');
const savedDebug = process.env.DEBUG;
try {
  delete process.env.DEBUG;
  assert(parseEnvBoolean(undefined, false) === false, 'parseEnvBoolean unset');
  assert(isVideoProcessingDebugEnabled() === false, 'DEBUG unset');

  process.env.DEBUG = 'false';
  assert(isVideoProcessingDebugEnabled() === false, 'DEBUG false');
  process.env.DEBUG = '0';
  assert(isVideoProcessingDebugEnabled() === false, 'DEBUG 0');
  process.env.DEBUG = 'no';
  assert(isVideoProcessingDebugEnabled() === false, 'DEBUG no');

  process.env.DEBUG = 'true';
  assert(isVideoProcessingDebugEnabled() === true, 'DEBUG true');
  process.env.DEBUG = '1';
  assert(isVideoProcessingDebugEnabled() === true, 'DEBUG 1');
  process.env.DEBUG = 'ON';
  assert(isVideoProcessingDebugEnabled() === true, 'DEBUG ON');
  process.env.DEBUG = 'yes';
  assert(isVideoProcessingDebugEnabled() === true, 'DEBUG yes');
} finally {
  if (savedDebug === undefined) {
    delete process.env.DEBUG;
  } else {
    process.env.DEBUG = savedDebug;
  }
}

console.log('ollama-client assessment prompt/parse: ok');
