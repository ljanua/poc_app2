'use strict';

/**
 * Event-sourced minutes from starters + substitution timeline.
 * substitutions: [{ minute, playerOutId, playerInId }] sorted by minute then array order.
 * Returns { [playerId]: minutes } for every player who was on the pitch.
 */
function computeMinutesFromSheet({ durationMinutes, starterIds, substitutions }) {
  const duration = Math.max(0, Math.round(Number(durationMinutes) || 0));
  const starters = Array.isArray(starterIds)
    ? starterIds.map((id) => String(id)).filter(Boolean)
    : [];
  const subs = Array.isArray(substitutions) ? substitutions.slice() : [];

  subs.sort(function (a, b) {
    const ma = Number(a.minute);
    const mb = Number(b.minute);
    if (ma !== mb) {
      return ma - mb;
    }
    return (Number(a.seq) || 0) - (Number(b.seq) || 0);
  });

  const onPitch = new Set(starters);
  const intervals = {}; // playerId -> [{ start, end }]

  function ensure(playerId) {
    if (!intervals[playerId]) {
      intervals[playerId] = [];
    }
  }

  starters.forEach(function (playerId) {
    ensure(playerId);
    intervals[playerId].push({ start: 0, end: null });
  });

  function closeOpen(playerId, atMinute) {
    const list = intervals[playerId];
    if (!list || !list.length) {
      return;
    }
    const last = list[list.length - 1];
    if (last.end === null) {
      last.end = atMinute;
    }
  }

  function openInterval(playerId, atMinute) {
    ensure(playerId);
    intervals[playerId].push({ start: atMinute, end: null });
  }

  for (let i = 0; i < subs.length; i += 1) {
    const sub = subs[i];
    const minute = Math.max(0, Math.min(duration, Math.round(Number(sub.minute) || 0)));
    const outId = String(sub.playerOutId || '').trim();
    const inId = String(sub.playerInId || '').trim();
    if (!outId || !inId || outId === inId) {
      continue;
    }
    if (!onPitch.has(outId)) {
      continue;
    }
    if (onPitch.has(inId)) {
      continue;
    }
    closeOpen(outId, minute);
    onPitch.delete(outId);
    onPitch.add(inId);
    openInterval(inId, minute);
  }

  onPitch.forEach(function (playerId) {
    closeOpen(playerId, duration);
  });

  // Also close any dangling intervals for players who left
  Object.keys(intervals).forEach(function (playerId) {
    intervals[playerId].forEach(function (iv) {
      if (iv.end === null) {
        iv.end = duration;
      }
    });
  });

  const minutesByPlayer = {};
  Object.keys(intervals).forEach(function (playerId) {
    let total = 0;
    intervals[playerId].forEach(function (iv) {
      const start = Number(iv.start) || 0;
      const end = Number(iv.end);
      if (Number.isFinite(end) && end > start) {
        total += end - start;
      }
    });
    if (total > 0 || starters.indexOf(playerId) !== -1) {
      minutesByPlayer[playerId] = Math.min(duration, Math.max(0, Math.round(total)));
    }
  });

  return minutesByPlayer;
}

/**
 * Validate sheet for API: returns { error } or { ok: true }.
 */
function validateSheet({ durationMinutes, starterIds, substitutions, maxStarters }) {
  const duration = Math.round(Number(durationMinutes) || 0);
  if (!Number.isInteger(duration) || duration <= 0 || duration > 180) {
    return { error: 'durationMinutes must be an integer from 1 to 180.' };
  }
  const starters = Array.isArray(starterIds)
    ? starterIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  if (!starters.length) {
    return { error: 'At least one starter is required.' };
  }
  const maxAllowed = maxStarters != null ? Math.round(Number(maxStarters)) : null;
  if (maxAllowed != null && Number.isInteger(maxAllowed) && maxAllowed > 0 && starters.length > maxAllowed) {
    return { error: 'At most ' + maxAllowed + ' starters are allowed for this sport.' };
  }
  const starterSet = new Set(starters);
  if (starterSet.size !== starters.length) {
    return { error: 'Duplicate starters are not allowed.' };
  }

  const onPitch = new Set(starters);
  const subs = Array.isArray(substitutions) ? substitutions : [];
  for (let i = 0; i < subs.length; i += 1) {
    const sub = subs[i];
    const minute = Number(sub.minute);
    if (!Number.isInteger(minute) || minute < 0 || minute > duration) {
      return { error: 'Each substitution minute must be an integer between 0 and durationMinutes.' };
    }
    const outId = String(sub.playerOutId || '').trim();
    const inId = String(sub.playerInId || '').trim();
    if (!outId || !inId) {
      return { error: 'Each substitution requires playerOutId and playerInId.' };
    }
    if (outId === inId) {
      return { error: 'Substitution playerOutId and playerInId must differ.' };
    }
    if (!onPitch.has(outId)) {
      return { error: 'Cannot substitute out a player who is not on the pitch.' };
    }
    if (onPitch.has(inId)) {
      return { error: 'Cannot substitute in a player who is already on the pitch.' };
    }
    onPitch.delete(outId);
    onPitch.add(inId);
  }

  return { ok: true };
}

/**
 * Build rollup fields from completed game_performance rows.
 * rows: [{ minutes, rating, kickoffAt }] newest or any order.
 */
function buildPlayerStatsRollup(rows, recentWindow) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  const windowSize = recentWindow || 5;
  let totalMinutes = 0;
  let appearances = 0;
  const ratings = [];
  list.forEach(function (row) {
    const mins = Number(row.minutes) || 0;
    if (mins > 0) {
      appearances += 1;
      totalMinutes += mins;
    }
    if (row.rating !== null && row.rating !== undefined && row.rating !== '') {
      const r = Number(row.rating);
      if (Number.isFinite(r)) {
        ratings.push({ rating: r, kickoffAt: row.kickoffAt });
      }
    }
  });

  list.sort(function (a, b) {
    return String(b.kickoffAt || '').localeCompare(String(a.kickoffAt || ''));
  });
  const recent = list.slice(0, windowSize).filter(function (row) {
    return (Number(row.minutes) || 0) > 0;
  });
  let recentAvg = null;
  if (recent.length) {
    const sum = recent.reduce(function (acc, row) {
      return acc + (Number(row.minutes) || 0);
    }, 0);
    recentAvg = String(Math.round(sum / recent.length)) + "'";
  }

  let averageScore = null;
  let lastMatchScore = null;
  if (ratings.length) {
    const ratingSum = ratings.reduce(function (acc, entry) {
      return acc + entry.rating;
    }, 0);
    averageScore = Math.round((ratingSum / ratings.length) * 10) / 10;
    ratings.sort(function (a, b) {
      return String(b.kickoffAt || '').localeCompare(String(a.kickoffAt || ''));
    });
    lastMatchScore = ratings[0].rating;
  }

  return {
    totalMinutes,
    appearances,
    recentAvg,
    averageScore,
    lastMatchScore,
    hasGames: appearances > 0
  };
}

module.exports = {
  computeMinutesFromSheet,
  validateSheet,
  buildPlayerStatsRollup
};
