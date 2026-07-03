# DEV-GUIDE-UX-Screens — Coach Player Development Platform
**Date:** 2026-07-02  
**Origin:** `docs/plans/2026-07-02-001-feat-coach-player-development-plan.md`

This guide provides implementation-ready instructions for all screen designs required in the first two phases of the coach player development platform.

---

## Screen Catalog and Purpose

| Screen | Phase | Purpose | Role Visibility |
|--------|-------|---------|-----------------|
| Home / Player List | 1 | Browse and search players | Coach, Asst, Perf Staff |
| Player Development Dashboard | 1 | View growth, match time, performance trends | Coach, Asst, Perf Staff |
| Player Comparison View | 1 | Compare two players' metrics side-by-side | Coach, Asst |
| Video Capture/Upload Form | 2 | Submit clip with metadata | Coach, Asst |
| Submission Confirmation | 2 | Confirmation after clip submission | Coach, Asst |
| Assessment Results List | 2 | Browse submitted and assessed clips | Coach, Asst |
| Assessment Detail View | 2 | View AI ratings and clip context | Coach, Asst |
| Empty State: No Players | 1 | Onboarding prompt when no data exists | Coach, Asst |
| Empty State: No Clips | 2 | Encourage first clip submission | Coach, Asst |
| Empty State: Pending Assessment | 2 | Show status of queued clips | Coach, Asst |
| Error: Permission Denied | 1–2 | User lacks access to resource | Coach, Asst, Perf Staff |
| Error: Invalid Upload | 2 | Validation failure during submission | Coach, Asst |

---

## Phase 1 Screens: Player Development Dashboard

### S1: Home / Player List Screen

**Route:** `/players`  
**Purpose:** Browse team players and navigate to individual development profiles.

**Components:**
- Header: App logo/name, search bar, role indicator
- Search/filter: By player name, team, position (optional for MVP)
- Player list: Card-based layout with player name, thumbnail image, current trend badge (↑ improving, → plateau, ↓ declining), last updated timestamp
- Bottom tab bar: Players (active), Capture, My Clips
- CTA button: "View Profile" on each card

**Field-level requirements:**
- Player name: required, text
- Trend badge: auto-derived from latest development data; show ↑/→/↓ with color (green/gray/red)
- Timestamp: show "last updated X hours ago" or "Updated today"
- Search: real-time filter by name or position

**Responsive behavior:**
- Mobile (390px): Single-column list, full-width cards, large touch targets
- Tablet (768px): Two-column grid, cards side-by-side
- Desktop (1440px): Three-column grid with sidebar filter panel

**State transitions:**
- Tap a player card → navigate to `/players/:id` (S2)
- Tap search → filter list in place
- Tap Capture tab → navigate to `/clips/new` (S4)
- Tap My Clips tab → navigate to `/clips/assessments` (S6)

**Empty state (S8):**
- When no players exist: Show centered message "No players added yet. Start by inviting your team."

**Acceptance Criteria:**
- Given the coach is on the home screen, when they tap a player card, they navigate to that player's development dashboard.
- Given the coach searches for a player, when they type in the search bar, the list filters in real-time.
- Given the coach has no players in the system, when they visit the home screen, they see an onboarding prompt.

**Test scenarios:**
- Happy path: Search for "Messi", see player card with trend badge, tap to open profile.
- Edge case: Empty player list shows onboarding message with clear CTA.
- Error path: Search returns no results; show "No players found" message.

---

### S2: Player Development Dashboard

**Route:** `/players/:id`  
**Purpose:** Display a single player's growth indicators, match time history, and performance metrics in one unified view.

**Components:**
- Header: Player name, back button / breadcrumb
- Player summary card: Photo, position, team, age (optional)
- Growth indicators section:
  - Title: "Development Progress"
  - Show: Latest milestone, fitness level, skill progress (each with percentage or status badge)
  - CTA: "View full history" (optional drill-down for Phase 2+)
- Match time section:
  - Title: "Match Time History"
  - Show: Total minutes this season, recent appearances (e.g., "4 starts, 2 subs in last 5 matches")
  - Chart or timeline: Simple bar chart showing minutes over recent weeks
- Performance section:
  - Title: "Recent Performance"
  - Show: Average performance score, trend badge (↑/→/↓), recent match performance summary
- Clips section (Phase 2):
  - Title: "Video Assessments"
  - Show: Count of submitted and assessed clips, link to `/clips/assessments?player=:id`
- CTA buttons:
  - "Compare with another player" → `/players/:id/compare`
  - "Submit a clip for this player" → `/clips/new?player=:id`
- Bottom tab bar: Players, Capture, My Clips

**Field-level validation:**
- All numeric values: show "No data available" when missing rather than 0 or blank
- Dates: show relative format ("2 weeks ago") on mobile; absolute on desktop
- Percentages: show with % symbol and color-coded badge (green ≥70%, yellow 50-69%, red <50%)

**Responsive behavior:**
- Mobile (390px): Single-column stack, full-width sections, large text and touch targets
- Tablet (768px): Two-column layout with growth on left, match time and performance on right
- Desktop (1440px): Three-column layout with growth, match time, performance side-by-side; optional sidebar with player metadata

**State transitions:**
- Back button / breadcrumb → return to `/players` (S1)
- "Compare with another player" → `/players/:id/compare` (S3)
- "Submit a clip" → `/clips/new?player=:id` (S4 pre-filled)
- "View full history" → drill-down detail (Phase 2+)
- "Video Assessments" link → `/clips/assessments?player=:id` (S6 filtered)

**Permission model:**
- Coach, Assistant Coach, Performance Staff: full access to their team's players
- Non-coach roles: see error state (S11)

**Acceptance Criteria:**
- Given the coach opens a player profile, when the page loads, they see growth, match time, and performance data together.
- Given some metrics are missing, when they view the profile, missing data is shown with clear "No data available" messaging.
- Given the coach wants to compare two players, when they tap "Compare", they are taken to the comparison screen pre-selected with the current player.
- Given the coach wants to submit a clip, when they tap "Submit a clip", they are taken to the capture form with the player pre-filled.

**Test scenarios:**
- Happy path: Coach opens player profile, sees growth (↑), match time (12 appearances, 450 min), performance (↑), and submission CTA.
- Edge case: No growth data exists; show "Growth indicators will appear when data is available."
- Edge case: No clips submitted; show "Video Assessments: 0 submitted" with link to submit first clip.
- Error path: Coach lacks permission to view player; show permission-denied error (S11).

---

### S3: Player Comparison View

**Route:** `/players/:id/compare`  
**Purpose:** Compare two players' development, match time, and performance side-by-side.

**Components:**
- Header: "Compare Players", back button / breadcrumb
- Player selector: First player (pre-selected), second player dropdown/search to select
- Comparison table or side-by-side cards:
  - Growth indicators: side-by-side metrics with trend badges
  - Match time: side-by-side bar charts or number comparison
  - Performance: side-by-side trend badges and average scores
- CTA: "Submit a clip for [Player]" buttons on each side
- Bottom tab bar: Players, Capture, My Clips

**Field-level requirements:**
- Player selector: searchable dropdown, required
- Metrics: aligned vertically so comparison is easy to scan
- Trend badges: color-coded and prominently displayed

**Responsive behavior:**
- Mobile (390px): Stacked layout (one player above the other) with clear divider
- Tablet (768px): Side-by-side layout with player on left, player on right
- Desktop (1440px): Side-by-side layout with wider columns for easier scanning

**State transitions:**
- Change second player → refresh comparison in place
- "Submit a clip" on either side → `/clips/new?player=:id`
- Back button → return to `/players/:id` (S2)

**Acceptance Criteria:**
- Given two players are selected, when the comparison page loads, their metrics are displayed side-by-side.
- Given a coach wants to compare player A and player B, when they select player B from the dropdown, the comparison updates in place.
- Given one player has missing data, when they view the comparison, missing values are clearly labeled.

**Test scenarios:**
- Happy path: Compare player A (↑ improving) and player B (↓ declining); coach sees trend difference clearly.
- Edge case: One player has no growth data; show "No data available" for that player.
- Navigation: Tap "Submit a clip for Player B" → capture form pre-fills with Player B.

---

## Phase 2 Screens: Video Capture, Submission, and Assessment Review

### S4: Video Capture/Upload Form

**Route:** `/clips/new`  
**Purpose:** Allow coaches to capture or upload short situational clips and attach metadata.

**Components:**
- Header: "Submit a Video Clip", back button / breadcrumb
- Video input section:
  - Button: "Record a new clip" (opens camera on mobile)
  - Button: "Upload from device" (file picker)
  - Preview: Show selected/recorded file name and size
- Metadata form:
  - Player selector: dropdown/search, required, pre-filled if navigated from player profile (S2)
  - Situation description: text field (e.g., "Goal-scoring opportunity in 3rd minute"), required, max 200 chars
  - Skill focus (optional): multi-select or dropdown (e.g., "Decision-making", "Technical skill", "Positioning")
- Validation alerts:
  - Unsupported format: "Please use MP4 or MOV"
  - File too large: "File must be under 50MB and 60 seconds"
  - Missing metadata: "Player and situation are required"
- CTA buttons:
  - "Submit for Assessment" (triggers S5)
  - "Cancel" (return to previous screen)
- Bottom tab bar: Players, Capture (active), My Clips

**Field-level requirements:**
- Video file: required, format MP4/MOV, max 50MB, max 60 seconds
- Player selector: required, searchable dropdown
- Situation: required, text, max 200 characters
- Skill focus: optional, multi-select
- Validation: real-time checks on file size and format; form-level check for required metadata

**Responsive behavior:**
- Mobile (390px): Full-width form, large buttons, video preview below input
- Tablet (768px): Centered form with video preview on left, metadata on right
- Desktop (1440px): Centered form, video preview full-width above metadata

**State transitions:**
- "Submit for Assessment" → `/clips/new/confirm` (S5) with confirmation screen
- "Cancel" → previous screen (player profile S2 if referred, or home S1)
- Select player → pre-fill player selector if navigated from player profile

**Permission model:**
- Coach, Assistant Coach: can submit clips
- Performance Staff: role-specific permissions (TBD)

**Acceptance Criteria:**
- Given a coach records a video and fills in the metadata, when they tap "Submit", they are taken to a confirmation screen.
- Given a coach selects an unsupported format, when the file is uploaded, they see a clear validation error.
- Given a coach navigates from a player profile, when the capture form loads, the player is pre-selected.
- Given a coach fills in required metadata, when they tap "Submit", the clip is queued for assessment.

**Test scenarios:**
- Happy path: Coach records a 30-second clip, selects Player A, enters "Penalty kick attempt", taps Submit → confirmation screen.
- Validation: Coach selects a .avi file → error "Unsupported format. Please use MP4 or MOV."
- Validation: Coach skips the situation field → error "Situation is required."
- Edge case: Coach selects a 120-second clip → error "Clip must be 60 seconds or less."

---

### S5: Submission Confirmation

**Route:** `/clips/new/confirm`  
**Purpose:** Confirm successful clip submission and show next steps.

**Components:**
- Header: "Clip Submitted", checkmark icon
- Confirmation message: "Your video has been submitted for assessment. You'll see results within [X hours/1 day]."
- Summary:
  - Player name
  - Situation description
  - Skill focus (if selected)
  - Submission timestamp
- Status indicator: "Pending Assessment"
- CTA buttons:
  - "View assessment progress" → `/clips/assessments` (S6)
  - "Submit another clip" → `/clips/new` (S4)
  - "Back to home" → `/players` (S1)
- Bottom tab bar: Players, Capture, My Clips

**Field-level requirements:**
- None; this is a confirmation/feedback screen

**Responsive behavior:**
- Mobile (390px): Centered card with large checkmark, full-width buttons
- Tablet/Desktop (768px+): Centered card with similar layout, buttons side-by-side option

**State transitions:**
- "View assessment progress" → `/clips/assessments` (S6)
- "Submit another clip" → `/clips/new` (S4)
- "Back to home" → `/players` (S1)

**Acceptance Criteria:**
- Given a coach submits a clip successfully, when they reach the confirmation page, they see a success message and the clip details.
- Given a coach wants to submit another clip, when they tap "Submit another clip", they are taken back to the capture form.

**Test scenarios:**
- Happy path: Coach sees confirmation with checkmark, clip summary, and next-steps CTAs.
- Navigation: Tap "View assessment progress" → redirected to S6 filtered for this clip.

---

### S6: Assessment Results List

**Route:** `/clips/assessments`  
**Purpose:** Show all submitted clips and their assessment status/results.

**Components:**
- Header: "Video Assessments", filter/sort options (optional)
- Filter/sort toolbar (optional):
  - By status: All, Pending, Assessed, Failed
  - By player: dropdown to filter by player
  - Sort by: Most recent, Player name
- Results list:
  - Card per clip showing:
    - Thumbnail or placeholder video icon
    - Player name
    - Situation description
    - Status badge: "Pending", "Assessed", "Failed"
    - Submission date
    - If assessed: skill rating summary (e.g., "4.2/5 overall")
    - CTA: "View results" or "Retry"
- Empty state (S9): When no clips submitted, show onboarding prompt
- Bottom tab bar: Players, Capture, My Clips (active)

**Field-level requirements:**
- Status badge: visual indicator (orange=pending, green=assessed, red=failed)
- Rating summary: show as score (e.g., "4.2/5") if available
- Submission date: relative format ("2 hours ago") on mobile; absolute on desktop

**Responsive behavior:**
- Mobile (390px): Single-column list, full-width cards
- Tablet (768px): Two-column grid
- Desktop (1440px): Three-column grid with sidebar filters

**State transitions:**
- Tap a card → `/clips/assessments/:id` (S7)
- Change filter → list updates in place
- "Submit another clip" → `/clips/new` (S4)

**Permission model:**
- Coach, Assistant Coach: see own and team clips (role-dependent)
- Performance Staff: see authorized clips (role-dependent)

**Acceptance Criteria:**
- Given a coach has submitted clips, when they visit the assessments page, they see a list of all submitted clips with status.
- Given some clips are pending and some are assessed, when they view the list, status badges clearly indicate which are ready to review.
- Given a coach wants to filter by player, when they select a player from the filter, the list updates to show only that player's clips.

**Test scenarios:**
- Happy path: Coach sees 3 clips (1 pending, 2 assessed); tap one to view results.
- Empty state: Coach has never submitted a clip; see onboarding prompt (S9).
- Filter: Coach filters by Player A; list shows only Player A's clips.
- Status tracking: Coach sees "Pending" status for a clip submitted 1 hour ago.

---

### S7: Assessment Detail View

**Route:** `/clips/assessments/:id`  
**Purpose:** Display detailed AI assessment results and clip context.

**Components:**
- Header: Player name, back button / breadcrumb
- Video player: Play submitted clip
- Assessment status:
  - If pending: "Your assessment is in progress. Estimated completion: [time]"
  - If assessed: "Assessment complete" with timestamp
  - If failed: "Assessment failed. [Reason]. Retry?" with button
- Assessment results (if available):
  - Title: "Skill Assessment Results"
  - Ratings by dimension:
    - Skill 1 (e.g., "Decision-making"): score 4.2/5, brief observation
    - Skill 2 (e.g., "Technical Skill"): score 3.8/5, brief observation
    - Skill 3 (e.g., "Positioning"): score 4.5/5, brief observation
  - Overall assessment: narrative summary (1-2 sentences, coach-friendly language)
- Clip metadata:
  - Player name, Situation description, Skill focus, Submission date
- CTA buttons:
  - "Go to player profile" → `/players/:id` (S2)
  - "Submit another clip" → `/clips/new` (S4)
  - "Back to assessments" → `/clips/assessments` (S6)
  - (If failed) "Retry assessment" → queue again
- Bottom tab bar: Players, Capture, My Clips

**Field-level requirements:**
- Ratings: numeric score (0.0–5.0) with label and brief observation
- Observations: plain language, no jargon; max 1 sentence per skill
- Overall assessment: concise summary, coach-focused (e.g., "Shows strong decision-making and positioning, with room to improve on technical execution.")

**Responsive behavior:**
- Mobile (390px): Single-column layout, video player full-width, results cards stacked below
- Tablet (768px): Video on left, results on right
- Desktop (1440px): Video and results side-by-side with wider columns

**State transitions:**
- Back button → `/clips/assessments` (S6)
- "Go to player profile" → `/players/:id` (S2)
- "Submit another clip" → `/clips/new` (S4)
- "Retry assessment" → re-queue and show confirmation

**Permission model:**
- Coach, Assistant Coach: see own assessments
- Performance Staff: see authorized assessments (role-dependent)

**Acceptance Criteria:**
- Given a coach has an assessed clip, when they open the detail view, they see skill ratings and an overall summary.
- Given an assessment is still pending, when they view the detail, they see a "pending" message with estimated completion time.
- Given an assessment failed, when they view the detail, they see an error message and a "Retry" button.

**Test scenarios:**
- Happy path: Coach views assessed clip with 3 skill ratings and overall summary; can play video.
- Pending state: Coach views clip submitted 30 minutes ago; see "Estimated 2-3 hours" message.
- Retry flow: Assessment failed; coach taps "Retry" → confirmation and re-queued status.

---

## Error and Empty States

### S8: Empty State — No Players

**Route:** `/players` (when no players exist)  
**Purpose:** Onboard coaches when the system has no player data.

**Message:** "No players added yet. Start by adding your team players."  
**CTA:** "Add players" or "Contact support"

---

### S9: Empty State — No Clips Submitted

**Route:** `/clips/assessments` (when no clips exist)  
**Purpose:** Encourage coaches to submit their first clip.

**Message:** "You haven't submitted any clips yet. Start by capturing a situational video."  
**CTA:** "Submit your first clip"

---

### S10: Empty State — Pending Assessment

**Route:** `/clips/assessments` (when all clips are pending)  
**Purpose:** Inform coach clips are queued and under review.

**Message:** "Your submitted clips are being assessed. Check back soon for results."  
**Status:** Show submission timeline (e.g., "Submitted 2 hours ago, estimated 4-6 hours to complete")

---

### S11: Error State — Permission Denied

**Route:** Any protected screen accessed by unauthorized user  
**Purpose:** Inform user they lack access.

**Message:** "You do not have permission to view this content."  
**CTA:** "Return to home" or "Contact support"

---

### S12: Error State — Invalid Video Upload

**Route:** `/clips/new` (validation failure)  
**Purpose:** Guide coach to correct the upload issue.

**Message:** "Upload failed: [reason]"  
**Examples:**  
- "Unsupported format. Please use MP4 or MOV."
- "File too large. Maximum size is 50MB."
- "Video too long. Maximum length is 60 seconds."

**CTA:** "Try again"

---

## Authorization and Role-Based Behavior

### Coach / Assistant Coach
- View: own team's players, development dashboards, all clips (own and team)
- Create: clips
- Edit: clip metadata (optional, Phase 2+)

### Performance Staff
- View: players, development dashboards (team-specific), authorized clips
- Create: clips (role-dependent)
- Edit: none for MVP

### Scout (Future Phase)
- View: anonymized player signals, structured interest expressions (deferred to Phase 3+)

---

## Component Reuse Across Screens

| Component | Screens | Notes |
|-----------|---------|-------|
| Bottom tab bar | All (S1–S7) | Persistent navigation |
| Player selector/dropdown | S4, S3 (compare) | Searchable, required |
| Metadata form | S4 | Situational description, skill focus |
| Status badge | S6, S7 | Pending, Assessed, Failed |
| Trend badge | S1, S2, S3 | ↑ ↓ → with color coding |
| Video player | S7 | Play submitted clips |
| CTA buttons | All | Consistent styling |

---

## API Interaction Expectations by Screen

| Screen | API Calls | Expected Response |
|--------|-----------|-------------------|
| S1 | GET /api/players | Player list, trends |
| S2 | GET /api/players/:id | Player detail, metrics |
| S3 | GET /api/players/:id (×2) | Comparison data |
| S4 | POST /api/clips (upload + metadata) | Submission confirmation, clip ID |
| S5 | None (confirmation only) | — |
| S6 | GET /api/clips/assessments | Clip list with status |
| S7 | GET /api/clips/assessments/:id | Clip detail + assessment results |

---

## Test Checklist per Screen

### Unit/Component Tests
- [ ] Form validation (metadata entry, file size, format)
- [ ] Dropdown/search functionality (player selector)
- [ ] Status badge rendering (pending, assessed, failed)
- [ ] Trend badge calculation and color coding

### Integration Flow Tests
- [ ] Player list → player profile → comparison flow
- [ ] Clip submission → confirmation → results list flow
- [ ] Status updates in real-time (pending → assessed)
- [ ] Filter and sort on assessment results list

### Role/Authorization Tests
- [ ] Coach role can access all screens
- [ ] Non-coach role cannot access development dashboard (S11)
- [ ] Clip detail is visible to authorized users only

### UX Acceptance Checks
- [ ] All screens render correctly at 390px (mobile), 768px (tablet), 1440px (desktop)
- [ ] Touch targets are minimum 44×44px on mobile/tablet
- [ ] Missing data shows clear "Not available" messaging
- [ ] Breadcrumbs and back buttons work correctly
- [ ] Empty states are encouraging and provide clear CTAs
- [ ] Errors are understandable and recoverable
