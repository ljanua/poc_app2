'use strict';

/**
 * Canonical Soccer / global skill seed ids (migration 015).
 * Automated tests must not leave durable non-seed skills in the DB.
 */
const SOCCER_SEED_SKILL_IDS = Object.freeze([
  's_acceleration',
  's_aerial_control',
  's_agility',
  's_ball_control',
  's_composure',
  's_creativity',
  's_crossing',
  's_defensive_awareness',
  's_defensive_contribution',
  's_dribbling',
  's_finishing',
  's_fitness',
  's_game_awareness',
  's_handling',
  's_heading',
  's_high_stamina',
  's_interceptions',
  's_link_up_play',
  's_long_shots',
  's_marking',
  's_off_ball_movement',
  's_pace',
  's_passing',
  's_positioning',
  's_reflexes',
  's_shot_stopping',
  's_speed',
  's_stamina',
  's_strength',
  's_tackling',
  's_vision'
]);

module.exports = {
  SOCCER_SEED_SKILL_IDS
};
