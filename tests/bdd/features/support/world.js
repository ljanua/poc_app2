const { setWorldConstructor, World } = require('@cucumber/cucumber');

class BddWorld extends World {
  constructor(options) {
    super(options);
    this.resetAll();
  }

  resetResponse() {
    this.lastStatus = 0;
    this.lastResponseUser = null;
    this.lastErrorCode = null;
    this.lastErrorMessage = null;
  }

  resetAll() {
    this.users = new Map();
    this.actorRole = null;
    this.actorEmail = null;
    this.activeToken = null;
    this.tokenExpired = false;

    this.teams = new Map();
    this.lastResponseTeam = null;
    this.lastTeamList = [];

    this.teamAssignments = new Map();
    this.catalog = [];
    this.selectedTeam = 'all';
    this.lookup = '';
    this.lastSuggestions = [];
    this.lastAddError = null;

    this.playerProfiles = new Map();
    this.dashboardCurrentPlayer = null;
    this.dashboardComparisonPlayer = null;
    this.dashboardVisible = null;
    this.dashboardTrend = null;
    this.dashboardMissingMessage = null;

    this.clips = [];
    this.supportedClipFormats = ['mp4', 'mov', 'webm'];
    this.maxClipSeconds = 120;
    this.lastClipSubmissionId = null;
    this.lastClipReviewList = [];
    this.lastClipActionMessage = null;

    this.playersById = new Map();
    this.teamsById = new Map();
    this.confirmPreview = null;
    this.confirmNoMatch = false;
    this.lastDuplicateQuickAction = null;
    this.lastMoveMessage = null;

    this.resetResponse();
  }
}

setWorldConstructor(BddWorld);
