(function () {
  const STORAGE_KEY = 'vantageiq_mockup_v2';
  const SESSION_KEY = 'vantageiq_current_user_email';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeLookup(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function normalizeComparable(value) {
    return normalizeLookup(value).toLowerCase();
  }

  function toTitleCase(value) {
    return normalizeLookup(value)
      .split(' ')
      .filter(Boolean)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
      .join(' ');
  }

  const SKILL_ABBR_OVERRIDES = {
    'ball control': 'BCN',
    fitness: 'FIT',
    'game awareness': 'AWR',
    passing: 'PAS',
    speed: 'SPD'
  };

  function suggestSkillAbbreviation(name) {
    const key = normalizeComparable(name);
    if (SKILL_ABBR_OVERRIDES[key]) {
      return SKILL_ABBR_OVERRIDES[key];
    }
    const tokens = String(name || '')
      .trim()
      .split(/[\s/\u2013\u2014\-]+/)
      .map(function (part) { return part.replace(/[^A-Za-z0-9]/g, ''); })
      .filter(Boolean);
    if (!tokens.length) {
      return '';
    }
    function consonantsAfterFirst(token) {
      let out = '';
      for (let i = 1; i < token.length; i++) {
        const ch = token.charAt(i);
        if (/[A-Za-z]/.test(ch) && !/[AEIOUaeiou]/.test(ch)) {
          out += ch.toUpperCase();
        }
      }
      return out;
    }
    let abbr = '';
    if (tokens.length >= 2) {
      for (let i = 0; i < Math.min(3, tokens.length); i++) {
        abbr += tokens[i].charAt(0).toUpperCase();
      }
      const pad = consonantsAfterFirst(tokens[tokens.length - 1]);
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
    return String(abbr || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  }

  function normalizeSkillAbbreviation(value, fallbackName) {
    let abbr = String(value == null ? '' : value).trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
    if (!abbr && fallbackName) {
      abbr = suggestSkillAbbreviation(fallbackName);
    }
    return abbr;
  }

  // Derives birth year from a team age-group label. Mirrors serve-mockup.js.
  function birthYearFromAgeGroup(ageGroup, now) {
    const digits = String(ageGroup == null ? '' : ageGroup).replace(/\D/g, '');
    if (!digits) {
      return null;
    }
    const ageNumber = Number.parseInt(digits, 10);
    if (!Number.isInteger(ageNumber) || ageNumber <= 0) {
      return null;
    }
    const currentYear = (now instanceof Date ? now : new Date()).getFullYear();
    const year = currentYear - ageNumber;
    if (year < 1960 || year > currentYear) {
      return null;
    }
    return year;
  }

  // Validates optional birth month/year on the offline/local fallback path.
  // Mirrors scripts/serve-mockup.js: year-only OK; month-only rejected.
  function parseBirthFields(payload, now) {
    if (payload == null || typeof payload !== 'object') {
      return { birthMonth: null, birthYear: null };
    }

    const monthRaw = payload.birthMonth;
    const yearRaw = payload.birthYear;
    const monthBlank = monthRaw == null || monthRaw === '';
    const yearBlank = yearRaw == null || yearRaw === '';
    if (monthBlank && yearBlank) {
      return { birthMonth: null, birthYear: null };
    }
    if (!monthBlank && yearBlank) {
      return { error: 'Birth month cannot be set without a birth year.' };
    }

    const year = Number(yearRaw);
    if (!Number.isInteger(year)) {
      return { error: 'Birth year must be a whole number.' };
    }
    const currentYear = (now instanceof Date ? now : new Date()).getFullYear();
    if (year < 1960 || year > currentYear) {
      return { error: 'Birth year must be between 1960 and ' + currentYear + '.' };
    }
    if (monthBlank) {
      return { birthMonth: null, birthYear: year };
    }
    const month = Number(monthRaw);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return { error: 'Birth month must be a whole number from 1 (January) to 12 (December).' };
    }
    return { birthMonth: month, birthYear: year };
  }

  // Derives age from birth month/year. Year-only assumes Jan 1. Mirrors server.
  function computeAge(birthMonth, birthYear, now) {
    if (birthYear == null) {
      return null;
    }
    const reference = now instanceof Date ? now : new Date();
    const year = Number(birthYear);
    if (!Number.isInteger(year)) {
      return null;
    }
    let month;
    if (birthMonth == null || birthMonth === '') {
      month = 1;
    } else {
      month = Number(birthMonth);
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        return null;
      }
    }
    const referenceMonth = reference.getMonth() + 1;
    let age = reference.getFullYear() - year;
    if (referenceMonth < month) {
      age -= 1;
    }
    return age >= 0 ? age : null;
  }

  function createSeed() {
    return {
      clubs: [
        { id: 'c_default', name: 'VantageIQ Club' }
      ],
      coachClubs: [
        { userId: 'u_admin_maria', clubId: 'c_default' },
        { userId: 'u_coach_joao', clubId: 'c_default' },
        { userId: 'u_coach_ana', clubId: 'c_default' },
        { userId: 'u_clubadmin_rita', clubId: 'c_default' }
      ],
      teams: [
        { id: 1, name: 'U17 Elite', ageGroup: 'U17', leadCoach: 'Ana Costa', leadCoachEmail: 'ana@vantageiq.club', clubId: 'c_default', sportId: 'sport_soccer', status: 'active' },
        { id: 2, name: 'U19 Prime', ageGroup: 'U19', leadCoach: 'Joao Lima', leadCoachEmail: 'joao@vantageiq.club', clubId: 'c_default', sportId: 'sport_soccer', status: 'active' },
        { id: 3, name: 'Senior Squad', ageGroup: '18+', leadCoach: 'Maria Alves', leadCoachEmail: 'maria@vantageiq.club', clubId: 'c_default', sportId: 'sport_soccer', status: 'active' }
      ],
      players: [
        { id: 10, name: 'Lionel Messi', normalizedName: 'lionel messi', teamName: 'U19 Prime', position: 'RW / LW – Winger', trend: 'improving', updated: 'Updated 2h ago', avatarUrl: null, birthMonth: null, birthYear: new Date().getFullYear() - 19 },
        { id: 11, name: 'Cristiano Ronaldo', normalizedName: 'cristiano ronaldo', teamName: 'Senior Squad', position: 'CF – Centre Forward', trend: 'plateau', updated: 'Updated 5h ago', avatarUrl: null, birthMonth: null, birthYear: new Date().getFullYear() - 18 },
        { id: 12, name: 'Neymar Jr', normalizedName: 'neymar jr', teamName: 'U17 Elite', position: 'RW / LW – Winger', trend: 'declining', updated: 'Updated 1d ago', avatarUrl: null, birthMonth: null, birthYear: new Date().getFullYear() - 17 },
        { id: 13, name: 'Kylian Mbappe', normalizedName: 'kylian mbappe', teamName: 'Senior Squad', position: 'CF – Centre Forward', trend: 'improving', updated: 'Updated 3h ago', avatarUrl: null, birthMonth: null, birthYear: new Date().getFullYear() - 18 }
      ],
      playerAvatars: {},
      clips: [
        { id: 1, playerId: 10, situation: 'Penalty kick attempt, 3rd minute', status: 'complete', score: 0.84, summary: 'Confident execution under pressure.', comments: 'Confident execution under pressure.', submittedAt: '2 hours ago', skill: 'Decision-making', skillFocus: ['Decision-making', 'Composure'], skillRatings: { 'Decision-making': 0.84 }, sourceUrl: 'https://example.com/videos/messi-penalty' },
        { id: 2, playerId: 11, situation: 'Counter-attack, left wing run', status: 'complete', score: 0.76, summary: 'Pace was strong, timing can improve.', comments: 'Pace was strong, timing can improve.', submittedAt: '5 hours ago', skill: 'Pace & Agility', skillFocus: ['Pace & Agility', 'Timing'], skillRatings: { 'Pace & Agility': 0.76, Timing: 0.70 } },
        { id: 3, playerId: 12, situation: 'One-on-one with goalkeeper', status: 'complete', score: 0.90, summary: 'Excellent control and composure.', comments: 'Excellent control and composure.', submittedAt: '1 day ago', skill: 'Technical Skill', skillFocus: ['Technical Skill'], skillRatings: { 'Technical Skill': 0.90 } },
        { id: 4, playerId: 13, situation: 'Sprint and finish, 45th minute', status: 'submitted', score: null, summary: '', submittedAt: 'Submitted 1 hour ago', skill: 'Pace & Agility', skillFocus: ['Pace & Agility'], skillRatings: null }
      ],
      users: [
        { id: 'u_admin_maria', name: 'Maria Alves', email: 'maria@vantageiq.club', role: 'SystemAdmin', status: 'active', password: 'SecurePass123', lastLogin: 'Today, 08:31' },
        { id: 'u_coach_joao', name: 'Joao Lima', email: 'joao@vantageiq.club', role: 'Coach', status: 'active', password: 'SecurePass123', lastLogin: 'Yesterday' },
        { id: 'u_coach_ana', name: 'Ana Costa', email: 'ana@vantageiq.club', role: 'Coach', status: 'inactive', password: 'SecurePass123', lastLogin: '6 days ago' },
        { id: 'u_clubadmin_rita', name: 'Rita Costa', email: 'rita@vantageiq.club', role: 'ClubAdmin', status: 'active', password: 'SecurePass123', lastLogin: 'Today' }
      ],
      sports: [
        { id: 'sport_soccer', name: 'Soccer', status: 'active', positionCount: 13 }
      ],
      positions: [
        { id: 'pos_any', name: 'Any Position', sportId: 'sport_soccer', status: 'active', skillCount: 5 },
        { id: 'pos_gk', name: 'GK – Goalkeeper', sportId: 'sport_soccer', status: 'active', skillCount: 5 },
        { id: 'pos_rb_lb', name: 'RB / LB – Full-Back', sportId: 'sport_soccer', status: 'active', skillCount: 5 },
        { id: 'pos_rwb_lwb', name: 'RWB / LWB – Wing-Back', sportId: 'sport_soccer', status: 'active', skillCount: 5 },
        { id: 'pos_cb', name: 'CB – Centre-Back', sportId: 'sport_soccer', status: 'active', skillCount: 5 },
        { id: 'pos_cdm', name: 'CDM – Defensive Midfielder', sportId: 'sport_soccer', status: 'active', skillCount: 5 },
        { id: 'pos_cm', name: 'CM – Central Midfielder', sportId: 'sport_soccer', status: 'active', skillCount: 5 },
        { id: 'pos_cam', name: 'CAM – Attacking Midfielder', sportId: 'sport_soccer', status: 'active', skillCount: 5 },
        { id: 'pos_rm_lm', name: 'RM / LM – Side Midfielder', sportId: 'sport_soccer', status: 'active', skillCount: 5 },
        { id: 'pos_rw_lw', name: 'RW / LW – Winger', sportId: 'sport_soccer', status: 'active', skillCount: 5 },
        { id: 'pos_rf_lf', name: 'RF / LF – Wide Forward', sportId: 'sport_soccer', status: 'active', skillCount: 5 },
        { id: 'pos_cf', name: 'CF – Centre Forward', sportId: 'sport_soccer', status: 'active', skillCount: 5 },
        { id: 'pos_st', name: 'ST – Striker', sportId: 'sport_soccer', status: 'active', skillCount: 5 }
      ],
      skills: [
        { id: 's_acceleration', name: 'Acceleration', abbreviation: 'ACC', status: 'active', assignedPositionCount: 1 },
        { id: 's_aerial_control', name: 'Aerial control', abbreviation: 'ACN', status: 'active', assignedPositionCount: 1 },
        { id: 's_agility', name: 'Agility', abbreviation: 'AGL', status: 'active', assignedPositionCount: 1 },
        { id: 's_ball_control', name: 'Ball Control', abbreviation: 'BCN', status: 'active', assignedPositionCount: 5 },
        { id: 's_composure', name: 'Composure', abbreviation: 'CMP', status: 'active', assignedPositionCount: 1 },
        { id: 's_creativity', name: 'Creativity', abbreviation: 'CRT', status: 'active', assignedPositionCount: 3 },
        { id: 's_crossing', name: 'Crossing', abbreviation: 'CRS', status: 'active', assignedPositionCount: 4 },
        { id: 's_defensive_awareness', name: 'Defensive awareness', abbreviation: 'DAW', status: 'active', assignedPositionCount: 1 },
        { id: 's_defensive_contribution', name: 'Defensive contribution', abbreviation: 'DCN', status: 'active', assignedPositionCount: 1 },
        { id: 's_dribbling', name: 'Dribbling', abbreviation: 'DRB', status: 'active', assignedPositionCount: 5 },
        { id: 's_finishing', name: 'Finishing', abbreviation: 'FNS', status: 'active', assignedPositionCount: 4 },
        { id: 's_fitness', name: 'Fitness', abbreviation: 'FIT', status: 'active', assignedPositionCount: 1 },
        { id: 's_game_awareness', name: 'Game Awareness', abbreviation: 'AWR', status: 'active', assignedPositionCount: 1 },
        { id: 's_handling', name: 'Handling', abbreviation: 'HND', status: 'active', assignedPositionCount: 1 },
        { id: 's_heading', name: 'Heading', abbreviation: 'HDN', status: 'active', assignedPositionCount: 2 },
        { id: 's_high_stamina', name: 'High stamina', abbreviation: 'HST', status: 'active', assignedPositionCount: 1 },
        { id: 's_interceptions', name: 'Interceptions', abbreviation: 'INT', status: 'active', assignedPositionCount: 2 },
        { id: 's_link_up_play', name: 'Link-up play', abbreviation: 'LUP', status: 'active', assignedPositionCount: 1 },
        { id: 's_long_shots', name: 'Long shots', abbreviation: 'LSH', status: 'active', assignedPositionCount: 1 },
        { id: 's_marking', name: 'Marking', abbreviation: 'MRK', status: 'active', assignedPositionCount: 1 },
        { id: 's_off_ball_movement', name: 'Off-ball movement', abbreviation: 'OBM', status: 'active', assignedPositionCount: 1 },
        { id: 's_pace', name: 'Pace', abbreviation: 'PAC', status: 'active', assignedPositionCount: 4 },
        { id: 's_passing', name: 'Passing', abbreviation: 'PAS', status: 'active', assignedPositionCount: 5 },
        { id: 's_positioning', name: 'Positioning', abbreviation: 'PST', status: 'active', assignedPositionCount: 3 },
        { id: 's_reflexes', name: 'Reflexes', abbreviation: 'RFL', status: 'active', assignedPositionCount: 1 },
        { id: 's_shot_stopping', name: 'Shot stopping', abbreviation: 'SST', status: 'active', assignedPositionCount: 1 },
        { id: 's_speed', name: 'Speed', abbreviation: 'SPD', status: 'active', assignedPositionCount: 1 },
        { id: 's_stamina', name: 'Stamina', abbreviation: 'STM', status: 'active', assignedPositionCount: 2 },
        { id: 's_strength', name: 'Strength', abbreviation: 'STR', status: 'active', assignedPositionCount: 2 },
        { id: 's_tackling', name: 'Tackling', abbreviation: 'TCK', status: 'active', assignedPositionCount: 3 },
        { id: 's_vision', name: 'Vision', abbreviation: 'VSN', status: 'active', assignedPositionCount: 4 }
      ],
      positionSkills: [
        { positionId: 'pos_any', skillId: 's_ball_control', skillName: 'Ball Control', status: 'active' },
        { positionId: 'pos_any', skillId: 's_passing', skillName: 'Passing', status: 'active' },
        { positionId: 'pos_any', skillId: 's_game_awareness', skillName: 'Game Awareness', status: 'active' },
        { positionId: 'pos_any', skillId: 's_fitness', skillName: 'Fitness', status: 'active' },
        { positionId: 'pos_any', skillId: 's_speed', skillName: 'Speed', status: 'active' },

        { positionId: 'pos_gk', skillId: 's_shot_stopping', skillName: 'Shot stopping', status: 'active' },
        { positionId: 'pos_gk', skillId: 's_reflexes', skillName: 'Reflexes', status: 'active' },
        { positionId: 'pos_gk', skillId: 's_handling', skillName: 'Handling', status: 'active' },
        { positionId: 'pos_gk', skillId: 's_positioning', skillName: 'Positioning', status: 'active' },
        { positionId: 'pos_gk', skillId: 's_aerial_control', skillName: 'Aerial control', status: 'active' },

        { positionId: 'pos_rb_lb', skillId: 's_tackling', skillName: 'Tackling', status: 'active' },
        { positionId: 'pos_rb_lb', skillId: 's_marking', skillName: 'Marking', status: 'active' },
        { positionId: 'pos_rb_lb', skillId: 's_pace', skillName: 'Pace', status: 'active' },
        { positionId: 'pos_rb_lb', skillId: 's_crossing', skillName: 'Crossing', status: 'active' },
        { positionId: 'pos_rb_lb', skillId: 's_stamina', skillName: 'Stamina', status: 'active' },

        { positionId: 'pos_rwb_lwb', skillId: 's_high_stamina', skillName: 'High stamina', status: 'active' },
        { positionId: 'pos_rwb_lwb', skillId: 's_pace', skillName: 'Pace', status: 'active' },
        { positionId: 'pos_rwb_lwb', skillId: 's_crossing', skillName: 'Crossing', status: 'active' },
        { positionId: 'pos_rwb_lwb', skillId: 's_defensive_awareness', skillName: 'Defensive awareness', status: 'active' },
        { positionId: 'pos_rwb_lwb', skillId: 's_dribbling', skillName: 'Dribbling', status: 'active' },

        { positionId: 'pos_cb', skillId: 's_strength', skillName: 'Strength', status: 'active' },
        { positionId: 'pos_cb', skillId: 's_heading', skillName: 'Heading', status: 'active' },
        { positionId: 'pos_cb', skillId: 's_tackling', skillName: 'Tackling', status: 'active' },
        { positionId: 'pos_cb', skillId: 's_interceptions', skillName: 'Interceptions', status: 'active' },
        { positionId: 'pos_cb', skillId: 's_composure', skillName: 'Composure', status: 'active' },

        { positionId: 'pos_cdm', skillId: 's_positioning', skillName: 'Positioning', status: 'active' },
        { positionId: 'pos_cdm', skillId: 's_interceptions', skillName: 'Interceptions', status: 'active' },
        { positionId: 'pos_cdm', skillId: 's_tackling', skillName: 'Tackling', status: 'active' },
        { positionId: 'pos_cdm', skillId: 's_passing', skillName: 'Passing', status: 'active' },
        { positionId: 'pos_cdm', skillId: 's_vision', skillName: 'Vision', status: 'active' },

        { positionId: 'pos_cm', skillId: 's_passing', skillName: 'Passing', status: 'active' },
        { positionId: 'pos_cm', skillId: 's_ball_control', skillName: 'Ball Control', status: 'active' },
        { positionId: 'pos_cm', skillId: 's_vision', skillName: 'Vision', status: 'active' },
        { positionId: 'pos_cm', skillId: 's_stamina', skillName: 'Stamina', status: 'active' },
        { positionId: 'pos_cm', skillId: 's_defensive_contribution', skillName: 'Defensive contribution', status: 'active' },

        { positionId: 'pos_cam', skillId: 's_creativity', skillName: 'Creativity', status: 'active' },
        { positionId: 'pos_cam', skillId: 's_vision', skillName: 'Vision', status: 'active' },
        { positionId: 'pos_cam', skillId: 's_dribbling', skillName: 'Dribbling', status: 'active' },
        { positionId: 'pos_cam', skillId: 's_passing', skillName: 'Passing', status: 'active' },
        { positionId: 'pos_cam', skillId: 's_long_shots', skillName: 'Long shots', status: 'active' },

        { positionId: 'pos_rm_lm', skillId: 's_crossing', skillName: 'Crossing', status: 'active' },
        { positionId: 'pos_rm_lm', skillId: 's_pace', skillName: 'Pace', status: 'active' },
        { positionId: 'pos_rm_lm', skillId: 's_off_ball_movement', skillName: 'Off-ball movement', status: 'active' },
        { positionId: 'pos_rm_lm', skillId: 's_dribbling', skillName: 'Dribbling', status: 'active' },
        { positionId: 'pos_rm_lm', skillId: 's_passing', skillName: 'Passing', status: 'active' },

        { positionId: 'pos_rw_lw', skillId: 's_acceleration', skillName: 'Acceleration', status: 'active' },
        { positionId: 'pos_rw_lw', skillId: 's_dribbling', skillName: 'Dribbling', status: 'active' },
        { positionId: 'pos_rw_lw', skillId: 's_crossing', skillName: 'Crossing', status: 'active' },
        { positionId: 'pos_rw_lw', skillId: 's_agility', skillName: 'Agility', status: 'active' },
        { positionId: 'pos_rw_lw', skillId: 's_finishing', skillName: 'Finishing', status: 'active' },

        { positionId: 'pos_rf_lf', skillId: 's_dribbling', skillName: 'Dribbling', status: 'active' },
        { positionId: 'pos_rf_lf', skillId: 's_finishing', skillName: 'Finishing', status: 'active' },
        { positionId: 'pos_rf_lf', skillId: 's_pace', skillName: 'Pace', status: 'active' },
        { positionId: 'pos_rf_lf', skillId: 's_ball_control', skillName: 'Ball Control', status: 'active' },
        { positionId: 'pos_rf_lf', skillId: 's_creativity', skillName: 'Creativity', status: 'active' },

        { positionId: 'pos_cf', skillId: 's_vision', skillName: 'Vision', status: 'active' },
        { positionId: 'pos_cf', skillId: 's_creativity', skillName: 'Creativity', status: 'active' },
        { positionId: 'pos_cf', skillId: 's_ball_control', skillName: 'Ball Control', status: 'active' },
        { positionId: 'pos_cf', skillId: 's_finishing', skillName: 'Finishing', status: 'active' },
        { positionId: 'pos_cf', skillId: 's_link_up_play', skillName: 'Link-up play', status: 'active' },

        { positionId: 'pos_st', skillId: 's_finishing', skillName: 'Finishing', status: 'active' },
        { positionId: 'pos_st', skillId: 's_positioning', skillName: 'Positioning', status: 'active' },
        { positionId: 'pos_st', skillId: 's_strength', skillName: 'Strength', status: 'active' },
        { positionId: 'pos_st', skillId: 's_heading', skillName: 'Heading', status: 'active' },
        { positionId: 'pos_st', skillId: 's_ball_control', skillName: 'Ball Control', status: 'active' }
      ],
      playerSkillRatings: [
        { playerId: 10, skillId: 's_ball_control', rating: 88 },
        { playerId: 10, skillId: 's_passing', rating: 84 },
        { playerId: 10, skillId: 's_game_awareness', rating: 90 },
        { playerId: 10, skillId: 's_fitness', rating: null },
        { playerId: 10, skillId: 's_speed', rating: 76 },
        { playerId: 11, skillId: 's_ball_control', rating: 70 },
        { playerId: 13, skillId: 's_ball_control', rating: 95 }
      ]
    };
  }

  function loadStore() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createSeed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.players) || !Array.isArray(parsed.teams) || !Array.isArray(parsed.skills) || !Array.isArray(parsed.positions) || !Array.isArray(parsed.sports) || !Array.isArray(parsed.playerSkillRatings)) {
        throw new Error('Invalid store');
      }
      return parsed;
    } catch (error) {
      const seed = createSeed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
  }

  function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function setSessionEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    localStorage.setItem(SESSION_KEY, normalized);
  }

  function getSessionUser(store) {
    const email = String(localStorage.getItem(SESSION_KEY) || '').trim().toLowerCase();
    if (!email) {
      return null;
    }
    return store.users.find((user) => user.email.toLowerCase() === email) || null;
  }

  function normalizeTeamName(value) {
    return normalizeComparable(value);
  }

  function findTeamByName(store, teamName) {
    const normalized = normalizeTeamName(teamName);
    return store.teams.find((team) => normalizeTeamName(team.name) === normalized) || null;
  }

  function listActiveCoachesInternal(store) {
    return store.users.filter((user) => user.role === 'Coach' && user.status === 'active');
  }

  function resolveActorContext(store, actorRole, actorEmail) {
    const sessionUser = getSessionUser(store);
    const explicitUser = actorEmail
      ? store.users.find((user) => user.email.toLowerCase() === String(actorEmail).trim().toLowerCase())
      : null;
    const actorUser = sessionUser || explicitUser;
    const role = actorUser ? actorUser.role : String(actorRole || '').trim();
    return { actorUser, role };
  }

  function offlineClubAdminMayManageUser(store, actorUser, targetUser) {
    if (!actorUser || !targetUser) return false;
    if (String(actorUser.id) === String(targetUser.id)) return false;
    if (
      String(actorUser.email || '').toLowerCase() === String(targetUser.email || '').toLowerCase()
    ) {
      return false;
    }
    if (targetUser.role !== 'Coach' && targetUser.role !== 'ClubAdmin') return false;
    const actorClubIds = new Set(
      (store.coachClubs || [])
        .filter(function (entry) {
          return String(entry.userId) === String(actorUser.id);
        })
        .map(function (entry) {
          return entry.clubId;
        })
    );
    return (store.coachClubs || []).some(function (entry) {
      return String(entry.userId) === String(targetUser.id) && actorClubIds.has(entry.clubId);
    });
  }

  function shouldForceLocalMode() {
    return window.__USE_MOCK_LOCAL__ === true;
  }

  function shouldUseBackendPlayersMode() {
    return !shouldForceLocalMode() && window.__USE_BACKEND__ !== false;
  }

  function isClipCompleteStatus(status) {
    return status === 'complete' || status === 'assessed';
  }

  function isClipPendingStatus(status) {
    return status === 'submitted' || status === 'in_progress' || status === 'pending';
  }

  function backendMultipartRequest(endpoint, formData) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/v1' + endpoint, false);
    xhr.setRequestHeader('Accept', 'application/json');
    try {
      xhr.send(formData);
    } catch (error) {
      return {
        status: 0,
        body: {
          code: 'service_unavailable',
          message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.'
        }
      };
    }

    let parsed = {};
    try {
      parsed = xhr.responseText ? JSON.parse(xhr.responseText) : {};
    } catch (error) {
      parsed = {};
    }

    return {
      status: xhr.status,
      body: parsed
    };
  }

  function backendRequest(method, endpoint, payload) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, '/api/v1' + endpoint, false);
    xhr.setRequestHeader('Accept', 'application/json');
    if (payload && method !== 'GET') {
      xhr.setRequestHeader('Content-Type', 'application/json');
    }

    try {
      xhr.send(payload ? JSON.stringify(payload) : null);
    } catch (error) {
      return {
        status: 0,
        body: {
          code: 'service_unavailable',
          message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.'
        }
      };
    }

    let parsed = {};
    try {
      parsed = xhr.responseText ? JSON.parse(xhr.responseText) : {};
    } catch (error) {
      parsed = {};
    }

    return {
      status: xhr.status,
      body: parsed
    };
  }

  function findPlayerByName(store, name) {
    const normalized = normalizeComparable(name);
    return store.players.find((player) => player.normalizedName === normalized) || null;
  }

  function movePlayerToTeam(store, player, teamName) {
    if (player.teamName === teamName) {
      return { moved: false, message: 'Player is already assigned to this team.' };
    }
    player.teamName = teamName;
    player.updated = 'Updated just now';
    return { moved: true, message: player.name + ' moved to ' + teamName + '.' };
  }

  // Mirrors the trend-branch metric change indicators computed server-side in
  // scripts/serve-mockup.js's getDefaultMetricChangeIndicators, so the
  // offline/local fallback path renders the same badge shape as the backend.
  function getDefaultMetricChangeIndicators(trend) {
    if (trend === 'improving') {
      return {
        currentLevelChange: { label: 'Up 5%', trend: 'improving' },
        fitnessChange: { label: 'Up 2%', trend: 'improving' },
        skillProgressChange: { label: 'Up 3%', trend: 'improving' }
      };
    }

    if (trend === 'declining') {
      return {
        currentLevelChange: { label: 'Down 3%', trend: 'declining' },
        fitnessChange: { label: 'Down 2%', trend: 'declining' },
        skillProgressChange: { label: 'Down 1%', trend: 'declining' }
      };
    }

    return {
      currentLevelChange: { label: 'Stable', trend: 'plateau' },
      fitnessChange: { label: 'Stable', trend: 'plateau' },
      skillProgressChange: { label: 'Up 1%', trend: 'improving' }
    };
  }

  // Per-player overrides for the four named seed profiles, mirroring the exact
  // literal values backfilled server-side (getSeedDashboardStats in
  // scripts/serve-mockup.js and the 009 migration), so offline/demo mode shows
  // the same badges a real deployment would rather than only the generic
  // trend-based approximation.
  const SEEDED_METRIC_CHANGE_INDICATORS = {
    'lionel messi': {
      currentLevelChange: { label: 'Up 5%', trend: 'improving' },
      fitnessChange: { label: 'Stable', trend: 'plateau' },
      skillProgressChange: { label: 'Up 3%', trend: 'improving' }
    },
    'cristiano ronaldo': {
      currentLevelChange: { label: 'Stable', trend: 'plateau' },
      fitnessChange: { label: 'Down 2%', trend: 'declining' },
      skillProgressChange: { label: 'Up 1%', trend: 'improving' }
    },
    'neymar jr': {
      currentLevelChange: { label: 'Down 3%', trend: 'declining' },
      fitnessChange: { label: 'Down 4%', trend: 'declining' },
      skillProgressChange: { label: 'Stable', trend: 'plateau' }
    },
    'kylian mbappe': {
      currentLevelChange: { label: 'Up 4%', trend: 'improving' },
      fitnessChange: { label: 'Up 2%', trend: 'improving' },
      skillProgressChange: { label: 'Up 4%', trend: 'improving' }
    }
  };

  function isNamedReferenceProfile(selected) {
    return Object.prototype.hasOwnProperty.call(SEEDED_METRIC_CHANGE_INDICATORS, selected.normalizedName);
  }

  function getMetricChangeIndicators(selected) {
    return SEEDED_METRIC_CHANGE_INDICATORS[selected.normalizedName] || getDefaultMetricChangeIndicators(selected.trend);
  }

  // Mirrors scripts/serve-mockup.js's buildNewPlayerDashboardStats: any
  // player outside the four named reference profiles gets a genuine
  // "no stats recorded yet" dashboard, never a generic trend-based
  // approximation borrowed from another player's shape. Clip counts stay
  // real (computed from this player's own clips) since that data is
  // independently accurate in offline/local mode.
  function buildNoStatsDashboardSnapshot(store, selected) {
    const clips = store.clips.filter((clip) => clip.playerId === selected.id);
    const assessed = clips.filter((clip) => isClipCompleteStatus(clip.status));
    const pending = clips.filter((clip) => isClipPendingStatus(clip.status));
    const growthStatus = selected.trend === 'improving' ? 'on_track' : selected.trend === 'declining' ? 'at_risk' : 'watch';
    const missingDataMessage = 'Performance metrics are not available yet.';

    return clone({
      player: enrichPlayerWithAge(selected),
      stats: {
        growthStatus,
        currentLevel: 'N/A',
        fitness: 'N/A',
        skillProgress: 'N/A',
        totalMinutes: 0,
        appearances: 0,
        recentAvg: 'N/A',
        averageScore: null,
        trend: selected.trend,
        lastMatchScore: null,
        lastMatchSummary: null,
        clipSubmittedCount: clips.length,
        clipAssessedCount: assessed.length,
        clipPendingCount: pending.length,
        missingDataMessage,
        currentLevelChange: null,
        fitnessChange: null,
        skillProgressChange: null
      },
      skillRatings: [],
      metrics: {
        currentLevel: 'N/A',
        fitness: 'N/A',
        skillProgress: 'N/A',
        currentLevelChange: null,
        fitnessChange: null,
        skillProgressChange: null
      },
      matchTime: {
        totalMinutes: 0,
        appearances: 0,
        recentAvg: 'N/A'
      },
      performance: {
        averageScore: 'N/A',
        trend: selected.trend,
        lastMatchScore: 'N/A',
        lastMatchSummary: null,
        missingDataMessage
      },
      clipStats: {
        submitted: clips.length,
        assessed: assessed.length,
        pending: pending.length
      }
    });
  }

  // Coach-saved stats overrides, keyed by player id. When present they take
  // precedence over the derived snapshots below, so an offline/local edit
  // round-trips through the dashboard read the same way the backend PATCH
  // would (including leaving the "no stats yet" state).
  function getStoredStats(store, playerId) {
    if (!store.playerStats) {
      return null;
    }
    return store.playerStats[playerId] || store.playerStats[String(playerId)] || null;
  }

  function growthStatusForTrend(trend) {
    return trend === 'improving' ? 'on_track' : trend === 'declining' ? 'at_risk' : 'watch';
  }

  // Builds the full dashboard payload from a canonical stats object (the same
  // shape the backend stores/returns), mirroring toDashboardPayload in
  // scripts/serve-mockup.js so a coach-saved override renders identically.
  // Adds the read-only derived age to a player record so dashboard reads
  // surface it consistently across stored-stats, no-stats, and named-profile
  // paths. Pure function; never mutates the input.
  function enrichPlayerWithAge(player) {
    if (!player) return player;
    const birthMonth = player.birthMonth == null ? null : Number(player.birthMonth);
    const birthYear = player.birthYear == null ? null : Number(player.birthYear);
    return Object.assign({}, player, {
      birthMonth: Number.isInteger(birthMonth) ? birthMonth : (player.birthMonth == null ? null : player.birthMonth),
      birthYear: Number.isInteger(birthYear) ? birthYear : (player.birthYear == null ? null : player.birthYear),
      age: computeAge(birthMonth, birthYear)
    });
  }

  function composeDashboardPayload(player, stats, skillRatings) {
    const enrichedPlayer = enrichPlayerWithAge(player);
    const currentLevel = stats.currentLevel || 'N/A';
    const fitness = stats.fitness || 'N/A';
    const skillProgress = stats.skillProgress || 'N/A';
    const averageScoreDisplay = stats.averageScore === null || stats.averageScore === undefined ? 'N/A' : Number(stats.averageScore).toFixed(1);
    const lastMatchScoreDisplay = stats.lastMatchScore === null || stats.lastMatchScore === undefined ? 'N/A' : Number(stats.lastMatchScore).toFixed(1);
    const currentLevelChange = stats.currentLevelChange || null;
    const fitnessChange = stats.fitnessChange || null;
    const skillProgressChange = stats.skillProgressChange || null;

    return clone({
      player: enrichedPlayer,
      stats: {
        growthStatus: stats.growthStatus || growthStatusForTrend(player.trend),
        currentLevel,
        fitness,
        skillProgress,
        totalMinutes: Number(stats.totalMinutes || 0),
        appearances: Number(stats.appearances || 0),
        recentAvg: stats.recentAvg || 'N/A',
        averageScore: stats.averageScore === null || stats.averageScore === undefined ? null : Number(stats.averageScore),
        trend: player.trend,
        lastMatchScore: stats.lastMatchScore === null || stats.lastMatchScore === undefined ? null : Number(stats.lastMatchScore),
        lastMatchSummary: stats.lastMatchSummary || null,
        clipSubmittedCount: Number(stats.clipSubmittedCount || 0),
        clipAssessedCount: Number(stats.clipAssessedCount || 0),
        clipPendingCount: Number(stats.clipPendingCount || 0),
        missingDataMessage: stats.missingDataMessage || null,
        currentLevelChange,
        fitnessChange,
        skillProgressChange
      },
      skillRatings: Array.isArray(skillRatings) ? skillRatings : [],
      metrics: {
        currentLevel,
        fitness,
        skillProgress,
        currentLevelChange,
        fitnessChange,
        skillProgressChange
      },
      matchTime: {
        totalMinutes: Number(stats.totalMinutes || 0),
        appearances: Number(stats.appearances || 0),
        recentAvg: stats.recentAvg || 'N/A'
      },
      performance: {
        averageScore: averageScoreDisplay,
        trend: player.trend || 'plateau',
        lastMatchScore: lastMatchScoreDisplay,
        lastMatchSummary: stats.lastMatchSummary || null,
        missingDataMessage: stats.missingDataMessage || null
      },
      clipStats: {
        submitted: Number(stats.clipSubmittedCount || 0),
        assessed: Number(stats.clipAssessedCount || 0),
        pending: Number(stats.clipPendingCount || 0)
      }
    });
  }

  // Feature 040: compact skillId → rating map for skills linked to the player's team sport.
  function listSportSkillRatingsByIdOffline(store, player) {
    const map = {};
    if (!player) {
      return map;
    }
    const team = findTeamByName(store, player.teamName);
    if (!team) {
      return map;
    }
    const sportId = team.sportId || 'sport_soccer';
    const sportPositionIds = {};
    (store.positions || []).forEach(function (position) {
      if (String(position.sportId) !== String(sportId)) {
        return;
      }
      if (position.status && String(position.status) !== 'active') {
        return;
      }
      sportPositionIds[String(position.id)] = true;
    });
    const sportSkillIds = {};
    (store.positionSkills || []).forEach(function (entry) {
      if (sportPositionIds[String(entry.positionId)]) {
        sportSkillIds[String(entry.skillId)] = true;
      }
    });
    (store.playerSkillRatings || []).forEach(function (entry) {
      if (String(entry.playerId) !== String(player.id)) {
        return;
      }
      if (!sportSkillIds[String(entry.skillId)]) {
        return;
      }
      const rating = entry.rating === null || entry.rating === undefined
        ? null
        : Number(entry.rating);
      map[String(entry.skillId)] = rating !== null && !Number.isFinite(rating) ? null : rating;
    });
    return map;
  }

  // Offline mirror of listSkillsForPlayer: Any Position skills for the sport,
  // plus role-unique skills when the assigned position is not Any Position.
  function listSkillsForPlayerOffline(store, player) {
    if (!player) {
      return [];
    }
    const team = findTeamByName(store, player.teamName);
    if (!team) {
      return [];
    }
    const sportId = team.sportId || 'sport_soccer';
    const anyPosition = (store.positions || []).find(function (entry) {
      return String(entry.sportId) === String(sportId)
        && String(entry.name || '').toLowerCase() === 'any position';
    });
    if (!anyPosition) {
      return [];
    }

    const ratings = (store.playerSkillRatings || []).filter(function (entry) {
      return String(entry.playerId) === String(player.id);
    });
    const ratingBySkill = {};
    ratings.forEach(function (entry) {
      ratingBySkill[String(entry.skillId)] = entry.rating === null || entry.rating === undefined
        ? null
        : Number(entry.rating);
    });

    function rowsForPosition(position) {
      return (store.positionSkills || [])
        .filter(function (entry) { return String(entry.positionId) === String(position.id); })
        .map(function (entry) {
          const skill = (store.skills || []).find(function (s) { return String(s.id) === String(entry.skillId); });
          return {
            skillId: entry.skillId,
            skillName: (skill && skill.name) || entry.skillName || entry.skillId,
            positionId: position.id,
            positionName: position.name,
            rating: Object.prototype.hasOwnProperty.call(ratingBySkill, String(entry.skillId))
              ? ratingBySkill[String(entry.skillId)]
              : null
          };
        })
        .sort(function (a, b) {
          return String(a.skillName).localeCompare(String(b.skillName));
        });
    }

    const anyRows = rowsForPosition(anyPosition);
    const anySkillIds = {};
    anyRows.forEach(function (row) { anySkillIds[String(row.skillId)] = true; });

    const positionName = String(player.position || '').trim();
    if (!positionName || positionName === 'Position not set') {
      return anyRows;
    }

    const rolePosition = (store.positions || []).find(function (entry) {
      return String(entry.sportId) === String(sportId)
        && String(entry.name || '').toLowerCase() === positionName.toLowerCase();
    });
    if (!rolePosition || String(rolePosition.id) === String(anyPosition.id)) {
      return anyRows;
    }

    const roleRows = rowsForPosition(rolePosition).filter(function (row) {
      return !anySkillIds[String(row.skillId)];
    });
    return anyRows.concat(roleRows);
  }

  function replaceSkillRatingsForPositionOffline(store, playerId, positionId) {
    store.playerSkillRatings = store.playerSkillRatings || [];
    const player = (store.players || []).find(function (entry) {
      return String(entry.id) === String(playerId);
    });
    const team = player ? findTeamByName(store, player.teamName) : null;
    const sportId = team ? (team.sportId || 'sport_soccer') : 'sport_soccer';
    const anyPosition = (store.positions || []).find(function (entry) {
      return String(entry.sportId) === String(sportId)
        && String(entry.name || '').toLowerCase() === 'any position';
    });
    const anySkillIds = {};
    if (anyPosition) {
      (store.positionSkills || []).forEach(function (entry) {
        if (String(entry.positionId) === String(anyPosition.id)) {
          anySkillIds[String(entry.skillId)] = true;
        }
      });
    }

    store.playerSkillRatings = store.playerSkillRatings.filter(function (entry) {
      if (String(entry.playerId) !== String(playerId)) {
        return true;
      }
      return Boolean(anySkillIds[String(entry.skillId)]);
    });

    if (!positionId || (anyPosition && String(positionId) === String(anyPosition.id))) {
      return;
    }

    const existing = {};
    store.playerSkillRatings.forEach(function (entry) {
      if (String(entry.playerId) === String(playerId)) {
        existing[String(entry.skillId)] = true;
      }
    });

    (store.positionSkills || []).forEach(function (entry) {
      if (String(entry.positionId) !== String(positionId)) {
        return;
      }
      if (anySkillIds[String(entry.skillId)] || existing[String(entry.skillId)]) {
        return;
      }
      store.playerSkillRatings.push({
        playerId: playerId,
        skillId: entry.skillId,
        rating: null
      });
    });
  }

  function buildDashboardSnapshot(store, selected) {
    const avatars = store.playerAvatars || {};
    const avatarUrl = avatars[selected.id] || avatars[String(selected.id)] || selected.avatarUrl || null;
    const selectedWithAvatar = Object.assign({}, selected, { avatarUrl: avatarUrl });
    const skillRatings = listSkillsForPlayerOffline(store, selectedWithAvatar);

    const stored = getStoredStats(store, selectedWithAvatar.id);
    if (stored) {
      return composeDashboardPayload(selectedWithAvatar, stored, skillRatings);
    }

    if (!isNamedReferenceProfile(selectedWithAvatar)) {
      const snapshot = buildNoStatsDashboardSnapshot(store, selectedWithAvatar);
      snapshot.skillRatings = skillRatings;
      return snapshot;
    }

    const clips = store.clips.filter((clip) => clip.playerId === selected.id);
    const assessed = clips.filter((clip) => isClipCompleteStatus(clip.status));
    const pending = clips.filter((clip) => isClipPendingStatus(clip.status));
    const metricChanges = getMetricChangeIndicators(selected);

    return clone({
      player: enrichPlayerWithAge(selectedWithAvatar),
      stats: {
        growthStatus: selected.trend === 'improving' ? 'on_track' : selected.trend === 'declining' ? 'at_risk' : 'watch',
        currentLevel: selected.trend === 'improving' ? '92%' : selected.trend === 'declining' ? '81%' : '87%',
        fitness: selected.trend === 'declining' ? '79%' : '87%',
        skillProgress: selected.trend === 'improving' ? '94%' : '86%',
        totalMinutes: clips.length ? 2340 : 0,
        appearances: clips.length ? 26 : 0,
        recentAvg: clips.length ? "90'" : 'N/A',
        averageScore: assessed.length ? Number((assessed.reduce((sum, clip) => sum + clip.score, 0) / assessed.length).toFixed(1)) : null,
        trend: selected.trend,
        lastMatchScore: assessed.length ? assessed[0].score : null,
        lastMatchSummary: assessed.length ? assessed[0].summary : null,
        clipSubmittedCount: clips.length,
        clipAssessedCount: assessed.length,
        clipPendingCount: pending.length,
        missingDataMessage: assessed.length ? null : 'Performance metrics are not available yet.',
        currentLevelChange: metricChanges.currentLevelChange,
        fitnessChange: metricChanges.fitnessChange,
        skillProgressChange: metricChanges.skillProgressChange
      },
      skillRatings,
      metrics: {
        currentLevel: selected.trend === 'improving' ? '92%' : selected.trend === 'declining' ? '81%' : '87%',
        fitness: selected.trend === 'declining' ? '79%' : '87%',
        skillProgress: selected.trend === 'improving' ? '94%' : '86%',
        currentLevelChange: metricChanges.currentLevelChange,
        fitnessChange: metricChanges.fitnessChange,
        skillProgressChange: metricChanges.skillProgressChange
      },
      matchTime: {
        totalMinutes: clips.length ? 2340 : 0,
        appearances: clips.length ? 26 : 0,
        recentAvg: clips.length ? "90'" : 'N/A'
      },
      performance: {
        averageScore: assessed.length ? (assessed.reduce((sum, clip) => sum + clip.score, 0) / assessed.length).toFixed(1) : 'N/A',
        trend: selected.trend,
        lastMatchScore: assessed.length ? assessed[0].score.toFixed(1) : 'N/A',
        lastMatchSummary: assessed.length ? assessed[0].summary : null,
        missingDataMessage: assessed.length ? null : 'Performance metrics are not available yet.'
      },
      clipStats: {
        submitted: clips.length,
        assessed: assessed.length,
        pending: pending.length
      }
    });
  }

  const TREND_VALUES = ['improving', 'plateau', 'declining'];
  const GROWTH_STATUS_VALUES = ['on_track', 'watch', 'at_risk'];

  function toNullableStringValue(value) {
    if (value === null || value === undefined) {
      return null;
    }
    const text = String(value).trim();
    return text.length ? text : null;
  }

  function toCountValue(value, fallback) {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      return NaN;
    }
    return Math.floor(num);
  }

  function toNullableNumberValue(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : NaN;
  }

  function parseMetricChangeValue(value) {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value !== 'object') {
      return 'invalid';
    }
    const label = toNullableStringValue(value.label);
    if (label === null) {
      return null;
    }
    const trend = String(value.trend || '').trim();
    if (TREND_VALUES.indexOf(trend) === -1) {
      return 'invalid';
    }
    return { label: label, trend: trend };
  }

  // Client-side mirror of parseUpdateProfilePayload in scripts/serve-mockup.js
  // so offline/local edits enforce the same rules the backend would.
  function parseUpdateProfilePayload(payload) {
    const validChars = /^[A-Za-z' -]+$/;
    const name = toTitleCase(payload && payload.name);
    if (!name || name.length < 2 || name.length > 60 || !validChars.test(name)) {
      return { error: 'Player name must be 2-60 chars and use letters, spaces, apostrophe, or hyphen.' };
    }

    const teamName = normalizeLookup(payload && payload.teamName);
    if (!teamName || teamName.toLowerCase() === 'all') {
      return { error: 'Pick a team before saving.' };
    }

    const trend = String((payload && payload.trend) || '').trim();
    if (TREND_VALUES.indexOf(trend) === -1) {
      return { error: 'Trend must be one of improving, plateau, or declining.' };
    }

    const position = toNullableStringValue(payload && payload.position) || 'Position not set';

    const growthStatus = toNullableStringValue(payload && payload.growthStatus);
    if (growthStatus !== null && GROWTH_STATUS_VALUES.indexOf(growthStatus) === -1) {
      return { error: 'Growth status must be on_track, watch, at_risk, or empty.' };
    }

    const totalMinutes = toCountValue(payload && payload.totalMinutes, 0);
    const appearances = toCountValue(payload && payload.appearances, 0);
    const clipSubmittedCount = toCountValue(payload && payload.clipSubmittedCount, 0);
    const clipAssessedCount = toCountValue(payload && payload.clipAssessedCount, 0);
    const clipPendingCount = toCountValue(payload && payload.clipPendingCount, 0);
    if ([totalMinutes, appearances, clipSubmittedCount, clipAssessedCount, clipPendingCount].some(function (value) { return Number.isNaN(value); })) {
      return { error: 'Minutes, appearances, and clip counts must be non-negative whole numbers.' };
    }

    const averageScore = toNullableNumberValue(payload && payload.averageScore);
    const lastMatchScore = toNullableNumberValue(payload && payload.lastMatchScore);
    if (Number.isNaN(averageScore) || Number.isNaN(lastMatchScore)) {
      return { error: 'Scores must be numeric or left blank.' };
    }

    const currentLevelChange = parseMetricChangeValue(payload && payload.currentLevelChange);
    const fitnessChange = parseMetricChangeValue(payload && payload.fitnessChange);
    const skillProgressChange = parseMetricChangeValue(payload && payload.skillProgressChange);
    if ([currentLevelChange, fitnessChange, skillProgressChange].indexOf('invalid') !== -1) {
      return { error: 'Each metric change needs a label and a valid trend, or leave it blank.' };
    }

    var currentLevel = toNullableStringValue(payload && payload.currentLevel);
    var fitness = toNullableStringValue(payload && payload.fitness);
    var skillProgress = toNullableStringValue(payload && payload.skillProgress);
    var hasRating = [currentLevel, fitness, skillProgress].some(function (v) { return v !== null; });

    var avatarUrl = (payload && payload.avatarUrl !== undefined) ? String(payload.avatarUrl || '').trim() || null : null;

    // Birth date: strict-pair rule -- both fields set together, or both absent.
    // Returns the validated pair (with nulls) or an error message.
    var birth = parseBirthFields(payload || {});
    if (birth.error) {
      return { error: birth.error };
    }

    return {
      identity: {
        name: name,
        normalizedName: normalizeComparable(name),
        teamName: teamName,
        position: position,
        trend: trend,
        avatarUrl: avatarUrl,
        birthMonth: birth.birthMonth,
        birthYear: birth.birthYear
      },
      stats: {
        growthStatus: growthStatus,
        currentLevel: currentLevel,
        fitness: fitness,
        skillProgress: skillProgress,
        totalMinutes: totalMinutes,
        appearances: appearances,
        recentAvg: toNullableStringValue(payload && payload.recentAvg) || 'N/A',
        averageScore: averageScore,
        trend: trend,
        lastMatchScore: lastMatchScore,
        lastMatchSummary: toNullableStringValue(payload && payload.lastMatchSummary),
        clipSubmittedCount: clipSubmittedCount,
        clipAssessedCount: clipAssessedCount,
        clipPendingCount: clipPendingCount,
        missingDataMessage: hasRating ? null : 'Performance metrics are not available yet.',
        currentLevelChange: currentLevelChange,
        fitnessChange: fitnessChange,
        skillProgressChange: skillProgressChange
      }
    };
  }

  const MockupApi = {
    reset() {
      const seed = createSeed();
      saveStore(seed);
      return clone(seed);
    },

    suggestSkillAbbreviation(name) {
      return suggestSkillAbbreviation(name);
    },

    birthYearFromAgeGroup(ageGroup, now) {
      return birthYearFromAgeGroup(ageGroup, now);
    },

    listTeams(queryString) {
      const params = new URLSearchParams(String(queryString || '').replace(/^\?/, ''));
      if (!params.get('actorEmail')) {
        const sessionEmail = String(localStorage.getItem(SESSION_KEY) || '').trim().toLowerCase();
        if (sessionEmail) params.set('actorEmail', sessionEmail);
      }

      if (shouldUseBackendPlayersMode()) {
        const qs = params.toString();
        const path = '/teams' + (qs ? '?' + qs : '');
        const response = backendRequest('GET', path);
        if (response.status === 200 && response.body && Array.isArray(response.body.data)) {
          return clone(response.body.data);
        }

        window.__MOCK_API_LAST_ERROR__ = response.body;
        return [];
      }

      const store = loadStore();
      let teams = store.teams.slice();
      const actorEmail = String(params.get('actorEmail') || '').trim().toLowerCase();
      const clubId = String(params.get('clubId') || '').trim();
      const statusFilter = String(params.get('status') || 'active').trim().toLowerCase();

      if (statusFilter === 'active' || statusFilter === 'inactive') {
        teams = teams.filter((team) => (team.status || 'active') === statusFilter);
      }
      if (clubId) {
        teams = teams.filter((team) => String(team.clubId) === clubId);
      }
      if (actorEmail) {
        const actor = store.users.find((user) => String(user.email || '').toLowerCase() === actorEmail);
        if (
          actor &&
          actor.status === 'active' &&
          (actor.role === 'Coach' || actor.role === 'ClubAdmin')
        ) {
          const allowedClubIds = new Set(
            store.coachClubs
              .filter((entry) => String(entry.userId) === String(actor.id) || String(entry.userId) === String(actor.email))
              .map((entry) => entry.clubId)
          );
          teams = teams.filter((team) => allowedClubIds.has(team.clubId));
        } else if (!actor || actor.role !== 'SystemAdmin') {
          teams = [];
        }
      }

      return clone(
        teams.map((team) => {
          const club = (store.clubs || []).find((entry) => entry.id === team.clubId);
          const sport = (store.sports || []).find((entry) => entry.id === team.sportId);
          const playerCount = (store.players || []).filter((player) => player.teamName === team.name).length;
          return {
            id: team.id,
            name: team.name,
            ageGroup: team.ageGroup,
            leadCoach: team.leadCoach,
            leadCoachEmail: team.leadCoachEmail || null,
            clubId: team.clubId || null,
            clubName: club ? club.name : null,
            sportId: team.sportId || null,
            sportName: sport ? sport.name : null,
            status: team.status || 'active',
            playerCount
          };
        })
      );
    },

    listActiveCoaches() {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('GET', '/users');
        if (response.status === 200 && response.body && Array.isArray(response.body.data)) {
          return clone(response.body.data.filter((user) => user.role === 'Coach' && user.status === 'active'));
        }

        window.__MOCK_API_LAST_ERROR__ = response.body;
        return [];
      }

      return clone(listActiveCoachesInternal(loadStore()));
    },

    listClubs(actorRole, actorEmail, statusFilter) {
      if (shouldUseBackendPlayersMode()) {
        const params = new URLSearchParams();
        if (actorEmail) params.set('actorEmail', actorEmail);
        if (statusFilter) params.set('status', statusFilter);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = backendRequest('GET', `/clubs${query}`);
        if (response.status === 200 && response.body && Array.isArray(response.body.data)) {
          return clone(response.body.data);
        }
        window.__MOCK_API_LAST_ERROR__ = response.body;
        return [];
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      const role = actor.role;
      const actorUser = actor.actorUser;
      const status = String(statusFilter || 'active').trim().toLowerCase();
      const matchStatus = (club) => {
        if (status === 'all') return true;
        const clubStatus = club.status || 'active';
        return clubStatus === status;
      };
      const decorate = (club) => {
        const coachCount = store.coachClubs.filter((entry) => entry.clubId === club.id).length;
        const teamCount = store.teams.filter((entry) => entry.clubId === club.id).length;
        return Object.assign({}, club, {
          status: club.status || 'active',
          coachCount: coachCount,
          teamCount: teamCount
        });
      };

      let scoped;
      if ((role === 'Coach' || role === 'ClubAdmin') && actorUser) {
        const allowedClubIds = new Set(
          store.coachClubs
            .filter((entry) => entry.userId === actorUser.id || entry.userId === actorUser.email)
            .map((entry) => entry.clubId)
        );
        scoped = store.clubs.filter((club) => allowedClubIds.has(club.id));
      } else {
        scoped = store.clubs.slice();
      }

      return clone(scoped.filter(matchStatus).map(decorate));
    },

    createClub(payload, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/clubs', {
          name: payload && payload.name,
          actorRole,
          actorEmail
        });
        if (response.status === 201 && response.body && response.body.data) {
          return { status: 201, code: 'created', club: clone(response.body.data) };
        }
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin' || !actor.actorUser || actor.actorUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const name = toTitleCase(payload && payload.name);
      if (!name || name.length < 2 || name.length > 60) {
        return { status: 400, code: 'validation_error', message: 'Club name must be 2-60 characters.' };
      }
      if (store.clubs.some((club) => club.name.toLowerCase() === name.toLowerCase())) {
        return { status: 409, code: 'conflict', message: 'A club with this name already exists.' };
      }

      const nextId = 'c_' + Date.now().toString(36);
      const created = { id: nextId, name: name, status: 'active', coachCount: 0, teamCount: 0 };
      store.clubs.push(created);
      saveStore(store);
      return { status: 201, code: 'created', club: clone(created) };
    },

    updateClub(clubId, payload, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('PATCH', '/clubs/' + encodeURIComponent(clubId), {
          name: payload && payload.name,
          actorRole,
          actorEmail
        });
        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', club: clone(response.body.data) };
        }
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin' || !actor.actorUser || actor.actorUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }
      const club = store.clubs.find((entry) => entry.id === clubId);
      if (!club) {
        return { status: 404, code: 'not_found', message: 'The selected club was not found anymore. Refresh and try again.' };
      }
      const name = toTitleCase(payload && payload.name);
      if (!name || name.length < 2 || name.length > 60) {
        return { status: 400, code: 'validation_error', message: 'Club name must be 2-60 characters.' };
      }
      if (store.clubs.some((other) => other.id !== clubId && other.name.toLowerCase() === name.toLowerCase())) {
        return { status: 409, code: 'conflict', message: 'A club with this name already exists.' };
      }
      club.name = name;
      saveStore(store);
      return { status: 200, code: 'ok', club: clone(club) };
    },

    setClubStatus(clubId, status, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('PATCH', '/clubs/' + encodeURIComponent(clubId) + '/status', {
          status: status,
          actorRole,
          actorEmail
        });
        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', club: clone(response.body.data) };
        }
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin' || !actor.actorUser || actor.actorUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }
      const club = store.clubs.find((entry) => entry.id === clubId);
      if (!club) {
        return { status: 404, code: 'not_found', message: 'The selected club was not found anymore. Refresh and try again.' };
      }
      if (!['active', 'inactive'].includes(status)) {
        return { status: 400, code: 'validation_error', message: 'Status must be active or inactive.' };
      }
      club.status = status;
      saveStore(store);
      return { status: 200, code: 'ok', club: clone(club) };
    },

    listUserClubs(userId, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const params = new URLSearchParams();
        if (actorEmail) params.set('actorEmail', actorEmail);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = backendRequest('GET', '/users/' + encodeURIComponent(userId) + '/clubs' + query);
        if (response.status === 200 && response.body && Array.isArray(response.body.data)) {
          return clone(response.body.data);
        }
        return [];
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin') {
        return [];
      }
      return clone(
        store.coachClubs
          .filter((entry) => entry.userId === userId || entry.userId === userId)
          .map((entry) => {
            const club = store.clubs.find((c) => c.id === entry.clubId);
            return {
              userId: entry.userId,
              clubId: entry.clubId,
              clubName: club ? club.name : null,
              status: club ? (club.status || 'active') : 'inactive'
            };
          })
      );
    },

    // ---------------------------------------------------------------------------
    // S8 Skills admin: sports / positions / skills / position_skills.
    // SystemAdmin-only writes mirroring the clubs/teams pattern.
    // ---------------------------------------------------------------------------

    listSports(actorRole, actorEmail, statusFilter) {
      if (shouldUseBackendPlayersMode()) {
        const params = new URLSearchParams();
        if (actorEmail) params.set('actorEmail', actorEmail);
        if (statusFilter) params.set('status', statusFilter);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = backendRequest('GET', `/sports${query}`);
        if (response.status === 200 && response.body && Array.isArray(response.body.data)) {
          return clone(response.body.data);
        }
        window.__MOCK_API_LAST_ERROR__ = response.body;
        return [];
      }

      const store = loadStore();
      const status = String(statusFilter || 'active').trim().toLowerCase();
      const matchStatus = (sport) => {
        if (status === 'all') return true;
        return (sport.status || 'active') === status;
      };
      const decorate = (sport) => {
        const positionCount = store.positions.filter((entry) => entry.sportId === sport.id).length;
        return Object.assign({}, sport, {
          status: sport.status || 'active',
          positionCount: positionCount
        });
      };
      return clone((store.sports || []).filter(matchStatus).map(decorate));
    },

    createSport(payload, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/sports', {
          name: payload && payload.name,
          actorRole,
          actorEmail
        });
        if (response.status === 201 && response.body && response.body.data) {
          return { status: 201, code: 'created', sport: clone(response.body.data) };
        }
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin' || !actor.actorUser || actor.actorUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const name = toTitleCase(payload && payload.name);
      if (!name || name.length < 2 || name.length > 40) {
        return { status: 400, code: 'validation_error', message: 'Sport name must be 2-40 characters.' };
      }
      if (!Array.isArray(store.sports)) store.sports = [];
      if (store.sports.some((sport) => sport.name.toLowerCase() === name.toLowerCase())) {
        return { status: 409, code: 'conflict', message: 'A sport with this name already exists.' };
      }

      const nextId = 'sport_' + Date.now().toString(36);
      const created = { id: nextId, name: name, status: 'active', positionCount: 0 };
      store.sports.push(created);
      saveStore(store);
      return { status: 201, code: 'created', sport: clone(created) };
    },

    updateSport(sportId, payload, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('PATCH', '/sports/' + encodeURIComponent(sportId), {
          name: payload && payload.name,
          actorRole,
          actorEmail
        });
        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', sport: clone(response.body.data) };
        }
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin' || !actor.actorUser || actor.actorUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }
      if (!Array.isArray(store.sports)) store.sports = [];
      const sport = store.sports.find((entry) => entry.id === sportId);
      if (!sport) {
        return { status: 404, code: 'not_found', message: 'The selected sport was not found anymore. Refresh and try again.' };
      }
      const name = toTitleCase(payload && payload.name);
      if (!name || name.length < 2 || name.length > 40) {
        return { status: 400, code: 'validation_error', message: 'Sport name must be 2-40 characters.' };
      }
      if (store.sports.some((other) => other.id !== sportId && other.name.toLowerCase() === name.toLowerCase())) {
        return { status: 409, code: 'conflict', message: 'A sport with this name already exists.' };
      }
      sport.name = name;
      saveStore(store);
      return { status: 200, code: 'ok', sport: clone(sport) };
    },

    setSportStatus(sportId, status, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('PATCH', '/sports/' + encodeURIComponent(sportId) + '/status', {
          status: status,
          actorRole,
          actorEmail
        });
        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', sport: clone(response.body.data) };
        }
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin' || !actor.actorUser || actor.actorUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }
      if (!Array.isArray(store.sports)) store.sports = [];
      const sport = store.sports.find((entry) => entry.id === sportId);
      if (!sport) {
        return { status: 404, code: 'not_found', message: 'The selected sport was not found anymore. Refresh and try again.' };
      }
      if (!['active', 'inactive'].includes(status)) {
        return { status: 400, code: 'validation_error', message: 'Status must be active or inactive.' };
      }
      sport.status = status;
      saveStore(store);
      return { status: 200, code: 'ok', sport: clone(sport) };
    },

    listPositions(actorRole, actorEmail, sportId, statusFilter) {
      if (shouldUseBackendPlayersMode()) {
        const params = new URLSearchParams();
        if (actorEmail) params.set('actorEmail', actorEmail);
        if (sportId) params.set('sportId', sportId);
        if (statusFilter) params.set('status', statusFilter);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = backendRequest('GET', `/positions${query}`);
        if (response.status === 200 && response.body && Array.isArray(response.body.data)) {
          return clone(response.body.data);
        }
        window.__MOCK_API_LAST_ERROR__ = response.body;
        return [];
      }

      const store = loadStore();
      const status = String(statusFilter || 'active').trim().toLowerCase();
      const sportFilter = sportId || 'sport_soccer';
      const matchSport = (entry) => !sportFilter || entry.sportId === sportFilter;
      const matchStatus = (position) => {
        if (status === 'all') return true;
        return (position.status || 'active') === status;
      };
      const decorate = (position) => {
        const skillCount = (store.positionSkills || []).filter((entry) => entry.positionId === position.id).length;
        return Object.assign({}, position, {
          status: position.status || 'active',
          sportId: position.sportId,
          skillCount: skillCount
        });
      };
      return clone((store.positions || []).filter(matchSport).filter(matchStatus).map(decorate));
    },

    createPosition(payload, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/positions', {
          name: payload && payload.name,
          sportId: payload && payload.sportId,
          actorRole,
          actorEmail
        });
        if (response.status === 201 && response.body && response.body.data) {
          return { status: 201, code: 'created', position: clone(response.body.data) };
        }
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin' || !actor.actorUser || actor.actorUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const name = toTitleCase(payload && payload.name);
      const sportId = String((payload && payload.sportId) || '').trim() || 'sport_soccer';
      if (!name || name.length < 2 || name.length > 80) {
        return { status: 400, code: 'validation_error', message: 'Position name must be 2-80 characters.' };
      }
      if (!Array.isArray(store.sports)) store.sports = [];
      if (!Array.isArray(store.positions)) store.positions = [];
      const parentSport = store.sports.find((entry) => entry.id === sportId);
      if (!parentSport) {
        return { status: 404, code: 'not_found', message: 'The selected sport was not found anymore. Refresh and try again.' };
      }
      if ((parentSport.status || 'active') !== 'active') {
        return { status: 400, code: 'validation_error', message: 'Cannot add a position under an inactive sport.' };
      }
      if (store.positions.some((entry) => entry.sportId === sportId && entry.name.toLowerCase() === name.toLowerCase())) {
        return { status: 409, code: 'conflict', message: 'A position with this name already exists under the selected sport.' };
      }

      const nextId = 'pos_' + Date.now().toString(36);
      const created = { id: nextId, name: name, sportId: sportId, status: 'active', skillCount: 0 };
      store.positions.push(created);
      saveStore(store);
      return { status: 201, code: 'created', position: clone(created) };
    },

    updatePosition(positionId, payload, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('PATCH', '/positions/' + encodeURIComponent(positionId), {
          name: payload && payload.name,
          sportId: payload && payload.sportId,
          actorRole,
          actorEmail
        });
        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', position: clone(response.body.data) };
        }
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin' || !actor.actorUser || actor.actorUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }
      if (!Array.isArray(store.positions)) store.positions = [];
      const position = store.positions.find((entry) => entry.id === positionId);
      if (!position) {
        return { status: 404, code: 'not_found', message: 'The selected position was not found anymore. Refresh and try again.' };
      }
      const name = toTitleCase(payload && payload.name);
      if (!name || name.length < 2 || name.length > 80) {
        return { status: 400, code: 'validation_error', message: 'Position name must be 2-80 characters.' };
      }
      const newSportId = payload && payload.sportId ? String(payload.sportId).trim() : position.sportId;
      if (!newSportId) {
        return { status: 400, code: 'validation_error', message: 'Position requires a sportId.' };
      }
      if (!Array.isArray(store.sports)) store.sports = [];
      const parentSport = store.sports.find((entry) => entry.id === newSportId);
      if (!parentSport) {
        return { status: 404, code: 'not_found', message: 'The selected sport was not found anymore. Refresh and try again.' };
      }
      if (store.positions.some((other) => other.id !== positionId && other.sportId === newSportId && other.name.toLowerCase() === name.toLowerCase())) {
        return { status: 409, code: 'conflict', message: 'A position with this name already exists under the selected sport.' };
      }
      position.name = name;
      position.sportId = newSportId;
      saveStore(store);
      return { status: 200, code: 'ok', position: clone(position) };
    },

    setPositionStatus(positionId, status, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('PATCH', '/positions/' + encodeURIComponent(positionId) + '/status', {
          status: status,
          actorRole,
          actorEmail
        });
        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', position: clone(response.body.data) };
        }
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin' || !actor.actorUser || actor.actorUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }
      if (!Array.isArray(store.positions)) store.positions = [];
      const position = store.positions.find((entry) => entry.id === positionId);
      if (!position) {
        return { status: 404, code: 'not_found', message: 'The selected position was not found anymore. Refresh and try again.' };
      }
      if (!['active', 'inactive'].includes(status)) {
        return { status: 400, code: 'validation_error', message: 'Status must be active or inactive.' };
      }
      position.status = status;
      saveStore(store);
      return { status: 200, code: 'ok', position: clone(position) };
    },

    listSkills(actorRole, actorEmail, statusFilter) {
      if (shouldUseBackendPlayersMode()) {
        const params = new URLSearchParams();
        if (actorEmail) params.set('actorEmail', actorEmail);
        if (statusFilter) params.set('status', statusFilter);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = backendRequest('GET', `/skills${query}`);
        if (response.status === 200 && response.body && Array.isArray(response.body.data)) {
          return clone(response.body.data);
        }
        window.__MOCK_API_LAST_ERROR__ = response.body;
        return [];
      }

      const store = loadStore();
      const status = String(statusFilter || 'active').trim().toLowerCase();
      const matchStatus = (skill) => {
        if (status === 'all') return true;
        return (skill.status || 'active') === status;
      };
      const decorate = (skill) => {
        const assignedPositionCount = (store.positionSkills || []).filter((entry) => entry.skillId === skill.id).length;
        return Object.assign({}, skill, {
          status: skill.status || 'active',
          abbreviation: skill.abbreviation || suggestSkillAbbreviation(skill.name),
          assignedPositionCount: assignedPositionCount
        });
      };
      return clone((store.skills || []).filter(matchStatus).map(decorate));
    },

    createSkill(payload, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/skills', {
          name: payload && payload.name,
          abbreviation: payload && payload.abbreviation,
          actorRole,
          actorEmail
        });
        if (response.status === 201 && response.body && response.body.data) {
          return { status: 201, code: 'created', skill: clone(response.body.data) };
        }
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin' || !actor.actorUser || actor.actorUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const name = toTitleCase(payload && payload.name);
      if (!name || name.length < 2 || name.length > 60) {
        return { status: 400, code: 'validation_error', message: 'Skill name must be 2-60 characters.' };
      }
      const abbreviation = normalizeSkillAbbreviation(payload && payload.abbreviation, name);
      if (!abbreviation || abbreviation.length < 1 || abbreviation.length > 3) {
        return { status: 400, code: 'validation_error', message: 'Skill abbreviation must be 1-3 letters or digits.' };
      }
      if (!Array.isArray(store.skills)) store.skills = [];
      if (store.skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase())) {
        return { status: 409, code: 'conflict', message: 'A skill with this name already exists.' };
      }

      const nextId = 's_' + Date.now().toString(36);
      const created = {
        id: nextId,
        name: name,
        abbreviation: abbreviation,
        status: 'active',
        assignedPositionCount: 0
      };
      store.skills.push(created);
      saveStore(store);
      return { status: 201, code: 'created', skill: clone(created) };
    },

    updateSkill(skillId, payload, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('PATCH', '/skills/' + encodeURIComponent(skillId), {
          name: payload && payload.name,
          abbreviation: payload && payload.abbreviation,
          actorRole,
          actorEmail
        });
        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', skill: clone(response.body.data) };
        }
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin' || !actor.actorUser || actor.actorUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }
      if (!Array.isArray(store.skills)) store.skills = [];
      const skill = store.skills.find((entry) => entry.id === skillId);
      if (!skill) {
        return { status: 404, code: 'not_found', message: 'The selected skill was not found anymore. Refresh and try again.' };
      }
      const name = toTitleCase(payload && payload.name);
      if (!name || name.length < 2 || name.length > 60) {
        return { status: 400, code: 'validation_error', message: 'Skill name must be 2-60 characters.' };
      }
      const abbreviation = normalizeSkillAbbreviation(payload && payload.abbreviation, name);
      if (!abbreviation || abbreviation.length < 1 || abbreviation.length > 3) {
        return { status: 400, code: 'validation_error', message: 'Skill abbreviation must be 1-3 letters or digits.' };
      }
      if (store.skills.some((other) => other.id !== skillId && other.name.toLowerCase() === name.toLowerCase())) {
        return { status: 409, code: 'conflict', message: 'A skill with this name already exists.' };
      }
      const oldName = skill.name;
      skill.name = name;
      skill.abbreviation = abbreviation;
      // Cascade the renamed label onto existing position_skills rows so the
      // position-Skills table keeps showing the latest skill label.
      if (Array.isArray(store.positionSkills)) {
        store.positionSkills.forEach(function (entry) {
          if (entry.skillId === skillId && entry.skillName === oldName) {
            entry.skillName = name;
          }
        });
      }
      saveStore(store);
      return { status: 200, code: 'ok', skill: clone(skill) };
    },

    setSkillStatus(skillId, status, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('PATCH', '/skills/' + encodeURIComponent(skillId) + '/status', {
          status: status,
          actorRole,
          actorEmail
        });
        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', skill: clone(response.body.data) };
        }
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin' || !actor.actorUser || actor.actorUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }
      if (!Array.isArray(store.skills)) store.skills = [];
      const skill = store.skills.find((entry) => entry.id === skillId);
      if (!skill) {
        return { status: 404, code: 'not_found', message: 'The selected skill was not found anymore. Refresh and try again.' };
      }
      if (!['active', 'inactive'].includes(status)) {
        return { status: 400, code: 'validation_error', message: 'Status must be active or inactive.' };
      }
      skill.status = status;
      saveStore(store);
      return { status: 200, code: 'ok', skill: clone(skill) };
    },

    deleteSkill(skillId, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('DELETE', '/skills/' + encodeURIComponent(skillId), {
          actorRole,
          actorEmail
        });
        if (response.status === 204) {
          return { status: 204, code: 'ok' };
        }
        if (response.status === 409) {
          return clone(Object.assign({ status: 409 }, response.body || { code: 'conflict', message: 'Cannot delete this skill because it is still assigned to one or more positions.' }));
        }
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin' || !actor.actorUser || actor.actorUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }
      if (!Array.isArray(store.skills)) store.skills = [];
      const skill = store.skills.find((entry) => entry.id === skillId);
      if (!skill) {
        return { status: 404, code: 'not_found', message: 'The selected skill was not found anymore. Refresh and try again.' };
      }
      const assignedCount = (store.positionSkills || []).filter((entry) => entry.skillId === skillId).length;
      if (assignedCount > 0) {
        return {
          status: 409,
          code: 'conflict',
          message: "Cannot delete skill '" + skill.name + "' because it is assigned to " + assignedCount + " position(s). Remove the assignments first."
        };
      }
      store.skills = store.skills.filter((entry) => entry.id !== skillId);
      saveStore(store);
      return { status: 204, code: 'ok' };
    },

    listPositionSkills(positionId, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const params = new URLSearchParams();
        if (actorEmail) params.set('actorEmail', actorEmail);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = backendRequest('GET', '/positions/' + encodeURIComponent(positionId) + '/skills' + query);
        if (response.status === 200 && response.body && Array.isArray(response.body.data)) {
          return clone(response.body.data);
        }
        window.__MOCK_API_LAST_ERROR__ = response.body;
        return [];
      }

      const store = loadStore();
      if (!Array.isArray(store.positionSkills)) store.positionSkills = [];
      return clone(store.positionSkills.filter((entry) => entry.positionId === positionId));
    },

    assignSkillToPosition(positionId, skillId, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/positions/' + encodeURIComponent(positionId) + '/skills', {
          skillId: skillId,
          actorRole,
          actorEmail
        });
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin' || !actor.actorUser || actor.actorUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }
      if (!Array.isArray(store.positions)) store.positions = [];
      if (!Array.isArray(store.skills)) store.skills = [];
      if (!Array.isArray(store.positionSkills)) store.positionSkills = [];
      const position = store.positions.find((entry) => entry.id === positionId);
      if (!position) {
        return { status: 404, code: 'not_found', message: 'The selected position was not found anymore. Refresh and try again.' };
      }
      const skill = store.skills.find((entry) => entry.id === skillId);
      if (!skill) {
        return { status: 404, code: 'not_found', message: 'The selected skill was not found anymore. Refresh and try again.' };
      }
      if ((skill.status || 'active') !== 'active') {
        return { status: 400, code: 'validation_error', message: 'Cannot assign an inactive skill.' };
      }
      const existing = store.positionSkills.find((entry) => entry.positionId === positionId && entry.skillId === skillId);
      if (existing) {
        return { status: 200, code: 'ok', assignment: clone(existing) };
      }
      const created = {
        positionId: positionId,
        skillId: skillId,
        skillName: skill.name,
        status: 'active'
      };
      store.positionSkills.push(created);
      saveStore(store);
      return { status: 201, code: 'created', assignment: clone(created) };
    },

    removeSkillFromPosition(positionId, skillId, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('DELETE', '/positions/' + encodeURIComponent(positionId) + '/skills/' + encodeURIComponent(skillId), {
          actorRole,
          actorEmail
        });
        if (response.status === 204) {
          return { status: 204, code: 'ok' };
        }
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin' || !actor.actorUser || actor.actorUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }
      if (!Array.isArray(store.positionSkills)) store.positionSkills = [];
      const before = store.positionSkills.length;
      store.positionSkills = store.positionSkills.filter(function (entry) {
        return !(entry.positionId === positionId && entry.skillId === skillId);
      });
      if (store.positionSkills.length === before) {
        return { status: 404, code: 'not_found', message: 'Assignment not found.' };
      }
      saveStore(store);
      return { status: 204, code: 'ok' };
    },

    assignUserToClub(userId, clubId, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/users/' + encodeURIComponent(userId) + '/clubs', {
          clubId: clubId,
          actorRole,
          actorEmail
        });
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin' || !actor.actorUser || actor.actorUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }
      const user = store.users.find((entry) => String(entry.id) === String(userId) || (entry.email && entry.email.toLowerCase() === String(userId).toLowerCase()));
      if (!user) {
        return { status: 404, code: 'not_found', message: 'The selected user was not found anymore. Refresh and try again.' };
      }
      if (user.status !== 'active') {
        return { status: 400, code: 'validation_error', message: 'Inactive users cannot be assigned to a club.' };
      }
      const club = store.clubs.find((entry) => entry.id === clubId);
      if (!club) {
        return { status: 404, code: 'not_found', message: 'The selected club was not found anymore. Refresh and try again.' };
      }
      if ((club.status || 'active') !== 'active') {
        return { status: 400, code: 'validation_error', message: 'Inactive clubs cannot accept new members.' };
      }
      const assignedId = user.id;
      if (!store.coachClubs.some((entry) => entry.userId === assignedId && entry.clubId === clubId)) {
        store.coachClubs.push({ userId: assignedId, clubId: clubId });
        saveStore(store);
        return { status: 201, code: 'created', membership: clone({ userId: assignedId, clubId: clubId, clubName: club.name, status: 'active' }) };
      }
      return { status: 200, code: 'ok', membership: clone({ userId: assignedId, clubId: clubId, clubName: club.name, status: 'active' }) };
    },

    removeUserFromClub(userId, clubId, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const params = new URLSearchParams();
        if (actorEmail) params.set('actorEmail', actorEmail);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = backendRequest('DELETE', '/users/' + encodeURIComponent(userId) + '/clubs/' + encodeURIComponent(clubId) + query);
        if (response.status === 204) {
          return { status: 204, code: 'ok' };
        }
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin' || !actor.actorUser || actor.actorUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }
      const before = store.coachClubs.length;
      store.coachClubs = store.coachClubs.filter((entry) => !(String(entry.userId) === String(userId) && entry.clubId === clubId));
      if (store.coachClubs.length === before) {
        return { status: 404, code: 'not_found', message: 'The user was not a member of this club.' };
      }
      saveStore(store);
      return { status: 204, code: 'ok' };
    },

    assignTeamToClub(teamId, clubId, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/clubs/' + encodeURIComponent(clubId) + '/teams', {
          teamId: teamId,
          actorRole,
          actorEmail
        });
        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', team: clone(response.body.data) };
        }
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      if (actor.role !== 'SystemAdmin' || !actor.actorUser || actor.actorUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }
      const team = store.teams.find((entry) => String(entry.id) === String(teamId));
      if (!team) {
        return { status: 404, code: 'not_found', message: 'The selected team was not found anymore. Refresh and try again.' };
      }
      const club = store.clubs.find((entry) => entry.id === clubId);
      if (!club) {
        return { status: 404, code: 'not_found', message: 'The selected club was not found anymore. Refresh and try again.' };
      }
      if (team.clubId === clubId) {
        return { status: 400, code: 'validation_error', message: 'The team is already in this club.' };
      }
      team.clubId = clubId;
      team.clubName = club.name;
      const leadCoachEmail = (team.leadCoachEmail || '').toLowerCase();
      if (leadCoachEmail) {
        const lead = store.users.find((u) => u.email.toLowerCase() === leadCoachEmail);
        const leadId = lead ? lead.id : leadCoachEmail;
        if (leadId && !store.coachClubs.some((entry) => entry.userId === leadId && entry.clubId === clubId)) {
          store.coachClubs.push({ userId: leadId, clubId: clubId });
        }
      }
      saveStore(store);
      return { status: 200, code: 'ok', team: clone(team) };
    },

    getCurrentUser() {
      if (shouldUseBackendPlayersMode()) {
        const sessionEmail = String(localStorage.getItem(SESSION_KEY) || '').trim().toLowerCase();
        if (!sessionEmail) {
          return null;
        }

        const response = backendRequest('GET', '/users?email=' + encodeURIComponent(sessionEmail));
        if (response.status === 200 && response.body && Array.isArray(response.body.data) && response.body.data[0]) {
          return clone(response.body.data[0]);
        }

        return null;
      }

      const store = loadStore();
      const user = getSessionUser(store);
      return user ? clone(user) : null;
    },

    createTeam(payload, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/teams', {
          name: payload && payload.name,
          ageGroup: payload && payload.ageGroup,
          coachEmail: payload && payload.coachEmail,
          clubId: payload && payload.clubId,
          sportId: payload && payload.sportId,
          actorRole,
          actorEmail
        });

        if (response.status === 201 && response.body && response.body.data) {
          return { status: 201, code: 'created', team: clone(response.body.data) };
        }

        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', team: clone(response.body.data) };
        }

        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      const role = actor.role;
      const sessionUser = actor.actorUser;

      if (!['SystemAdmin', 'Coach', 'ClubAdmin'].includes(role) || !sessionUser || sessionUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const teamName = toTitleCase(payload && payload.name);
      const ageGroup = normalizeLookup(payload && payload.ageGroup);
      if (!teamName || teamName.length < 2 || !ageGroup) {
        return { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' };
      }

      if (findTeamByName(store, teamName)) {
        return { status: 409, code: 'conflict', message: 'A user with the same identifier already exists.' };
      }

      let assignedCoach = sessionUser;
      if (role === 'SystemAdmin') {
        const selectedCoachEmail = String(payload && payload.coachEmail || '').trim().toLowerCase();
        if (!selectedCoachEmail) {
          return { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' };
        }
        const selectedCoach = listActiveCoachesInternal(store).find((coach) => coach.email.toLowerCase() === selectedCoachEmail);
        if (!selectedCoach) {
          return { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' };
        }
        assignedCoach = selectedCoach;
      }

      let resolvedClubId = String(payload && payload.clubId || '').trim();
      if (!resolvedClubId && role === 'Coach' && sessionUser) {
        const existing = store.coachClubs.find(
          (entry) => entry.userId === sessionUser.id || entry.userId === sessionUser.email
        );
        resolvedClubId = existing ? existing.clubId : '';
      }
      if (!resolvedClubId) {
        return { status: 400, code: 'validation_error', message: 'Please select a club for this team.' };
      }
      const targetClub = store.clubs.find((club) => club.id === resolvedClubId);
      if (!targetClub) {
        return { status: 400, code: 'validation_error', message: 'The selected club could not be found.' };
      }

      const nextId = store.teams.reduce((max, team) => Math.max(max, team.id), 0) + 1;
      const resolvedSportId = String(payload && payload.sportId || 'sport_soccer').trim() || 'sport_soccer';
      const resolvedSport = (store.sports || []).find((sport) => sport.id === resolvedSportId) || (store.sports || []).find((sport) => sport.id === 'sport_soccer') || null;
      const created = {
        id: nextId,
        name: teamName,
        ageGroup,
        leadCoach: assignedCoach.name,
        leadCoachEmail: assignedCoach.email,
        clubId: resolvedClubId,
        clubName: targetClub.name,
        sportId: resolvedSport ? resolvedSport.id : 'sport_soccer',
        sportName: resolvedSport ? resolvedSport.name : 'Soccer',
        status: 'active'
      };

      store.teams.push(created);
      if (role === 'SystemAdmin') {
        const assignedId = assignedCoach.id || assignedCoach.email;
        if (
          assignedId &&
          !store.coachClubs.some(
            (entry) => entry.userId === assignedId && entry.clubId === resolvedClubId
          )
        ) {
          store.coachClubs.push({ userId: assignedId, clubId: resolvedClubId });
        }
      }
      saveStore(store);
      return { status: 201, code: 'created', team: clone(created) };
    },

    reassignTeamCoach(teamName, coachEmail, actorRole, actorEmail) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/teams/coach', {
          teamName,
          coachEmail,
          actorRole,
          actorEmail
        });

        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', team: clone(response.body.data) };
        }

        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.' });
      }

      const store = loadStore();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      const role = actor.role;
      const sessionUser = actor.actorUser;

      if (role !== 'SystemAdmin' || !sessionUser || sessionUser.status !== 'active') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const team = findTeamByName(store, teamName);
      if (!team) {
        return { status: 404, code: 'not_found', message: 'The selected team was not found anymore. Refresh and try again.' };
      }

      const selectedCoachEmail = String(coachEmail || '').trim().toLowerCase();
      const selectedCoach = listActiveCoachesInternal(store).find((coach) => coach.email.toLowerCase() === selectedCoachEmail);
      if (!selectedCoach) {
        return { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' };
      }

      team.leadCoach = selectedCoach.name;
      team.leadCoachEmail = selectedCoach.email;
      if (team.clubId) {
        const assignedId = selectedCoach.id || selectedCoach.email;
        if (
          assignedId &&
          !store.coachClubs.some(
            (entry) => entry.userId === assignedId && entry.clubId === team.clubId
          )
        ) {
          store.coachClubs.push({ userId: assignedId, clubId: team.clubId });
        }
      }
      const club = store.clubs.find((entry) => entry.id === team.clubId);
      team.clubName = club ? club.name : null;
      saveStore(store);
      return { status: 200, code: 'ok', team: clone(team) };
    },

    updateTeamCoachAndClub(teamId, payload) {
      const body = payload || {};
      if (shouldUseBackendPlayersMode()) {
        const requestBody = {
          coachEmail: body.coachEmail,
          clubId: body.clubId,
          status: body.status,
          sportId: body.sportId,
          actorRole: body.actorRole,
          actorEmail: body.actorEmail
        };
        if (Object.prototype.hasOwnProperty.call(body, 'name')) requestBody.name = body.name;
        if (Object.prototype.hasOwnProperty.call(body, 'ageGroup')) requestBody.ageGroup = body.ageGroup;
        const response = backendRequest('POST', '/teams/' + encodeURIComponent(teamId) + '/update', requestBody);
        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', team: clone(response.body.data) };
        }
        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' });
      }

      const store = loadStore();
      const team = (store.teams || []).find((entry) => String(entry.id) === String(teamId));
      if (!team) {
        return { status: 404, code: 'not_found', message: 'The selected team was not found anymore. Refresh and try again.' };
      }

      const newCoachEmail = String(body.coachEmail || '').trim().toLowerCase();
      const newClubId = String(body.clubId || '').trim();
      const newStatus = String(body.status || '').trim().toLowerCase();
      if (!newCoachEmail || !newClubId || !['active', 'inactive'].includes(newStatus)) {
        return { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' };
      }

      const actorRole = String(body.actorRole || '').trim();
      const actorEmail = String(body.actorEmail || '').trim().toLowerCase();
      const actor = resolveActorContext(store, actorRole, actorEmail);
      const sessionUser = actor.actorUser;
      if (!sessionUser || sessionUser.status !== 'active' || !['SystemAdmin', 'Coach', 'ClubAdmin'].includes(actor.role)) {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }
      if (actor.role === 'Coach' || actor.role === 'ClubAdmin') {
        const allowedClubIds = (store.coachClubs || [])
          .filter((entry) => entry.userId === sessionUser.id || entry.userId === sessionUser.email)
          .map((entry) => entry.clubId);
        if (!allowedClubIds.includes(team.clubId) || !allowedClubIds.includes(newClubId)) {
          return {
            status: 403,
            code: 'forbidden_scope',
            message: 'You can only update teams in clubs you belong to.'
          };
        }
      }

      // Omitted name/ageGroup preserve current values. Present key (including null) is validated.
      let nextName = team.name;
      let nextAgeGroup = team.ageGroup;
      if (Object.prototype.hasOwnProperty.call(body, 'name')) {
        nextName = toTitleCase(body.name);
        if (!nextName || nextName.length < 2) {
          return { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' };
        }
      }
      if (Object.prototype.hasOwnProperty.call(body, 'ageGroup')) {
        nextAgeGroup = normalizeLookup(body.ageGroup);
        if (!nextAgeGroup) {
          return { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' };
        }
      }
      const renameClash = (store.teams || []).find(
        (entry) =>
          String(entry.id) !== String(teamId) &&
          normalizeTeamName(entry.name) === normalizeTeamName(nextName)
      );
      if (renameClash) {
        return { status: 409, code: 'conflict', message: 'A team with this name already exists.' };
      }

      const club = store.clubs.find((entry) => entry.id === newClubId);
      if (!club) {
        return { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' };
      }
      const newCoach = listActiveCoachesInternal(store).find((coach) => coach.email.toLowerCase() === newCoachEmail);
      if (!newCoach) {
        return { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' };
      }

      const previousName = team.name;
      team.name = nextName;
      team.ageGroup = nextAgeGroup;
      team.leadCoach = newCoach.name;
      team.leadCoachEmail = newCoach.email;
      team.clubId = newClubId;
      team.clubName = club.name;
      team.status = newStatus;
      const newSportId = String(body.sportId || '').trim();
      if (newSportId) {
        const newSport = (store.sports || []).find((sport) => sport.id === newSportId);
        if (!newSport) {
          return { status: 400, code: 'validation_error', message: 'The selected sport could not be found.' };
        }
        team.sportId = newSport.id;
        team.sportName = newSport.name;
      } else if (!team.sportId) {
        team.sportId = 'sport_soccer';
        team.sportName = 'Soccer';
      }
      if (normalizeTeamName(previousName) !== normalizeTeamName(nextName)) {
        (store.players || []).forEach((player) => {
          if (normalizeTeamName(player.teamName) === normalizeTeamName(previousName)) {
            player.teamName = nextName;
          }
        });
      }
      const assignedId = newCoach.id || newCoach.email;
      if (!Array.isArray(store.coachClubs)) store.coachClubs = [];
      if (assignedId && !store.coachClubs.some((entry) => entry.userId === assignedId && entry.clubId === newClubId)) {
        store.coachClubs.push({ userId: assignedId, clubId: newClubId });
      }
      saveStore(store);
      return { status: 200, code: 'ok', team: clone(team) };
    },

    listPlayers(options) {
      if (shouldUseBackendPlayersMode()) {
        const filters = options || {};
        const params = new URLSearchParams();
        if (filters.teamName) params.set('teamName', filters.teamName);
        if (filters.query) params.set('query', filters.query);
        if (filters.actorEmail) params.set('actorEmail', filters.actorEmail);
        if (filters.onlyMine) params.set('onlyMine', 'true');

        const response = backendRequest('GET', '/players?' + params.toString());
        if (response.status === 200 && response.body && Array.isArray(response.body.data)) {
          return clone(response.body.data);
        }

        window.__MOCK_API_LAST_ERROR__ = response.body;
        return [];
      }

      const store = loadStore();
      const filters = options || {};
      const teamName = filters.teamName || 'all';
      const query = normalizeComparable(filters.query || '');

      // Coach and ClubAdmin are always club-scoped. onlyMine further narrows
      // to lead teams for Coach only. SystemAdmin / unknown: full roster.
      const actor = resolveActorContext(store, null, filters.actorEmail).actorUser;
      const isClubScoped = Boolean(
        actor && actor.status === 'active' && (actor.role === 'Coach' || actor.role === 'ClubAdmin')
      );
      let allowedTeamNames = null;
      if (isClubScoped) {
        const actorEmail = String(actor.email || '').trim().toLowerCase();
        const actorId = actor.id;
        const actorName = String(actor.name || '').trim().toLowerCase();
        const allowedClubIds = new Set(
          (store.coachClubs || [])
            .filter((entry) => {
              const id = entry.userId;
              return String(id) === String(actorId) || String(id).toLowerCase() === actorEmail;
            })
            .map((entry) => entry.clubId)
        );
        let clubTeams = (store.teams || []).filter((team) => allowedClubIds.has(team.clubId));
        // Fallback when coach_clubs is empty: teams this coach leads by email.
        if (!clubTeams.length) {
          clubTeams = (store.teams || []).filter((team) => {
            const teamEmail = String(team.leadCoachEmail || '').trim().toLowerCase();
            return teamEmail && teamEmail === actorEmail;
          });
        }
        if (filters.onlyMine && actor.role === 'Coach') {
          clubTeams = clubTeams.filter((team) => {
            const teamEmail = String(team.leadCoachEmail || '').trim().toLowerCase();
            if (teamEmail && teamEmail === actorEmail) {
              return true;
            }
            const teamCoachName = String(team.leadCoach || '').trim().toLowerCase();
            return teamCoachName && actorName && teamCoachName === actorName;
          });
        }
        allowedTeamNames = new Set(clubTeams.map((team) => team.name));
      }

      return clone(
        store.players
          .filter((player) => {
            const teamMatches = teamName === 'all' || player.teamName === teamName;
            const queryMatches = !query || normalizeComparable(player.name).includes(query) || normalizeComparable(player.position).includes(query);
            const clubScopeMatches = !allowedTeamNames || allowedTeamNames.has(player.teamName);
            return teamMatches && queryMatches && clubScopeMatches;
          })
          .map((player) => {
            const avatars = store.playerAvatars || {};
            const storedAvatar = avatars[player.id] || avatars[String(player.id)] || null;
            const anySkillRatings = listSkillsForPlayerOffline(store, player)
              .filter(function (row) {
                return String(row.positionName || '').toLowerCase() === 'any position';
              })
              .map(function (row) {
                const skill = (store.skills || []).find(function (entry) {
                  return String(entry.id) === String(row.skillId);
                });
                const abbreviation = (skill && skill.abbreviation)
                  || suggestSkillAbbreviation(row.skillName)
                  || '';
                return {
                  skillId: row.skillId,
                  skillName: row.skillName,
                  abbreviation: String(abbreviation).toUpperCase().slice(0, 3),
                  rating: row.rating
                };
              });
            return Object.assign({}, player, {
              avatarUrl: storedAvatar || player.avatarUrl || null,
              anySkillRatings: anySkillRatings,
              skillRatingsById: listSportSkillRatingsByIdOffline(store, player)
            });
          })
      );
    },

    getSuggestions(teamName, lookup) {
      if (shouldUseBackendPlayersMode()) {
        if (!teamName || teamName === 'all') {
          return [];
        }

        const query = normalizeComparable(lookup);
        const allPlayers = this.listPlayers({ teamName: 'all', query: query });
        return clone(
          allPlayers
            .filter((player) => player.teamName !== teamName)
            .filter((player) => !query || normalizeComparable(player.name).includes(query))
        );
      }

      const store = loadStore();
      if (!teamName || teamName === 'all') {
        return [];
      }
      const query = normalizeComparable(lookup);
      return clone(
        store.players
          .filter((player) => player.teamName !== teamName)
          .filter((player) => !query || player.normalizedName.includes(query))
      );
    },

    previewCreate(lookup, teamName) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/players/preview-create', {
          name: lookup,
          teamName: teamName
        });
        if (response.status === 200 && response.body && response.body.data) {
          return {
            ok: true,
            normalizedName: response.body.data.normalizedName,
            teamName: response.body.data.teamName,
            duplicatePlayer: response.body.data.duplicatePlayer || null
          };
        }

        return {
          ok: false,
          code: (response.body && response.body.code) || 'service_unavailable',
          message: (response.body && response.body.message) || 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.'
        };
      }

      const normalizedName = toTitleCase(lookup);
      const comparable = normalizeComparable(lookup);
      const validChars = /^[A-Za-z' -]+$/;

      if (!teamName || teamName === 'all') {
        return { ok: false, code: 'validation_error', message: 'Pick a team before adding players.' };
      }

      if (!normalizedName || normalizedName.length < 2 || normalizedName.length > 60 || !validChars.test(normalizedName)) {
        return { ok: false, code: 'validation_error', message: 'Player name must be 2-60 chars and use letters, spaces, apostrophe, or hyphen.' };
      }

      const store = loadStore();
      const duplicate = store.players.find((player) => player.normalizedName === comparable);
      return {
        ok: true,
        normalizedName,
        teamName,
        duplicatePlayer: duplicate ? clone(duplicate) : null
      };
    },

    addPlayerFlow(payload) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/players', {
          name: payload.lookup,
          teamName: payload.teamName,
          confirmCreate: Boolean(payload.confirmCreate),
          position: payload.position || '',
          birthMonth: payload.birthMonth == null ? null : Number(payload.birthMonth),
          birthYear: payload.birthYear == null ? null : Number(payload.birthYear)
        });
        if (response.status === 200 || response.status === 201 || response.status === 400 || response.status === 404 || response.status === 409) {
          return clone(response.body);
        }

        return {
          status: 503,
          code: 'service_unavailable',
          message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.'
        };
      }

      const store = loadStore();
      const teamName = payload.teamName;
      const lookup = payload.lookup;
      const confirmCreate = Boolean(payload.confirmCreate);

      const preview = this.previewCreate(lookup, teamName);
      if (!preview.ok) {
        return { status: 400, code: preview.code, message: preview.message };
      }

      const exactExisting = findPlayerByName(store, lookup);
      if (exactExisting) {
        const outcome = movePlayerToTeam(store, exactExisting, teamName);
        saveStore(store);
        return {
          status: 200,
          code: 'ok',
          moved: outcome.moved,
          player: clone(exactExisting),
          message: outcome.message
        };
      }

      if (preview.duplicatePlayer) {
        return {
          status: 409,
          code: 'conflict',
          message: 'A user with the same identifier already exists.',
          duplicatePlayer: clone(preview.duplicatePlayer)
        };
      }

      if (!confirmCreate) {
        return { status: 400, code: 'validation_error', message: 'Explicit confirmation is required to create this player.' };
      }

      // Strict-pair validation: birth month and year must be set together.
      // Empty strings collapse to null (NOT to 0 via Number('')) so the helper
      // correctly sees "both blank" when one input is left empty.
      const toBirthNumber = function (value) {
        if (value == null || value === '') return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
      };
      const birth = parseBirthFields({
        birthMonth: toBirthNumber(payload.birthMonth),
        birthYear: toBirthNumber(payload.birthYear)
      });
      if (birth.error) {
        return { status: 400, code: 'validation_error', message: birth.error };
      }

      const nextId = store.players.reduce((max, player) => Math.max(max, player.id), 0) + 1;
      // Resolve the requested position against the team's sport. If the caller
      // picked a value that doesn't exist for this team's sport we silently
      // fall back to "Position not set" — the dropdown in the UI should make
      // this unreachable, but offline callers may bypass it.
      const requestedPosition = String(payload.position || '').trim();
      const teamEntry = (store.teams || []).find(function (entry) { return entry.name === teamName; });
      const sportId = teamEntry ? (teamEntry.sportId || 'sport_soccer') : 'sport_soccer';
      const sportPositions = (store.positions || []).filter(function (position) {
        return position.sportId === sportId && position.status !== 'inactive';
      });
      const matchedPosition = requestedPosition
        ? sportPositions.find(function (position) { return position.name === requestedPosition; })
        : null;
      const created = {
        id: nextId,
        name: preview.normalizedName,
        normalizedName: normalizeComparable(preview.normalizedName),
        teamName,
        position: matchedPosition ? matchedPosition.name : 'Position not set',
        trend: 'plateau',
        updated: 'Updated just now',
        birthMonth: birth.birthMonth,
        birthYear: birth.birthYear
      };

      store.players.push(created);
      saveStore(store);

      return {
        status: 201,
        code: 'created',
        player: clone(created),
        message: created.name + ' created and assigned to ' + teamName + '.'
      };
    },

    assignExistingPlayer(playerId, teamName) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/players/' + encodeURIComponent(playerId) + '/assign', {
          teamName: teamName
        });
        if (response.status === 200 || response.status === 400 || response.status === 404) {
          return clone(response.body);
        }

        return {
          status: 503,
          code: 'service_unavailable',
          message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.'
        };
      }

      const store = loadStore();
      const player = store.players.find((entry) => entry.id === playerId);
      if (!player) {
        return { status: 404, code: 'not_found', message: 'The selected player was not found anymore. Refresh and try again.' };
      }

      const outcome = movePlayerToTeam(store, player, teamName);
      saveStore(store);
      return { status: 200, code: 'ok', moved: outcome.moved, player: clone(player), message: outcome.message };
    },

    listTeamSummary(options) {
      const filters = options || {};
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      // listTeams attaches session actorEmail and club-scopes Coach/ClubAdmin (live + offline).
      const teams = this.listTeams(params.toString());
      return clone(
        teams.map((team) => ({
          id: team.id,
          name: team.name,
          ageGroup: team.ageGroup,
          leadCoach: team.leadCoach,
          leadCoachEmail: team.leadCoachEmail || null,
          clubId: team.clubId || null,
          clubName: team.clubName || null,
          sportId: team.sportId || null,
          sportName: team.sportName || null,
          status: team.status || 'active',
          playerCount: Number(team.playerCount || 0)
        }))
      );
    },

    getTeamById(teamId) {
      const summary = this.listTeamSummary();
      return clone(summary.find((team) => String(team.id) === String(teamId)) || null);
    },

    getDashboardPlayer(playerName) {
      if (shouldUseBackendPlayersMode()) {
        const actorEmail = String(localStorage.getItem(SESSION_KEY) || '').trim().toLowerCase();
        const response = backendRequest(
          'GET',
          '/players/dashboard?playerName=' + encodeURIComponent(normalizeLookup(playerName || '')) + (actorEmail ? '&actorEmail=' + encodeURIComponent(actorEmail) : '')
        );

        if (response.status === 200 && response.body && response.body.data) {
          return clone(response.body.data);
        }

        if (response.status !== 0 && response.status !== 503) {
          window.__MOCK_API_LAST_ERROR__ = response.body;
          return null;
        }

        const store = loadStore();
        const selected = playerName ? findPlayerByName(store, playerName) : store.players[0];
        return selected ? buildDashboardSnapshot(store, selected) : null;
      }

      const store = loadStore();
      const selected = playerName ? findPlayerByName(store, playerName) : store.players[0];
      if (!selected) {
        return null;
      }
      return buildDashboardSnapshot(store, selected);
    },

    /** Guest read-only dashboard via opaque share token (Feature 034). */
    getDashboardByShareToken(shareToken) {
      const token = String(shareToken || '').trim();
      if (!token || !shouldUseBackendPlayersMode()) {
        return null;
      }
      const response = backendRequest(
        'GET',
        '/share/' + encodeURIComponent(token) + '/dashboard'
      );
      if (response.status === 200 && response.body && response.body.data) {
        return clone(response.body.data);
      }
      if (response.status !== 0 && response.status !== 503) {
        window.__MOCK_API_LAST_ERROR__ = response.body;
      }
      return null;
    },

    listClipsByShareToken(shareToken) {
      const token = String(shareToken || '').trim();
      if (!token || !shouldUseBackendPlayersMode()) {
        return [];
      }
      const response = backendRequest(
        'GET',
        '/share/' + encodeURIComponent(token) + '/clips'
      );
      if (response.status === 200 && response.body && Array.isArray(response.body.data)) {
        return clone(response.body.data);
      }
      return [];
    },

    clipMediaUrlForShare(shareToken, clipId, source) {
      const token = encodeURIComponent(String(shareToken || '').trim());
      const id = encodeURIComponent(String(clipId || '').trim());
      const sourceKey = String(source || 'first').trim().toLowerCase() === 'original'
        ? 'original'
        : 'first';
      return '/api/v1/share/' + token + '/clips/' + id + '/media?source=' + encodeURIComponent(sourceKey);
    },

    clipThumbnailUrlForShare(shareToken, clipId) {
      const token = encodeURIComponent(String(shareToken || '').trim());
      const id = encodeURIComponent(String(clipId || '').trim());
      return '/api/v1/share/' + token + '/clips/' + id + '/thumbnail';
    },

    getPlayerShareStatus(playerId) {
      if (!shouldUseBackendPlayersMode()) {
        return { active: false, shareId: null, createdAt: null };
      }
      const actorEmail = String(localStorage.getItem(SESSION_KEY) || '').trim().toLowerCase();
      const response = backendRequest(
        'GET',
        '/players/' + encodeURIComponent(playerId) + '/share' + (actorEmail ? '?actorEmail=' + encodeURIComponent(actorEmail) : '')
      );
      if (response.status === 200 && response.body && response.body.data) {
        return clone(response.body.data);
      }
      return { active: false, shareId: null, createdAt: null };
    },

    createPlayerShare(playerId) {
      if (!shouldUseBackendPlayersMode()) {
        return { status: 503, code: 'unavailable', message: 'Share links require the live backend.' };
      }
      const actorEmail = String(localStorage.getItem(SESSION_KEY) || '').trim().toLowerCase();
      const response = backendRequest(
        'POST',
        '/players/' + encodeURIComponent(playerId) + '/share' + (actorEmail ? '?actorEmail=' + encodeURIComponent(actorEmail) : ''),
        { actorEmail }
      );
      if (response.status === 200 && response.body && response.body.data) {
        return { status: 200, data: clone(response.body.data) };
      }
      return clone(Object.assign({ status: response.status || 500 }, response.body || {}));
    },

    revokePlayerShare(playerId) {
      if (!shouldUseBackendPlayersMode()) {
        return { status: 503, code: 'unavailable', message: 'Share links require the live backend.' };
      }
      const actorEmail = String(localStorage.getItem(SESSION_KEY) || '').trim().toLowerCase();
      const response = backendRequest(
        'DELETE',
        '/players/' + encodeURIComponent(playerId) + '/share' + (actorEmail ? '?actorEmail=' + encodeURIComponent(actorEmail) : ''),
        { actorEmail }
      );
      if (response.status === 200 && response.body && response.body.data) {
        return { status: 200, data: clone(response.body.data) };
      }
      return clone(Object.assign({ status: response.status || 500 }, response.body || {}));
    },

    getPlayerProfile(playerId) {
      if (shouldUseBackendPlayersMode()) {
        const actorEmail = String(localStorage.getItem(SESSION_KEY) || '').trim().toLowerCase();
        const response = backendRequest(
          'GET',
          '/players/' + encodeURIComponent(playerId) + '/profile' + (actorEmail ? '?actorEmail=' + encodeURIComponent(actorEmail) : '')
        );

        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, data: clone(response.body.data) };
        }

        if (response.status !== 0 && response.status !== 503) {
          window.__MOCK_API_LAST_ERROR__ = response.body;
          return clone(Object.assign({ status: response.status }, response.body || {}));
        }

        const fallbackStore = loadStore();
        const fallbackPlayer = fallbackStore.players.find(function (entry) { return String(entry.id) === String(playerId); });
        if (!fallbackPlayer) {
          return { status: 404, code: 'not_found', message: 'The selected player was not found anymore. Refresh and try again.' };
        }
        const fallbackSnapshot = buildDashboardSnapshot(fallbackStore, fallbackPlayer);
        return { status: 200, data: { player: fallbackSnapshot.player, stats: fallbackSnapshot.stats, skillRatings: fallbackSnapshot.skillRatings || [] } };
      }

      const store = loadStore();
      const player = store.players.find(function (entry) { return String(entry.id) === String(playerId); });
      if (!player) {
        return { status: 404, code: 'not_found', message: 'The selected player was not found anymore. Refresh and try again.' };
      }

      const snapshot = buildDashboardSnapshot(store, player);
      return { status: 200, data: { player: snapshot.player, stats: snapshot.stats, skillRatings: snapshot.skillRatings || [] } };
    },

    listPlayerSkillRatings(playerId) {
      if (shouldUseBackendPlayersMode()) {
        const actorEmail = String(localStorage.getItem(SESSION_KEY) || '').trim().toLowerCase();
        const response = backendRequest(
          'GET',
          '/players/' + encodeURIComponent(playerId) + '/skill-ratings' + (actorEmail ? '?actorEmail=' + encodeURIComponent(actorEmail) : '')
        );

        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, data: clone(response.body.data), skillRatings: clone(response.body.data.skillRatings || []) };
        }

        if (response.status !== 0 && response.status !== 503) {
          window.__MOCK_API_LAST_ERROR__ = response.body;
          return clone(Object.assign({ status: response.status }, response.body || {}));
        }
      }

      const store = loadStore();
      const player = store.players.find(function (entry) { return String(entry.id) === String(playerId); });
      if (!player) {
        return { status: 404, code: 'not_found', message: 'The selected player was not found anymore. Refresh and try again.' };
      }
      const skillRatings = listSkillsForPlayerOffline(store, player);
      return { status: 200, data: { skillRatings: clone(skillRatings) }, skillRatings: clone(skillRatings) };
    },

    listPlayerDataAudits(playerId, limit) {
      if (!shouldUseBackendPlayersMode()) {
        return { status: 200, data: { audits: [] }, audits: [] };
      }
      const actorEmail = String(localStorage.getItem(SESSION_KEY) || '').trim().toLowerCase();
      const query = [];
      if (actorEmail) {
        query.push('actorEmail=' + encodeURIComponent(actorEmail));
      }
      if (limit) {
        query.push('limit=' + encodeURIComponent(String(limit)));
      }
      const qs = query.length ? '?' + query.join('&') : '';
      const response = backendRequest(
        'GET',
        '/players/' + encodeURIComponent(playerId) + '/audits' + qs
      );
      if (response.status === 200 && response.body && response.body.data) {
        return {
          status: 200,
          data: clone(response.body.data),
          audits: clone(response.body.data.audits || [])
        };
      }
      if (response.status !== 0 && response.status !== 503) {
        window.__MOCK_API_LAST_ERROR__ = response.body;
        return clone(Object.assign({ status: response.status }, response.body || {}));
      }
      return { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable.' };
    },

    updatePlayerSkillRatings(playerId, payload) {
      if (shouldUseBackendPlayersMode()) {
        const actorEmail = String(localStorage.getItem(SESSION_KEY) || '').trim().toLowerCase();
        const response = backendRequest(
          'PUT',
          '/players/' + encodeURIComponent(playerId) + '/skill-ratings' + (actorEmail ? '?actorEmail=' + encodeURIComponent(actorEmail) : ''),
          payload
        );

        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', data: clone(response.body.data), skillRatings: clone(response.body.data.skillRatings || []) };
        }

        if (response.status !== 0 && response.status !== 503) {
          return clone(Object.assign({ status: response.status }, response.body || {}));
        }

        return {
          status: 503,
          code: 'service_unavailable',
          message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.'
        };
      }

      if (!payload || !Array.isArray(payload.ratings)) {
        return { status: 400, code: 'validation_error', message: 'ratings must be an array of { skillId, rating } objects.' };
      }

      const store = loadStore();
      const player = store.players.find(function (entry) { return String(entry.id) === String(playerId); });
      if (!player) {
        return { status: 404, code: 'not_found', message: 'The selected player was not found anymore. Refresh and try again.' };
      }

      const allowed = listSkillsForPlayerOffline(store, player);
      const allowedById = {};
      allowed.forEach(function (row) { allowedById[String(row.skillId)] = row; });

      store.playerSkillRatings = store.playerSkillRatings || [];

      for (let i = 0; i < payload.ratings.length; i += 1) {
        const entry = payload.ratings[i];
        const skillId = String((entry && entry.skillId) || '').trim();
        if (!skillId) {
          return { status: 400, code: 'validation_error', message: 'Each rating entry requires a non-empty skillId.' };
        }
        if (!allowedById[skillId]) {
          const skill = (store.skills || []).find(function (s) { return String(s.id) === skillId; });
          const skillName = skill ? skill.name : skillId;
          return {
            status: 400,
            code: 'validation_error',
            message: "Skill '" + skillName + "' is not tracked for the player's position '" + player.position + "'. Add it to the position in Manage Skills (S8) or change the player's position."
          };
        }

        let rating = null;
        if (entry.rating !== null && entry.rating !== undefined && entry.rating !== '') {
          if (typeof entry.rating === 'number' && !Number.isInteger(entry.rating)) {
            return { status: 400, code: 'validation_error', message: 'Skill rating must be a whole number from 0 to 100, or null.' };
          }
          rating = Number(entry.rating);
          if (!Number.isInteger(rating) || rating < 0 || rating > 100) {
            return { status: 400, code: 'validation_error', message: 'Skill rating must be a whole number from 0 to 100, or null.' };
          }
        }

        store.playerSkillRatings = store.playerSkillRatings.filter(function (row) {
          return !(String(row.playerId) === String(playerId) && String(row.skillId) === skillId);
        });
        if (rating !== null) {
          store.playerSkillRatings.push({ playerId: playerId, skillId: skillId, rating: rating });
        }
      }

      saveStore(store);
      const skillRatings = listSkillsForPlayerOffline(store, player);
      return { status: 200, code: 'ok', data: { skillRatings: clone(skillRatings) }, skillRatings: clone(skillRatings) };
    },

    updatePlayerProfile(playerId, payload) {
      if (shouldUseBackendPlayersMode()) {
        const actorEmail = String(localStorage.getItem(SESSION_KEY) || '').trim().toLowerCase();
        const response = backendRequest(
          'PATCH',
          '/players/' + encodeURIComponent(playerId) + (actorEmail ? '?actorEmail=' + encodeURIComponent(actorEmail) : ''),
          payload
        );

        if (response.status === 200 && response.body && response.body.data) {
          const data = clone(response.body.data);
          return {
            status: 200,
            code: 'ok',
            data: data,
            player: data.player || null,
            skillRatings: clone(data.skillRatings || [])
          };
        }

        if (response.status !== 0 && response.status !== 503) {
          return clone(Object.assign({ status: response.status }, response.body || {}));
        }

        return {
          status: 503,
          code: 'service_unavailable',
          message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.'
        };
      }

      const parsed = parseUpdateProfilePayload(payload);
      if (parsed.error) {
        return { status: 400, code: 'validation_error', message: parsed.error };
      }

      const store = loadStore();
      const player = store.players.find(function (entry) { return String(entry.id) === String(playerId); });
      if (!player) {
        return { status: 404, code: 'not_found', message: 'The selected player was not found anymore. Refresh and try again.' };
      }

      const team = findTeamByName(store, parsed.identity.teamName);
      if (!team) {
        return { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' };
      }

      const conflict = store.players.find(function (entry) {
        return entry.normalizedName === parsed.identity.normalizedName && String(entry.id) !== String(playerId);
      });
      if (conflict) {
        return { status: 409, code: 'conflict', message: 'Another player already uses that name.' };
      }

      const previousPosition = String(player.position || '');
      player.name = parsed.identity.name;
      player.normalizedName = parsed.identity.normalizedName;
      player.position = parsed.identity.position;
      player.trend = parsed.identity.trend;
      player.teamName = team.name;
      player.updated = 'Updated just now';
      // Persist the birth date pair verbatim -- parseUpdateProfilePayload has
      // already enforced the strict-pair rule above, so both values are
      // either set together or null together here.
      player.birthMonth = parsed.identity.birthMonth;
      player.birthYear = parsed.identity.birthYear;

      if (parsed.identity.avatarUrl !== undefined && parsed.identity.avatarUrl !== null) {
        store.playerAvatars = store.playerAvatars || {};
        store.playerAvatars[player.id] = parsed.identity.avatarUrl;
      }

      store.playerStats = store.playerStats || {};
      store.playerStats[player.id] = clone(parsed.stats);

      if (String(player.position || '') !== previousPosition) {
        const sportId = team.sportId || 'sport_soccer';
        const positionName = String(player.position || '').trim();
        let positionId = null;
        if (positionName && positionName !== 'Position not set') {
          const position = (store.positions || []).find(function (entry) {
            return String(entry.sportId) === String(sportId)
              && String(entry.name || '').toLowerCase() === positionName.toLowerCase();
          });
          positionId = position ? position.id : null;
        }
        replaceSkillRatingsForPositionOffline(store, player.id, positionId);
      }

      saveStore(store);

      const snapshot = buildDashboardSnapshot(store, player);
      return {
        status: 200,
        code: 'ok',
        data: { player: snapshot.player, stats: snapshot.stats, skillRatings: snapshot.skillRatings || [] },
        player: snapshot.player,
        skillRatings: snapshot.skillRatings || []
      };
    },

    updatePlayerAvatar(playerId, avatarDataUrl) {
      if (shouldUseBackendPlayersMode()) {
        const actorEmail = String(localStorage.getItem(SESSION_KEY) || '').trim().toLowerCase();
        // PATCH /v1/players/{id} runs the full parseUpdateProfilePayload validator,
        // which requires name, teamName, position, and trend. Read the current
        // profile first so the avatar-only write merges with the existing
        // identity fields instead of failing validation.
        const profileResponse = this.getPlayerProfile(playerId);
        if (!profileResponse || profileResponse.status !== 200 || !profileResponse.data || !profileResponse.data.player) {
          return clone(
            (profileResponse && profileResponse.message)
              ? profileResponse
              : { status: 404, code: 'not_found', message: 'The selected player was not found anymore. Refresh and try again.' }
          );
        }
        const player = profileResponse.data.player;
        const stats = profileResponse.data.stats || {};
        const payload = {
          name: player.name,
          teamName: player.teamName,
          position: player.position,
          trend: player.trend,
          avatarUrl: avatarDataUrl,
          growthStatus: stats.growthStatus,
          currentLevel: stats.currentLevel,
          fitness: stats.fitness,
          skillProgress: stats.skillProgress,
          totalMinutes: stats.totalMinutes,
          appearances: stats.appearances,
          recentAvg: stats.recentAvg,
          averageScore: stats.averageScore,
          lastMatchScore: stats.lastMatchScore,
          lastMatchSummary: stats.lastMatchSummary,
          clipSubmittedCount: stats.clipSubmittedCount,
          clipAssessedCount: stats.clipAssessedCount,
          clipPendingCount: stats.clipPendingCount
        };
        const response = backendRequest(
          'PATCH',
          '/players/' + encodeURIComponent(playerId) + (actorEmail ? '?actorEmail=' + encodeURIComponent(actorEmail) : ''),
          payload
        );

        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', avatarUrl: response.body.data.player ? response.body.data.player.avatarUrl : avatarDataUrl };
        }

        if (response.status !== 0 && response.status !== 503) {
          return clone(Object.assign({ status: response.status }, response.body || {}));
        }

        return {
          status: 503,
          code: 'service_unavailable',
          message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.'
        };
      }

      const store = loadStore();
      const player = store.players.find(function (entry) { return String(entry.id) === String(playerId); });
      if (!player) {
        return { status: 404, code: 'not_found', message: 'The selected player was not found anymore. Refresh and try again.' };
      }

      store.playerAvatars = store.playerAvatars || {};
      store.playerAvatars[player.id] = avatarDataUrl;
      saveStore(store);
      return { status: 200, code: 'ok', avatarUrl: avatarDataUrl };
    },

    /**
     * Reads a File, converts it to a 100x100 JPEG data-URL via canvas, then
     * calls updatePlayerAvatar and returns the result.
     * Returns { error: string } on validation failure.
     */
    uploadPlayerAvatar(playerId, file) {
      if (!file || !file.type.startsWith('image/')) {
        return { error: 'Please select an image file (JPEG, PNG, WebP, or GIF).' };
      }
      if (file.size > 5 * 1024 * 1024) {
        return { error: 'Image must be smaller than 5 MB.' };
      }

      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function (e) {
          var img = new Image();
          img.onload = function () {
            var canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            var ctx = canvas.getContext('2d');
            var size = Math.min(img.width, img.height);
            var sx = (img.width - size) / 2;
            var sy = (img.height - size) / 2;
            ctx.drawImage(img, sx, sy, size, size, 0, 0, 100, 100);
            var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            var result = MockupApi.updatePlayerAvatar(playerId, dataUrl);
            resolve(result);
          };
          img.onerror = function () {
            resolve({ error: 'Could not read the image file. Please try another.' });
          };
          img.src = e.target.result;
        };
        reader.onerror = function () {
          resolve({ error: 'Could not read the file. Please try again.' });
        };
        reader.readAsDataURL(file);
      });
    },

    /**
     * Applies avatarUrl to an avatar container.
     * @param {string} imgElId - The id of the <img> element (e.g. 'playerAvatarImg'
     *   or 's5AvatarImg'). The function derives the emoji span id by stripping
     *   the 'Img' suffix and appending 'Emoji'.
     * @param {string|null} avatarUrl
     */
    applyAvatar(imgElId, avatarUrl) {
      if (!imgElId) return;
      var emojiId = imgElId.replace(/Img$/, 'Emoji');
      var imgEl = document.getElementById(imgElId);
      var emojiEl = document.getElementById(emojiId);
      if (!imgEl || !emojiEl) return;
      if (avatarUrl) {
        imgEl.src = avatarUrl;
        imgEl.style.display = 'block';
        emojiEl.style.display = 'none';
      } else {
        imgEl.style.display = 'none';
        emojiEl.style.display = '';
      }
    },

    /**
     * Toggle visibility of every [data-role-visible-to] element based on the
     * current user's role. Elements without the attribute remain untouched.
     * Used by the bottom-nav across mockups so coaches never see the
     * SystemAdmin-only "Clubs" / "Users" entries and SystemAdmin sessions
     * see all six nav items.
     *
     * @param {object|null} [currentUser] Optional pre-resolved user; if omitted
     *   the function reads `getCurrentUser()`. Pass it when the caller already
     *   has the user row (avoids a redundant localStorage round-trip).
     */
    applyRoleGatedNav(currentUser) {
      var user = currentUser || this.getCurrentUser();
      var role = (user && user.role) ? String(user.role) : '';
      var isActive = Boolean(user && user.status === 'active');
      var nodes = document.querySelectorAll('[data-role-visible-to]');
      for (var i = 0; i < nodes.length; i += 1) {
        var allowedAttr = nodes[i].getAttribute('data-role-visible-to');
        if (!allowedAttr) continue;
        var allowedRoles = String(allowedAttr).split(',').map(function (part) {
          return part.trim();
        }).filter(Boolean);
        var visible = isActive && allowedRoles.indexOf(role) !== -1;
        // The hidden attribute wins over inline display; setting both keeps
        // the element out of the layout even when a previous script toggled
        // style.display inline.
        if (visible) {
          nodes[i].hidden = false;
          nodes[i].style.removeProperty('display');
        } else {
          nodes[i].hidden = true;
          nodes[i].style.display = 'none';
        }
      }
    },

    /**
     * Wires mouseenter/mouseleave on the avatar container to show/hide the
     * camera-overlay div. Pass the container element or its ID.
     */
    initAvatarHover(containerEl) {
      var el = typeof containerEl === 'string' ? document.getElementById(containerEl) : containerEl;
      if (!el) return;
      var overlay = el.querySelector('[id$="Overlay"]') || document.getElementById(el.id + 'Overlay');
      if (!overlay) return;
      el.addEventListener('mouseenter', function () { overlay.style.display = 'flex'; });
      el.addEventListener('mouseleave', function () { overlay.style.display = 'none'; });
    },

    listClips(filters) {
      const options = filters || {};
      const teamName = options.teamName || 'all';
      const status = options.status || 'all';
      const playerId = options.playerId != null && options.playerId !== '' ? String(options.playerId) : '';
      const playerName = normalizeLookup(options.playerName || '');
      const session = this.getCurrentUser();
      const actorEmail = String(
        options.actorEmail || (session && session.email) || ''
      ).trim().toLowerCase();

      if (shouldUseBackendPlayersMode()) {
        const params = new URLSearchParams();
        if (teamName !== 'all') {
          params.set('teamName', teamName);
        }
        if (status !== 'all') {
          params.set('status', status);
        }
        if (playerId) {
          params.set('playerId', playerId);
        } else if (playerName) {
          params.set('playerName', playerName);
        }
        if (actorEmail) {
          params.set('actorEmail', actorEmail);
        }
        const query = params.toString();
        const response = backendRequest('GET', '/clips' + (query ? '?' + query : ''));
        if (response.status === 200 && response.body && Array.isArray(response.body.data)) {
          return clone(response.body.data);
        }
        window.__MOCK_API_LAST_ERROR__ = response.body;
        return [];
      }

      const store = loadStore();
      let allowedClubIds = null;
      if (actorEmail) {
        const actor = store.users.find(function (user) {
          return String(user.email || '').toLowerCase() === actorEmail;
        });
        if (
          actor &&
          actor.status === 'active' &&
          (actor.role === 'Coach' || actor.role === 'ClubAdmin')
        ) {
          allowedClubIds = new Set(
            (store.coachClubs || [])
              .filter(function (entry) {
                return String(entry.userId) === String(actor.id) || String(entry.userId) === String(actor.email);
              })
              .map(function (entry) {
                return entry.clubId;
              })
          );
        } else if (!actor || actor.role !== 'SystemAdmin' || actor.status !== 'active') {
          return [];
        }
      }

      const rows = store.clips
        .map((clip) => {
          const player = store.players.find((entry) => entry.id === clip.playerId);
          return {
            id: clip.id,
            playerId: clip.playerId,
            playerName: player ? player.name : 'Unknown Player',
            teamName: player ? player.teamName : 'Unknown Team',
            situation: clip.situation,
            status: clip.status,
            score: clip.score,
            summary: clip.summary,
            comments: clip.comments || null,
            errorMessage: clip.errorMessage || null,
            submittedAt: clip.submittedAt,
            skill: clip.skill,
            skillFocus: Array.isArray(clip.skillFocus) ? clone(clip.skillFocus) : (clip.skill ? [clip.skill] : []),
            skillRatings: clip.skillRatings && typeof clip.skillRatings === 'object' ? clone(clip.skillRatings) : null,
            path: clip.path || null,
            sourceUrl: clip.sourceUrl || null,
            segments: Array.isArray(clip.segments) ? clone(clip.segments) : []
          };
        })
        .filter((clip) => {
          if (!allowedClubIds) return true;
          const team = (store.teams || []).find(function (entry) {
            return entry.name === clip.teamName;
          });
          return team && allowedClubIds.has(team.clubId);
        })
        .filter((clip) => (teamName === 'all' ? true : clip.teamName === teamName))
        .filter((clip) => {
          if (playerId) {
            return String(clip.playerId) === playerId;
          }
          if (playerName) {
            return String(clip.playerName || '').toLowerCase() === playerName.toLowerCase();
          }
          return true;
        })
        .filter((clip) => {
          if (status === 'all') {
            return true;
          }
          if (status === 'assessed' || status === 'complete') {
            return isClipCompleteStatus(clip.status);
          }
          if (status === 'pending' || status === 'submitted') {
            return isClipPendingStatus(clip.status);
          }
          return clip.status === status;
        });

      return clone(rows);
    },

    /**
     * Build the HTTP media URL for a clip. source is "first" (first segment,
     * server may fall back to original) or "original".
     */
    clipMediaUrl(clipId, source) {
      const id = encodeURIComponent(String(clipId || '').trim());
      const sourceKey = String(source || 'first').trim().toLowerCase() === 'original'
        ? 'original'
        : 'first';
      return '/api/v1/clips/' + id + '/media?source=' + encodeURIComponent(sourceKey);
    },

    /** HTTP URL for the process-time JPEG poster (404 when missing). */
    clipThumbnailUrl(clipId) {
      const id = encodeURIComponent(String(clipId || '').trim());
      return '/api/v1/clips/' + id + '/thumbnail';
    },

    /**
     * Choose media source for a clip payload: first segment when any exist,
     * otherwise original when path is present, otherwise null (unavailable).
     */
    resolveClipMediaSource(clip) {
      if (!clip || clip.id == null) {
        return null;
      }
      const segments = Array.isArray(clip.segments) ? clip.segments : [];
      if (segments.length > 0) {
        return { clipId: clip.id, source: 'first' };
      }
      if (clip.path) {
        return { clipId: clip.id, source: 'original' };
      }
      return null;
    },

    submitClip(payload) {
      const situation = normalizeLookup(payload.situation);
      const skillFocus = Array.isArray(payload.skillFocus)
        ? payload.skillFocus.map((entry) => normalizeLookup(entry)).filter(Boolean)
        : [];
      const primarySkill = skillFocus[0] || normalizeLookup(payload.skill || 'General') || 'General';
      const videoUrl = payload.videoUrl ? String(payload.videoUrl).trim() : '';
      const isLinkMode = Boolean(videoUrl);

      if (shouldUseBackendPlayersMode()) {
        if (!isLinkMode && !payload.videoFile) {
          return {
            status: 400,
            code: 'validation_error',
            message: 'A video file or video URL is required before submitting for assessment.'
          };
        }

        const formData = new FormData();
        if (payload.playerId) {
          formData.append('playerId', String(payload.playerId));
        }
        if (payload.playerName) {
          formData.append('playerName', payload.playerName);
        }
        formData.append('situation', situation);
        formData.append('skillFocus', JSON.stringify(skillFocus.length ? skillFocus : [primarySkill]));
        formData.append('skill', primarySkill);
        formData.append('findPlayer', payload.findPlayer ? 'true' : 'false');
        if (isLinkMode) {
          formData.append('videoUrl', videoUrl);
          formData.append('startMmSs', String(payload.startMmSs || '00:00'));
          formData.append('durationMmSs', String(payload.durationMmSs || '01:00'));
        } else {
          formData.append('video', payload.videoFile, payload.videoFile.name || 'clip.mp4');
        }

        const response = backendMultipartRequest('/clips', formData);
        if (response.status >= 200 && response.status < 300) {
          return {
            status: response.status,
            code: 'submitted',
            message: 'Clip submitted for assessment. Processing will begin shortly.',
            data: response.body && response.body.data ? response.body.data : null
          };
        }

        const errorBody = response.body || {};
        return {
          status: response.status || 500,
          code: errorBody.code || 'unknown',
          message: errorBody.message || 'Clip submission failed. Please try again.'
        };
      }

      if (isLinkMode) {
        return {
          status: 503,
          code: 'service_unavailable',
          message: 'Video link ingest requires backend mode (DATABASE_URL). Use Upload File in offline mock mode.'
        };
      }

      const store = loadStore();
      const player = payload.playerId
        ? store.players.find((entry) => String(entry.id) === String(payload.playerId))
        : findPlayerByName(store, payload.playerName);
      if (!player || !situation) {
        return { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' };
      }

      const nextId = store.clips.reduce((max, clip) => Math.max(max, clip.id), 0) + 1;
      store.clips.push({
        id: nextId,
        playerId: player.id,
        situation: situation,
        status: 'submitted',
        score: null,
        summary: '',
        submittedAt: 'Submitted just now',
        skill: primarySkill,
        skillFocus: skillFocus.length ? skillFocus : [primarySkill]
      });

      saveStore(store);
      return { status: 202, code: 'submitted', message: 'Clip submitted for assessment! Processing will begin shortly.' };
    },

    reprocessClip(clipId, payload) {
      const id = String(clipId || '').trim();
      const actorEmail = String((payload && payload.actorEmail) || '').trim().toLowerCase();
      if (!id) {
        return { status: 400, code: 'validation_error', message: 'Clip id is required.' };
      }
      if (!actorEmail) {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/clips/' + encodeURIComponent(id) + '/reprocess', {
          actorEmail: actorEmail
        });
        if (response.status >= 200 && response.status < 300) {
          return {
            status: response.status,
            code: 'submitted',
            message: 'Clip queued for re-processing.',
            data: response.body && response.body.data ? response.body.data : null
          };
        }
        const errorBody = response.body || {};
        return {
          status: response.status || 500,
          code: errorBody.code || 'unknown',
          message: errorBody.message || 'Re-process failed. Please try again.'
        };
      }

      const store = loadStore();
      const actor = (store.users || []).find(function (user) {
        return String(user.email || '').toLowerCase() === actorEmail;
      });
      if (
        !actor ||
        actor.status !== 'active' ||
        (actor.role !== 'Coach' && actor.role !== 'ClubAdmin' && actor.role !== 'SystemAdmin')
      ) {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const clip = (store.clips || []).find(function (entry) {
        return String(entry.id) === id;
      });
      if (!clip) {
        return { status: 404, code: 'not_found', message: 'The selected clip was not found anymore. Refresh and try again.' };
      }
      const clipStatus = String(clip.status || '').toLowerCase();
      if (clipStatus !== 'failed' && clipStatus !== 'complete' && clipStatus !== 'assessed') {
        return {
          status: 409,
          code: 'conflict',
          message: 'Only failed or complete clips can be re-processed.'
        };
      }

      if (actor.role === 'Coach' || actor.role === 'ClubAdmin') {
        const player = (store.players || []).find(function (entry) {
          return String(entry.id) === String(clip.playerId);
        });
        const team = player
          ? (store.teams || []).find(function (entry) {
              return entry.name === player.teamName;
            })
          : null;
        const allowed = new Set(
          (store.coachClubs || [])
            .filter(function (entry) {
              return String(entry.userId) === String(actor.id) || String(entry.userId) === String(actor.email);
            })
            .map(function (entry) {
              return String(entry.clubId);
            })
        );
        if (!team || !allowed.has(String(team.clubId))) {
          return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
        }
      }

      const hasPath = Boolean(String(clip.path || '').trim());
      clip.status = 'submitted';
      clip.errorMessage = null;
      clip.comments = null;
      clip.score = null;
      clip.summary = '';
      clip.skillRatings = null;
      clip.submittedAt = 'Submitted just now';
      if (!hasPath) {
        clip.findPlayer = false;
      }
      saveStore(store);
      return {
        status: 202,
        code: 'submitted',
        message: 'Clip queued for re-processing.',
        data: clone(clip)
      };
    },

    deleteClip(clipId, payload) {
      const id = String(clipId || '').trim();
      const actorEmail = String((payload && payload.actorEmail) || '').trim().toLowerCase();
      if (!id) {
        return { status: 400, code: 'validation_error', message: 'Clip id is required.' };
      }
      if (!actorEmail) {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('DELETE', '/clips/' + encodeURIComponent(id), {
          actorEmail: actorEmail
        });
        if (response.status === 204 || (response.status >= 200 && response.status < 300)) {
          return { status: 204, code: 'deleted', message: 'Clip deleted.' };
        }
        const errorBody = response.body || {};
        return {
          status: response.status || 500,
          code: errorBody.code || 'unknown',
          message: errorBody.message || 'Delete failed. Please try again.'
        };
      }

      const store = loadStore();
      const actor = (store.users || []).find(function (user) {
        return String(user.email || '').toLowerCase() === actorEmail;
      });
      if (
        !actor ||
        actor.status !== 'active' ||
        (actor.role !== 'Coach' && actor.role !== 'ClubAdmin' && actor.role !== 'SystemAdmin')
      ) {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const clipIndex = (store.clips || []).findIndex(function (entry) {
        return String(entry.id) === id;
      });
      if (clipIndex < 0) {
        return { status: 404, code: 'not_found', message: 'The selected clip was not found anymore. Refresh and try again.' };
      }
      const clip = store.clips[clipIndex];

      if (actor.role === 'Coach' || actor.role === 'ClubAdmin') {
        const player = (store.players || []).find(function (entry) {
          return String(entry.id) === String(clip.playerId);
        });
        const team = player
          ? (store.teams || []).find(function (entry) {
              return entry.name === player.teamName;
            })
          : null;
        const allowed = new Set(
          (store.coachClubs || [])
            .filter(function (entry) {
              return String(entry.userId) === String(actor.id) || String(entry.userId) === String(actor.email);
            })
            .map(function (entry) {
              return String(entry.clubId);
            })
        );
        if (!team || !allowed.has(String(team.clubId))) {
          return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
        }
      }

      store.clips.splice(clipIndex, 1);
      saveStore(store);
      return { status: 204, code: 'deleted', message: 'Clip deleted.' };
    },

    listUsers() {
      const session = this.getCurrentUser();
      const actorEmail = session && session.email ? String(session.email).trim().toLowerCase() : '';
      if (shouldUseBackendPlayersMode()) {
        const params = new URLSearchParams();
        if (actorEmail) params.set('actorEmail', actorEmail);
        const query = params.toString() ? '?' + params.toString() : '';
        const response = backendRequest('GET', '/users' + query);
        if (response.status === 200 && response.body && Array.isArray(response.body.data)) {
          return clone(response.body.data.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            password: user.password || '',
            lastLogin: user.lastLogin || 'Unknown',
            clubIds: Array.isArray(user.clubIds) ? user.clubIds : []
          })));
        }

        window.__MOCK_API_LAST_ERROR__ = response.body;
        return [];
      }

      const store = loadStore();
      if (!Array.isArray(store.coachClubs)) {
        store.coachClubs = [];
      }
      let users = (store.users || []).map(function (user) {
        const clubIds = store.coachClubs
          .filter(function (entry) {
            return String(entry.userId) === String(user.id);
          })
          .map(function (entry) {
            return entry.clubId;
          });
        return Object.assign({}, user, { clubIds: clubIds });
      });
      if (session && session.role === 'ClubAdmin' && session.status === 'active') {
        const allowed = new Set(
          store.coachClubs
            .filter(function (entry) {
              return String(entry.userId) === String(session.id);
            })
            .map(function (entry) {
              return String(entry.clubId);
            })
        );
        users = users.filter(function (user) {
          return (user.clubIds || []).some(function (clubId) {
            return allowed.has(String(clubId));
          });
        });
      }
      return clone(users);
    },

    createUser(payload, actorRole) {
      const session = this.getCurrentUser();
      const actorEmail = (payload && payload.actorEmail) || (session && session.email) || '';
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/users', {
          name: payload && payload.name,
          email: payload && payload.email,
          role: payload && payload.role,
          password: payload && payload.password,
          clubId: payload && payload.clubId,
          actorRole,
          actorEmail
        });

        if (response.status === 201 && response.body && response.body.data) {
          return { status: 201, code: 'created', user: clone(response.body.data) };
        }

        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.' });
      }

      const effectiveRole = (session && session.role) || actorRole;
      if (effectiveRole !== 'SystemAdmin' && effectiveRole !== 'ClubAdmin') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const store = loadStore();
      const email = String(payload.email || '').trim().toLowerCase();
      const name = normalizeLookup(payload.name);
      const role = payload.role;
      const password = String(payload.password || '').trim();
      const hasNumber = /\d/.test(password);
      const allowedRoles = effectiveRole === 'SystemAdmin'
        ? ['SystemAdmin', 'Coach', 'ClubAdmin']
        : ['Coach', 'ClubAdmin'];

      if (!name || !email.includes('@') || !allowedRoles.includes(role) || password.length < 10 || !hasNumber) {
        return { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' };
      }

      if (store.users.some((user) => user.email.toLowerCase() === email)) {
        return { status: 409, code: 'conflict', message: 'A user with the same identifier already exists.' };
      }

      const nextId = 'u_' + Date.now();
      const created = {
        id: nextId,
        name,
        email,
        role,
        status: 'active',
        password,
        lastLogin: 'Just now'
      };

      const clubRequired = role !== 'SystemAdmin';
      let clubId = String((payload && payload.clubId) || '').trim();
      const adminClubs = session
        ? (store.coachClubs || []).filter(function (entry) {
            return String(entry.userId) === String(session.id);
          })
        : [];
      const adminClubIds = adminClubs.map(function (entry) {
        return entry.clubId;
      });

      if (effectiveRole === 'ClubAdmin') {
        if (!clubId && adminClubIds.length === 1) {
          clubId = adminClubIds[0];
        }
        if (!clubId) {
          return { status: 400, code: 'validation_error', message: 'Please assign a club before creating this user.' };
        }
        if (adminClubIds.indexOf(clubId) === -1) {
          return { status: 403, code: 'forbidden_scope', message: 'You can only assign clubs you belong to.' };
        }
      } else if (clubRequired && !clubId) {
        return { status: 400, code: 'validation_error', message: 'Please assign a club before creating this user.' };
      }

      if (clubId) {
        const club = (store.clubs || []).find(function (entry) {
          return entry.id === clubId;
        });
        if (!club) {
          return { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' };
        }
      }

      store.users.push(created);
      if (clubId) {
        if (!Array.isArray(store.coachClubs)) store.coachClubs = [];
        if (!store.coachClubs.some(function (entry) {
          return String(entry.userId) === String(nextId) && entry.clubId === clubId;
        })) {
          store.coachClubs.push({ userId: nextId, clubId: clubId });
        }
      }
      saveStore(store);
      const result = clone(created);
      result.clubIds = clubId ? [clubId] : [];
      return { status: 201, code: 'created', user: result };
    },

    changeRole(email, role, actorRole) {
      const session = this.getCurrentUser();
      const actorEmail = (session && session.email) || '';
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/users/' + encodeURIComponent(email) + '/role', {
          role,
          actorRole,
          actorEmail
        });

        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', user: clone(response.body.data) };
        }

        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.' });
      }

      const effectiveRole = (session && session.role) || actorRole;
      if (effectiveRole !== 'SystemAdmin' && effectiveRole !== 'ClubAdmin') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const store = loadStore();
      const user = store.users.find((entry) => entry.email.toLowerCase() === String(email || '').trim().toLowerCase());
      if (!user) {
        return { status: 404, code: 'not_found', message: 'The selected user was not found anymore. Refresh and try again.' };
      }
      const allowedRoles = effectiveRole === 'SystemAdmin'
        ? ['SystemAdmin', 'Coach', 'ClubAdmin']
        : ['Coach', 'ClubAdmin'];
      if (!allowedRoles.includes(role)) {
        return { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' };
      }
      if (effectiveRole === 'ClubAdmin' && !offlineClubAdminMayManageUser(store, session, user)) {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      user.role = role;
      saveStore(store);
      return { status: 200, code: 'ok', user: clone(user) };
    },

    changePassword(email, password, confirmPassword, actorRole) {
      const session = this.getCurrentUser();
      const actorEmail = (session && session.email) || '';
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/users/' + encodeURIComponent(email) + '/password', {
          password,
          confirmPassword,
          actorRole,
          actorEmail
        });

        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', user: clone(response.body.data) };
        }

        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.' });
      }

      const effectiveRole = (session && session.role) || actorRole;
      if (effectiveRole !== 'SystemAdmin' && effectiveRole !== 'ClubAdmin') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const store = loadStore();
      const user = store.users.find((entry) => entry.email.toLowerCase() === String(email || '').trim().toLowerCase());
      if (!user) {
        return { status: 404, code: 'not_found', message: 'The selected user was not found anymore. Refresh and try again.' };
      }
      if (effectiveRole === 'ClubAdmin' && !offlineClubAdminMayManageUser(store, session, user)) {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const hasNumber = /\d/.test(String(password || ''));
      if (String(password || '').trim().length < 10 || !hasNumber || password !== confirmPassword) {
        return { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' };
      }

      user.password = password;
      saveStore(store);
      return { status: 204, code: 'ok' };
    },

    deactivateUser(email, actorRole) {
      const session = this.getCurrentUser();
      const actorEmail = (session && session.email) || '';
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/users/' + encodeURIComponent(email) + '/deactivate', {
          actorRole,
          actorEmail
        });

        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', user: clone(response.body.data) };
        }

        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.' });
      }

      const effectiveRole = (session && session.role) || actorRole;
      if (effectiveRole !== 'SystemAdmin' && effectiveRole !== 'ClubAdmin') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const store = loadStore();
      const user = store.users.find((entry) => entry.email.toLowerCase() === String(email || '').trim().toLowerCase());
      if (!user) {
        return { status: 404, code: 'not_found', message: 'The selected user was not found anymore. Refresh and try again.' };
      }
      if (effectiveRole === 'ClubAdmin' && !offlineClubAdminMayManageUser(store, session, user)) {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      user.status = 'inactive';
      saveStore(store);
      return { status: 200, code: 'ok', user: clone(user) };
    },

    reactivateUser(email, actorRole) {
      const session = this.getCurrentUser();
      const actorEmail = (session && session.email) || '';
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/users/' + encodeURIComponent(email) + '/reactivate', {
          actorRole,
          actorEmail
        });

        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', user: clone(response.body.data) };
        }

        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.' });
      }

      const effectiveRole = (session && session.role) || actorRole;
      if (effectiveRole !== 'SystemAdmin' && effectiveRole !== 'ClubAdmin') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const store = loadStore();
      const user = store.users.find((entry) => entry.email.toLowerCase() === String(email || '').trim().toLowerCase());
      if (!user) {
        return { status: 404, code: 'not_found', message: 'The selected user was not found anymore. Refresh and try again.' };
      }
      if (effectiveRole === 'ClubAdmin' && !offlineClubAdminMayManageUser(store, session, user)) {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      user.status = 'active';
      saveStore(store);
      return { status: 200, code: 'ok', user: clone(user) };
    },

    login(email, password) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/auth/login', { email, password });
        if (response.status === 200 && response.body && response.body.user) {
          setSessionEmail(response.body.user.email);
          return { status: 200, token: response.body.token, role: response.body.role, user: clone(response.body.user) };
        }

        setSessionEmail('');
        return clone(response.body || { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' });
      }

      const store = loadStore();
      const user = store.users.find((entry) => entry.email.toLowerCase() === String(email || '').trim().toLowerCase());
      if (!user || user.status !== 'active' || user.password !== password) {
        setSessionEmail('');
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }
      setSessionEmail(user.email);
      return { status: 200, token: 'jwt-' + user.role.toLowerCase(), role: user.role, user: clone(user) };
    },

    logout() {
      setSessionEmail('');
    }
  };

  window.MockupApi = MockupApi;
})();
