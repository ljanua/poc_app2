# UX Navigation Recommendation — Coach Player Development Platform
**Date:** 2026-07-02  
**Origin:** `docs/plans/2026-07-02-001-feat-coach-player-development-plan.md`

## Selected Scope
The scope covers two primary coach workflows:
1. **Player Development Review:** coaches access a dashboard to see player growth, match time, and performance trends in one place.
2. **Situational Video Capture and Review:** coaches submit short clips for AI assessment and review results.

**Primary users:** Head coaches, Assistant coaches, Performance staff, Team managers  
**Future role:** Scouts (exchange and interest features deferred)

---

## Information Architecture Recommendation

### Core Mental Model
The platform is anchored on **Players** as the primary entity. Each player has:
- A **development profile** (growth indicators, milestones)
- A **match time history** (minutes, appearances, status)
- A **performance summary** (recent scores, trend badge)
- **Associated clips** (submitted videos and assessment results)

Coaches navigate by first selecting a **player**, then choosing to either:
- **Review the development dashboard** (growth, match time, performance in one view)
- **Submit a new clip** or **review past clips** with assessment results

### Navigation Model: Hybrid Bottom Tab + Contextual Header
**Target devices:** iPhone, Tablet, Desktop web

- **Bottom tab bar** (mobile/tablet breakpoint ~430px): persistent navigation between major sections
  - Home / Players List
  - Capture / Submit Clip
  - My Clips / Assessment Results
  - (Later: Exchange, Scouts — reserved)
- **Top header** (desktop ~1025px+): sticky top navigation with search, player quick-jump, and role indicator
- **Contextual breadcrumbs** within detail pages: guide users back to list

---

## Proposed Route Tree

```
/
├── /players (Home, player list)
│   └── /players/:id (Player profile & development dashboard)
│       └── /players/:id/compare (Comparison with another player)
├── /clips (Submit or browse clips)
│   ├── /clips/new (Capture/upload form)
│   │   └── /clips/new/confirm (Submission confirmation)
│   └── /clips/assessments (Assessment results list)
│       └── /clips/assessments/:id (Assessment detail)
└── /profile (Coach profile, settings — optional for MVP)
```

---

## Role-Based Entry Points and Default Landing Pages

### Coach / Assistant Coach / Performance Staff
- **Default landing:** `/players` (home, player list)
- **Permissions:** view all players, development dashboard, match time, performance; submit clips; view own assessment results
- **Navigation trigger:** bottom tab bar or top header links

### Scout (Future Wave)
- **Not present in first release.** Reserve `/scouts` and related routes for later phase.

---

## Task-to-Screen Mapping

| Task | Screen | Role | Entry Point |
|------|--------|------|------------|
| Find a player | Player list / search | Coach, Asst | Home / search |
| Review player growth, match time, performance | Player development dashboard | Coach, Asst | Player list → select |
| Compare two players' development | Comparison view | Coach, Asst | Player profile → compare button |
| Capture a situational video | Capture/upload form | Coach, Asst | Capture tab → new clip |
| Submit a clip with metadata | Submission confirmation | Coach, Asst | Capture form → submit |
| Review submitted clips and status | Assessment results list | Coach, Asst | My Clips tab |
| View AI assessment results for a clip | Assessment detail | Coach, Asst | Results list → select |
| See missing data clearly | Dashboard, empty states | Coach, Asst | Player profile, results page |

---

## Empty States, Validation States, and Permission-Denied States

### Empty States
- **No players in system:** "No players added yet. Start by adding your team players."
- **No clips submitted:** "You haven't submitted any clips yet. Start with a new capture."
- **No assessment results:** "Your submitted clips are pending assessment."
- **No growth data:** "Growth indicators will appear when development data is available."

### Validation States
- **Invalid video format:** "Unsupported format. Please use MP4 or MOV (max 60 seconds)."
- **Missing metadata:** "Player and situation are required before submission."
- **Oversized file:** "File too large (max 50MB). Please choose a smaller clip."

### Permission-Denied States
- **Non-coach accessing dashboard:** "You do not have permission to view player development data."
- **Accessing another coach's private clips:** "You do not have permission to view this assessment."

---

## Primary Navigation Model

### Mobile / Tablet (Bottom Tab Bar)
Persistent footer with 3–4 main tabs:
- **Players** (home icon) — player list
- **Capture** (camera/plus icon) — submit new clip
- **My Clips** (film icon) — assessment results
- (Future: **Exchange** when coach exchange launches)

### Desktop (Top Navigation)
- Logo / app name on left
- Search bar for player quick-jump (center/right)
- Role indicator and profile menu (top right)
- Secondary nav for coach-specific actions (e.g., "New Clip" button in top-right corner)

### Contextual Breadcrumbs
Each detail page shows: `Players > [Player Name]` or `My Clips > [Clip ID]`

---

## Risks, Tradeoffs, and Rationale

| Risk | Tradeoff | Mitigation |
|------|----------|-----------|
| Coaches reject a "dashboard" interface | Simplicity vs. depth | Keep initial release focused on quick scans; defer advanced analytics. Show only high-value trends and status markers. |
| Video upload UX friction | Speed vs. advanced controls | Remove editing tools; accept simple upload/capture. Enforce format and size limits clearly. |
| Missing data is confusing | Hiding gaps vs. surfacing gaps | Always show when data is missing; use clear "Not available" messaging rather than blank spaces. |
| Too much information per screen | Compact vs. verbose | Use trend badges and status indicators instead of raw numbers. Defer comparison and drill-down to secondary actions. |
| Scope creep into exchange features | MVP focus vs. ideation scope | Explicitly defer coach-to-coach exchange and scout interest to Phase 2+. |

---

## Phased Rollout Recommendation

### MVP (Phase 1)
- Player list screen
- Player development dashboard (growth, match time, performance)
- Role-based access control

### Post-MVP (Phase 2)
- Video capture/upload screen
- Video assessment submission and confirmation
- Assessment results list and detail view

### Future Phases (Phase 3+)
- Coach exchange workspace
- Scout interest onboarding
- Advanced comparison and trend analysis
- AI-generated coaching recommendations

---

## Design Principles for Screens

1. **Quick Scanning:** Use visual badges and status indicators (improvement ↑, plateau →, decline ↓) so coaches see trend direction at a glance.
2. **Mobile-First:** Design for iPhone (390px) first; scale up cleanly to tablet (768px) and desktop (1440px).
3. **Touch-Friendly:** Buttons and targets minimum 44×44px on mobile. Spacing and padding scale with screen size.
4. **Clear Data Absence:** When data is missing, show "No data available" or similar rather than leaving blank spaces.
5. **Asynchronous Feedback:** Video submissions show confirmation; results appear later. Use clear status labels (Pending, Assessed, Failed).
6. **Consistent Patterns:** Reuse form, list, and detail layouts across screens so coaches learn the UI quickly.

---

## Summary

The navigation model balances **simplicity** (few tabs, clear player-centric flow) with **function** (coaches can review players, submit clips, and see results). The bottom tab bar on mobile and top nav on desktop provide consistent entry points. Role-based permissions and deferred scope (exchange, scouts) keep the MVP focused. Empty states and validation messaging guide coaches through the workflow clearly.
