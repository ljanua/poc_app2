'use strict';

/**
 * Canonical Soccer seed position ids (migration 015).
 * Tests must not create additional positions under sport_soccer.
 */
const SOCCER_SEED_POSITION_IDS = Object.freeze([
  'pos_any',
  'pos_cam',
  'pos_cb',
  'pos_cdm',
  'pos_cf',
  'pos_cm',
  'pos_gk',
  'pos_rb_lb',
  'pos_rf_lf',
  'pos_rm_lm',
  'pos_rw_lw',
  'pos_rwb_lwb',
  'pos_st'
]);

const SOCCER_SPORT_ID = 'sport_soccer';

module.exports = {
  SOCCER_SEED_POSITION_IDS,
  SOCCER_SPORT_ID
};
