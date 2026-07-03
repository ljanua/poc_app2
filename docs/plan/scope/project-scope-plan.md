# Project Scope Plan

## Source and Assumptions
- The `docs/plan/scope/` folder is currently empty.
- This plan is inferred from available product context in `docs/brainstorms/`, including:
  - `2026-07-01-coaches-growth-match-time-performance-requirements.md`
  - `2026-07-02-situational-video-assessment-requirements.md`
  - `2026-07-01-app-name-brainstorm.md`
- If additional scope artifacts are added to `docs/plan/scope/`, this plan should be reviewed and updated.

## Executive Summary
The product is a coach-centered performance platform that helps coaches and performance staff understand player growth, match time, and performance trends in one place, while also enabling fast capture of short situational videos for later AI-based skill assessment.

### Key Benefits
- Consolidates player development indicators, match minutes, and performance data into a single coach dashboard.
- Reduces manual effort by making insights visible without scattered spreadsheets or notes.
- Enables coaches to capture quick video-based observations and receive processed skill summaries.
- Supports faster decision making for player development, selection, and training adjustments.

## Business Goals
- Give coaches a simple way to track player growth over time.
- Make match time and performance visible in one dashboard.
- Help coaches identify patterns that require intervention or support.
- Make short situational video capture and AI assessment easy and fast.
- Reduce the effort required to gather and act on player progress information.

## Success Criteria
- Coaches can find a player’s growth, match time, and performance data in one place.
- The dashboard helps identify trends without extra manual effort.
- Coaches can quickly answer whether a player is improving, flat, or declining.
- Coaches can record or upload short situational videos with minimal steps.
- Captured clips are submitted for AI review without requiring manual scoring.
- Coaches receive clear skill summaries for assessed clips.

## Primary Users and Personas
- Coaches
- Assistant coaches
- Performance staff
- Team managers
- Scouts and talent evaluators

## In Scope
1. Coach-facing player development dashboard
   - Player-level view of growth indicators, match time, and performance metrics
   - Timeline and trend indicators for progress over time
   - Basic comparison across players or time periods
2. Match time tracking
   - Minutes played, appearances, substitutions, and participation history
   - Simple status indicators for match-time trends
3. Performance tracking
   - Performance metric summaries from matches and training sessions
   - Comparison and trend visualization across recent events
4. Situational video capture and upload
   - Short video clip capture or upload from mobile/coach devices
   - Metadata entry for player, situation, and skill context
   - Backend submission pipeline for later AI assessment
5. AI-based skill assessment workflow
   - Asynchronous processing of clips
   - Display of rated skill scores and summary feedback
   - Browsing of assessed clips with ratings and context
6. External data ingestion support
   - Ingestion of structured indicator reports from external tools such as Playmaker sensor reports

## Out of Scope
- Advanced scouting or talent evaluation workflows in the first release
- Predictive performance forecasting
- Real-time video analysis during capture
- Full motion-tracking or tactical editing tools
- Extended coach commentary collaboration workflows
- Multi-clip storyboards or timeline editors
- Full integration with external sports analytics platforms beyond basic ingestion support
- AI-generated coaching recommendations in the first version

## Core Capabilities and Feature Map
### Capability 1: Coach Insight Dashboard
- Player growth summary
- Match time history and trend indicators
- Performance summary over time
- Comparative view for players or periods
- Status markers for improvement, plateau, or decline

### Capability 2: Situational Video Capture
- Record or upload short video clips from mobile or tablet
- Tag clips with player, situation, and skill focus
- Submit clips for later review and assessment

### Capability 3: AI Skill Assessment and Review
- Process submitted clips asynchronously
- Generate coach-friendly skill ratings and observations
- Display assessment results alongside clip metadata
- Browse assessed clips with score summaries

### Capability 4: Data Integration and Ingestion
- Accept structured external reports
- Map external indicators into the player development model
- Handle incomplete or inconsistent data clearly

## Delivery Phases
### Phase 1: Coaching Insight MVP
- Define player development data model
- Build coach dashboard for growth, match time, and performance data
- Implement trend indicators and comparison view
- Integrate basic external report ingestion
- Validate coach workflows with sample data

### Phase 2: Video Capture and Submission
- Add short clip capture/upload UX for mobile and tablet
- Implement metadata tagging for player, situation, and skill context
- Build backend ingestion pipeline for video submissions
- Ensure mobile-friendly submission flow and upload reliability

### Phase 3: AI Assessment and Review
- Connect video submissions to asynchronous AI assessment pipeline
- Build assessment result display and coach summary pages
- Add browsing and filtering for assessed clips
- Improve data quality handling and coach review experience

## Milestones and Timeline Assumptions
- M1: Scope validation and UX concept review
- M2: Data model and coach dashboard MVP complete
- M3: Video capture/upload MVP complete
- M4: AI assessment pipeline integrated and results surfaced
- M5: Pilot with coaches and feedback loop

> Timeline assumptions: the project is planned as a multi-sprint effort with each phase taking 2-4 sprints depending on team size and existing platform readiness.

## Dependencies
- Data source availability for player growth, match time, and performance metrics
- External report format documentation for Playmaker or similar sensor reports
- Video storage, processing, and secure hosting infrastructure
- AI assessment service or model integration
- Authentication and authorization for coach-facing access
- Mobile device/browser compatibility for capture and upload
- Observation and analytics instrumentation for tracking adoption

## Risks and Mitigations
- Risk: Data quality and inconsistent player metrics
  - Mitigation: show missing data clearly and keep coach guidance simple
- Risk: AI assessment trust and coach acceptance
  - Mitigation: label assessments as advisory and provide transparent indicators
- Risk: Large video uploads or unsupported formats
  - Mitigation: enforce short clip limits, supported codecs, and upload validation
- Risk: Early scope creep into advanced analytics
  - Mitigation: keep first release focused on core coach workflows and defer advanced features
- Risk: Performance delays for dashboard or video processing
  - Mitigation: design for asynchronous processing and efficient caching

## Non-Functional Requirements
- Mobile-first, coach-friendly UX with fast load times
- Secure handling of video and player data
- Resilient asynchronous processing for clip assessment
- Clear error handling for missing or partial data
- Observability for submission and assessment workflows
- Scalable architecture for growing player and clip volume

## Assumptions and Open Questions
### Assumptions
- Coaches need a fast review experience, not a deep analytics workspace.
- Captured clips are short and purpose-specific, not full match recordings.
- AI assessment is asynchronous and not required in real time.
- Players, situations, and skill focus can be tagged at submission time.
- The initial product supports one or a small number of coaching teams rather than a broad enterprise deployment.

### Open Questions
- What maximum clip length should the first release support?
- Which skill dimensions should the AI rate first (e.g., decision-making, technique, positioning)?
- Should the product support one team, multiple teams, or an entire program in the first phase?
- Should coaches be able to request an assessment at capture time, or only post-upload?
- What level of external analytics integration is expected beyond structured report ingestion?

## Definition of Done
- Coach dashboard delivered with player growth, match time, and performance summaries
- Short video capture/upload flow available for coaches
- Video submissions stored and queued for AI assessment
- Assessment results surfaced in a coach-friendly review experience
- Missing or inconsistent data is handled clearly
- Key risks and assumptions are documented and reviewed
- Stakeholder review confirms the product meets the business goals and success criteria
