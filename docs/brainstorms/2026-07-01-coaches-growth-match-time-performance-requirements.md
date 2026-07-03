# Coaches Growth, Match Time, and Performance Tracking

## Summary
Add a coach-facing feature that helps coaches monitor player development over time by combining growth indicators, match time, and performance data in one place. The goal is to make player progress easier to understand, compare, and act on without relying on scattered spreadsheets or manual notes.

## Problem
Coaches often need to answer three related questions about players:
- How are they developing over time?
- How much match time are they getting?
- How are they performing in matches and training?

Today, this information is often fragmented across different tools, notes, and reports. That makes it hard to spot trends, identify gaps, and make timely decisions about training, selection, or player support.

## Primary Users
- Coaches
- Assistant coaches
- Performance staff
- Team managers

## Goals
- Give coaches a simple way to track player growth over time
- Make match time and performance visible in one dashboard
- Help coaches identify patterns that require intervention or support
- Reduce the effort required to gather player progress information

## Core Experience
The feature should let a coach view a player profile that includes:
- Growth indicators such as development milestones, fitness progress, or skill progression
- Match time history, including minutes played, appearances, and substitutions
- Performance metrics from matches or training sessions
- A clear timeline that shows changes over time

The experience should support quick review rather than deep analysis every time. Coaches should be able to scan a player’s recent history and understand whether progress is improving, flat, or declining.

## Scope
### Included
- Player-level dashboard for coaches
- Tracking of match time and appearances
- Performance summary over time
- Basic comparison view across players or time periods
- Simple status indicators for trend changes
- Ingestion of structured indicator reports from external tools like Playmaker sensor reports

### Deferred for later
- Advanced scouting or talent evaluation workflows
- Predictive performance forecasting
- AI-generated coaching recommendations
- Full integration with external sports analytics platforms

## Success Criteria
- Coaches can find a player’s growth, match time, and performance data in one place
- The dashboard helps identify trends without extra manual effort
- Coaches can quickly answer whether a player is improving or falling behind
- The feature reduces the time needed to review player progress

## Constraints and Assumptions
- The feature should be usable by coaches without requiring advanced analytics expertise
- Data quality and consistency are important; incomplete data should be handled clearly
- The feature should not assume a single coaching style or team structure

## Open Questions
- Which performance metrics are most valuable for coaches in the first version?
- Should the feature focus on one team, multiple teams, or all players in a program?
- How should the system handle missing or inconsistent data?
