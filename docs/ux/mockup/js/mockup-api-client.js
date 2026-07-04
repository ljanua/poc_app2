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

  function createSeed() {
    return {
      teams: [
        { id: 1, name: 'U17 Elite', ageGroup: 'U17', leadCoach: 'Ana Costa', leadCoachEmail: 'ana@vantageiq.club' },
        { id: 2, name: 'U19 Prime', ageGroup: 'U19', leadCoach: 'Joao Lima', leadCoachEmail: 'joao@vantageiq.club' },
        { id: 3, name: 'Senior Squad', ageGroup: '18+', leadCoach: 'Maria Alves', leadCoachEmail: 'maria@vantageiq.club' }
      ],
      players: [
        { id: 10, name: 'Lionel Messi', normalizedName: 'lionel messi', teamName: 'U19 Prime', position: 'Forward - Left Wing', trend: 'improving', updated: 'Updated 2h ago' },
        { id: 11, name: 'Cristiano Ronaldo', normalizedName: 'cristiano ronaldo', teamName: 'Senior Squad', position: 'Forward - Center Forward', trend: 'plateau', updated: 'Updated 5h ago' },
        { id: 12, name: 'Neymar Jr', normalizedName: 'neymar jr', teamName: 'U17 Elite', position: 'Forward - Right Wing', trend: 'declining', updated: 'Updated 1d ago' },
        { id: 13, name: 'Kylian Mbappe', normalizedName: 'kylian mbappe', teamName: 'Senior Squad', position: 'Forward - Center Forward', trend: 'improving', updated: 'Updated 3h ago' }
      ],
      clips: [
        { id: 1, playerId: 10, situation: 'Penalty kick attempt, 3rd minute', status: 'assessed', score: 4.2, summary: 'Confident execution under pressure.', submittedAt: '2 hours ago', skill: 'Decision-making' },
        { id: 2, playerId: 11, situation: 'Counter-attack, left wing run', status: 'assessed', score: 3.8, summary: 'Pace was strong, timing can improve.', submittedAt: '5 hours ago', skill: 'Pace & Agility' },
        { id: 3, playerId: 12, situation: 'One-on-one with goalkeeper', status: 'assessed', score: 4.5, summary: 'Excellent control and composure.', submittedAt: '1 day ago', skill: 'Technical Skill' },
        { id: 4, playerId: 13, situation: 'Sprint and finish, 45th minute', status: 'pending', score: null, summary: '', submittedAt: 'Submitted 1 hour ago', skill: 'Pace & Agility' }
      ],
      users: [
        { id: 1, name: 'Maria Alves', email: 'maria@vantageiq.club', role: 'SystemAdmin', status: 'active', password: 'SecurePass123', lastLogin: 'Today, 08:31' },
        { id: 2, name: 'Joao Lima', email: 'joao@vantageiq.club', role: 'Coach', status: 'active', password: 'SecurePass123', lastLogin: 'Yesterday' },
        { id: 3, name: 'Ana Costa', email: 'ana@vantageiq.club', role: 'Coach', status: 'inactive', password: 'SecurePass123', lastLogin: '6 days ago' }
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
      if (!parsed || !Array.isArray(parsed.players) || !Array.isArray(parsed.teams)) {
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

  function shouldForceLocalMode() {
    return window.__USE_MOCK_LOCAL__ === true;
  }

  function shouldUseBackendPlayersMode() {
    return !shouldForceLocalMode() && window.__USE_BACKEND__ !== false;
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

  function buildDashboardSnapshot(store, selected) {
    const clips = store.clips.filter((clip) => clip.playerId === selected.id);
    const assessed = clips.filter((clip) => clip.status === 'assessed');
    const pending = clips.filter((clip) => clip.status === 'pending');

    return clone({
      player: selected,
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
        missingDataMessage: assessed.length ? null : 'Performance metrics are not available yet.'
      },
      metrics: {
        currentLevel: selected.trend === 'improving' ? '92%' : selected.trend === 'declining' ? '81%' : '87%',
        fitness: selected.trend === 'declining' ? '79%' : '87%',
        skillProgress: selected.trend === 'improving' ? '94%' : '86%'
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

  const MockupApi = {
    reset() {
      const seed = createSeed();
      saveStore(seed);
      return clone(seed);
    },

    listTeams() {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('GET', '/teams');
        if (response.status === 200 && response.body && Array.isArray(response.body.data)) {
          return clone(response.body.data);
        }

        window.__MOCK_API_LAST_ERROR__ = response.body;
        return [];
      }

      return clone(loadStore().teams);
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

      if (!['SystemAdmin', 'Coach'].includes(role) || !sessionUser || sessionUser.status !== 'active') {
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

      const nextId = store.teams.reduce((max, team) => Math.max(max, team.id), 0) + 1;
      const created = {
        id: nextId,
        name: teamName,
        ageGroup,
        leadCoach: assignedCoach.name,
        leadCoachEmail: assignedCoach.email
      };

      store.teams.push(created);
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
      saveStore(store);
      return { status: 200, code: 'ok', team: clone(team) };
    },

    listPlayers(options) {
      if (shouldUseBackendPlayersMode()) {
        const filters = options || {};
        const params = new URLSearchParams();
        if (filters.teamName) params.set('teamName', filters.teamName);
        if (filters.query) params.set('query', filters.query);

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

      return clone(
        store.players.filter((player) => {
          const teamMatches = teamName === 'all' || player.teamName === teamName;
          const queryMatches = !query || normalizeComparable(player.name).includes(query) || normalizeComparable(player.position).includes(query);
          return teamMatches && queryMatches;
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
          confirmCreate: Boolean(payload.confirmCreate)
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

      const nextId = store.players.reduce((max, player) => Math.max(max, player.id), 0) + 1;
      const created = {
        id: nextId,
        name: preview.normalizedName,
        normalizedName: normalizeComparable(preview.normalizedName),
        teamName,
        position: 'Position not set',
        trend: 'plateau',
        updated: 'Updated just now'
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

    listTeamSummary() {
      if (shouldUseBackendPlayersMode()) {
        const teams = this.listTeams();
        return clone(
          teams.map((team) => ({
            id: team.id,
            name: team.name,
            ageGroup: team.ageGroup,
            leadCoach: team.leadCoach,
            leadCoachEmail: team.leadCoachEmail || null,
            playerCount: Number(team.playerCount || 0)
          }))
        );
      }

      const store = loadStore();
      return clone(
        store.teams.map((team) => {
          const playerCount = store.players.filter((player) => player.teamName === team.name).length;
          return {
            id: team.id,
            name: team.name,
            ageGroup: team.ageGroup,
            leadCoach: team.leadCoach,
            leadCoachEmail: team.leadCoachEmail || null,
            playerCount
          };
        })
      );
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

    listClips(filters) {
      const store = loadStore();
      const options = filters || {};
      const teamName = options.teamName || 'all';
      const status = options.status || 'all';

      const rows = store.clips
        .map((clip) => {
          const player = store.players.find((entry) => entry.id === clip.playerId);
          return {
            id: clip.id,
            playerName: player ? player.name : 'Unknown Player',
            teamName: player ? player.teamName : 'Unknown Team',
            situation: clip.situation,
            status: clip.status,
            score: clip.score,
            summary: clip.summary,
            submittedAt: clip.submittedAt,
            skill: clip.skill
          };
        })
        .filter((clip) => (teamName === 'all' ? true : clip.teamName === teamName))
        .filter((clip) => (status === 'all' ? true : clip.status === status));

      return clone(rows);
    },

    submitClip(payload) {
      const store = loadStore();
      const player = findPlayerByName(store, payload.playerName);
      if (!player || !normalizeLookup(payload.situation)) {
        return { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' };
      }

      const nextId = store.clips.reduce((max, clip) => Math.max(max, clip.id), 0) + 1;
      store.clips.push({
        id: nextId,
        playerId: player.id,
        situation: normalizeLookup(payload.situation),
        status: 'pending',
        score: null,
        summary: '',
        submittedAt: 'Submitted just now',
        skill: payload.skill || 'General'
      });

      saveStore(store);
      return { status: 202, code: 'queued', message: 'Clip submitted for assessment! You will see results in 4-6 hours.' };
    },

    listUsers() {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('GET', '/users');
        if (response.status === 200 && response.body && Array.isArray(response.body.data)) {
          return clone(response.body.data.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            password: user.password || '',
            lastLogin: user.lastLogin || 'Unknown'
          })));
        }

        window.__MOCK_API_LAST_ERROR__ = response.body;
        return [];
      }

      return clone(loadStore().users);
    },

    createUser(payload, actorRole) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/users', {
          name: payload && payload.name,
          email: payload && payload.email,
          role: payload && payload.role,
          password: payload && payload.password,
          actorRole
        });

        if (response.status === 201 && response.body && response.body.data) {
          return { status: 201, code: 'created', user: clone(response.body.data) };
        }

        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.' });
      }

      if (actorRole !== 'SystemAdmin') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const store = loadStore();
      const email = String(payload.email || '').trim().toLowerCase();
      const name = normalizeLookup(payload.name);
      const role = payload.role;
      const password = String(payload.password || '').trim();
      const hasNumber = /\d/.test(password);

      if (!name || !email.includes('@') || !['SystemAdmin', 'Coach'].includes(role) || password.length < 10 || !hasNumber) {
        return { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' };
      }

      if (store.users.some((user) => user.email.toLowerCase() === email)) {
        return { status: 409, code: 'conflict', message: 'A user with the same identifier already exists.' };
      }

      const nextId = store.users.reduce((max, user) => Math.max(max, user.id), 0) + 1;
      const created = {
        id: nextId,
        name,
        email,
        role,
        status: 'active',
        password,
        lastLogin: 'Just now'
      };
      store.users.push(created);
      saveStore(store);
      return { status: 201, code: 'created', user: clone(created) };
    },

    changeRole(email, role, actorRole) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/users/' + encodeURIComponent(email) + '/role', {
          role,
          actorRole
        });

        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', user: clone(response.body.data) };
        }

        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.' });
      }

      if (actorRole !== 'SystemAdmin') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const store = loadStore();
      const user = store.users.find((entry) => entry.email.toLowerCase() === String(email || '').trim().toLowerCase());
      if (!user) {
        return { status: 404, code: 'not_found', message: 'The selected user was not found anymore. Refresh and try again.' };
      }
      if (!['SystemAdmin', 'Coach'].includes(role)) {
        return { status: 400, code: 'validation_error', message: 'Please review the form fields and try again.' };
      }

      user.role = role;
      saveStore(store);
      return { status: 200, code: 'ok', user: clone(user) };
    },

    changePassword(email, password, confirmPassword, actorRole) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/users/' + encodeURIComponent(email) + '/password', {
          password,
          confirmPassword,
          actorRole
        });

        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', user: clone(response.body.data) };
        }

        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.' });
      }

      if (actorRole !== 'SystemAdmin') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const store = loadStore();
      const user = store.users.find((entry) => entry.email.toLowerCase() === String(email || '').trim().toLowerCase());
      if (!user) {
        return { status: 404, code: 'not_found', message: 'The selected user was not found anymore. Refresh and try again.' };
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
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/users/' + encodeURIComponent(email) + '/deactivate', {
          actorRole
        });

        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', user: clone(response.body.data) };
        }

        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.' });
      }

      if (actorRole !== 'SystemAdmin') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const store = loadStore();
      const user = store.users.find((entry) => entry.email.toLowerCase() === String(email || '').trim().toLowerCase());
      if (!user) {
        return { status: 404, code: 'not_found', message: 'The selected user was not found anymore. Refresh and try again.' };
      }

      user.status = 'inactive';
      saveStore(store);
      return { status: 200, code: 'ok', user: clone(user) };
    },

    reactivateUser(email, actorRole) {
      if (shouldUseBackendPlayersMode()) {
        const response = backendRequest('POST', '/users/' + encodeURIComponent(email) + '/reactivate', {
          actorRole
        });

        if (response.status === 200 && response.body && response.body.data) {
          return { status: 200, code: 'ok', user: clone(response.body.data) };
        }

        return clone(response.body || { status: 503, code: 'service_unavailable', message: 'Backend persistence is unavailable. Check /api/v1 connectivity and DATABASE_URL.' });
      }

      if (actorRole !== 'SystemAdmin') {
        return { status: 403, code: 'forbidden', message: 'You do not have permission to perform this action.' };
      }

      const store = loadStore();
      const user = store.users.find((entry) => entry.email.toLowerCase() === String(email || '').trim().toLowerCase());
      if (!user) {
        return { status: 404, code: 'not_found', message: 'The selected user was not found anymore. Refresh and try again.' };
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
