'use strict';

function countRatedSkills(skillFocusList, ratingsBySkill) {
  return skillFocusList.filter((skill) => ratingsBySkill[skill] != null).length;
}

function majorityThreshold(skillCount) {
  if (skillCount <= 0) {
    return 1;
  }
  return Math.floor(skillCount / 2) + 1;
}

function halfThreshold(skillCount) {
  if (skillCount <= 0) {
    return 1;
  }
  return Math.ceil(skillCount / 2);
}

function shouldStopAssessing(skillFocusList, ratingsBySkill, segmentIndex) {
  const total = skillFocusList.length || 1;
  const rated = countRatedSkills(skillFocusList, ratingsBySkill);
  if (rated >= majorityThreshold(total)) {
    return true;
  }
  if (segmentIndex >= 1 && rated >= halfThreshold(total)) {
    return true;
  }
  return false;
}

function mergeSegmentRatings(existingRatings, segmentRatings) {
  const merged = { ...existingRatings };
  Object.entries(segmentRatings || {}).forEach(([skill, rating]) => {
    if (merged[skill] == null && rating != null) {
      merged[skill] = rating;
    }
  });
  return merged;
}

function computeOverallScore(ratingsBySkill) {
  const values = Object.values(ratingsBySkill).filter((value) => value != null);
  if (!values.length) {
    return null;
  }
  const sum = values.reduce((acc, value) => acc + Number(value), 0);
  return Math.round((sum / values.length) * 100) / 100;
}

function buildSummary(skillRatings, extraSummary) {
  const parts = [];
  if (extraSummary) {
    parts.push(String(extraSummary).trim());
  }
  const ratingLines = Object.entries(skillRatings)
    .map(([skill, rating]) => `${skill}: ${Number(rating).toFixed(2)}`);
  if (ratingLines.length) {
    parts.push('Skill ratings — ' + ratingLines.join(', '));
  }
  return parts.join(' ').trim();
}

module.exports = {
  shouldStopAssessing,
  mergeSegmentRatings,
  computeOverallScore,
  buildSummary
};
