'use strict';

/** Fixed overrides (Feature 037). Keys are lowercase skill names. */
const ABBREVIATION_OVERRIDES = {
  'ball control': 'BCN',
  fitness: 'FIT',
  'game awareness': 'AWR',
  passing: 'PAS',
  speed: 'SPD'
};

function normalizeNameKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isLetter(ch) {
  return /^[A-Za-z]$/.test(ch);
}

function isVowel(ch) {
  return /^[AEIOUaeiou]$/.test(ch);
}

function tokenizeSkillName(name) {
  return String(name || '')
    .trim()
    .split(/[\s/\u2013\u2014\-]+/)
    .map(function (part) {
      return part.replace(/[^A-Za-z0-9]/g, '');
    })
    .filter(Boolean);
}

function consonantsAfterFirst(token) {
  const chars = String(token || '');
  let out = '';
  for (let i = 1; i < chars.length; i++) {
    const ch = chars[i];
    if (isLetter(ch) && !isVowel(ch)) {
      out += ch.toUpperCase();
    }
  }
  return out;
}

/**
 * Suggest a 1–3 character uppercase abbreviation for a skill name.
 * Overrides win for the five confirmed catalog codes.
 */
function suggestSkillAbbreviation(name) {
  const key = normalizeNameKey(name);
  if (ABBREVIATION_OVERRIDES[key]) {
    return ABBREVIATION_OVERRIDES[key];
  }

  const tokens = tokenizeSkillName(name);
  if (!tokens.length) {
    return '';
  }

  let abbr = '';
  if (tokens.length >= 2) {
    for (let i = 0; i < Math.min(3, tokens.length); i++) {
      abbr += tokens[i].charAt(0).toUpperCase();
    }
    const last = tokens[tokens.length - 1];
    const pad = consonantsAfterFirst(last);
    let pi = 0;
    while (abbr.length < 3 && pi < pad.length) {
      abbr += pad.charAt(pi);
      pi += 1;
    }
  } else {
    const word = tokens[0];
    abbr = word.charAt(0).toUpperCase();
    const pad = consonantsAfterFirst(word);
    let pi = 0;
    while (abbr.length < 3 && pi < pad.length) {
      abbr += pad.charAt(pi);
      pi += 1;
    }
    if (abbr.length < 3) {
      abbr = word.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
    }
  }

  return String(abbr || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3);
}

function normalizeSkillAbbreviation(value, fallbackName) {
  let abbr = String(value == null ? '' : value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3);
  if (!abbr && fallbackName) {
    abbr = suggestSkillAbbreviation(fallbackName);
  }
  return abbr;
}

function validateSkillAbbreviation(value) {
  const abbr = String(value == null ? '' : value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (abbr.length < 1 || abbr.length > 3) {
    return 'Skill abbreviation must be 1-3 letters or digits.';
  }
  return null;
}

module.exports = {
  ABBREVIATION_OVERRIDES,
  suggestSkillAbbreviation,
  normalizeSkillAbbreviation,
  validateSkillAbbreviation
};
