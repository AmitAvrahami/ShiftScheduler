# ShiftScheduler — Product Requirements Document

**Version:** 2.0 | **Date:** March 2026 | **Author:** Amit Avrahmi
**GitHub:** <https://github.com/AmitAvrahmi/ShiftScheduler>
**Stack:** Node.js · React 18 · TypeScript · MongoDB · Tailwind CSS

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Requirements](#2-business-requirements)
3. [Scheduling Constraints](#3-scheduling-constraints)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Technical Architecture](#6-technical-architecture)
7. [Scheduling Algorithm](#7-scheduling-algorithm)
8. [Development Roadmap](#8-development-roadmap)
9. [Risks & Mitigations](#9-risks--mitigations)
10. [Future Enhancements](#10-future-enhancements)
11. [Success Criteria](#11-success-criteria)

---

## 1. Executive Summary

### 1.1 Product Goal

ShiftScheduler is a full-stack web application that automates weekly shift scheduling for control-room environments. The system collects employee constraints, runs an optimisation algorithm, and lets the manager review, edit, and publish the final schedule — all through a Hebrew RTL interface.

### 1.2 Business Problem

Today, schedule creation is entirely manual. The manager must:

- Remember every employee constraint across the week
- Verify full 24/7 shift coverage (morning / afternoon / night)
- Enforce legal rest-time rules (minimum 8 hours between shifts)
- Balance workloads fairly across all 10 employees
- Redo the work from scratch every week

This process takes ~2 hours per week and is error-prone.

### 1.3 Proposed Solution

An automated system where:

- Employees submit availability constraints through a web app
- The system auto-generates an optimal weekly schedule
- The manager can drag-and-drop to refine the schedule
- The published schedule is immediately visible to all employees

### 1.4 Project Phases

| Phase | Scope | Status |
|-------|-------|--------|
| Phase 1 – MVP | Bezeq control room · 10 employees · 3 shifts | In Development |
| Phase 2 – Generic | Multi-tenant SaaS, any organisation | Planned |
| Phase 3 – Mobile | React Native app, push notifications, shift swapping | Future |

---

## 2. Business Requirements

**Scope:** Bezeq Control Room – MVP

### 2.1 Team Structure

| Role | Count | Notes |
|------|-------|-------|
| Manager | 1 | Always assigned to morning shift; full system access |
| Shift Worker | 9 | Can submit constraints; view own schedule |

### 2.2 Shift Definitions

| Shift | Start | End | Duration |
|-------|-------|-----|----------|
| Morning | 06:45 | 14:45 | 8 hours |
| Afternoon | 14:45 | 22:45 | 8 hours |
| Night | 22:45 | 06:45 | 8 hours |

### 2.3 Coverage Requirements

**Weekdays (Sunday – Thursday)**

| Shift | Required Employees | Notes |
|-------|--------------------|-------|
| Morning | 2 | Including manager |
| Afternoon | 2 | |
| Night | 1 | |

**Weekends & Holidays (Friday morning – Saturday night)**

| Shift | Required Employees | Notes |
|-------|--------------------|-------|
| Friday Morning | 2 | Same as weekday morning |
| All other shifts | 1 | Reduced coverage |

### 2.4 Weekly Workflow

| Day | Action | Who |
|-----|--------|-----|
| Sunday | Constraint submission window opens for next week | Employees |
| Monday 23:59 | Constraint submission deadline — system locks editing | System |
| Tuesday | Manager generates schedule; reviews and edits draft | Manager |
| Wednesday | Schedule is published and visible to all employees | Manager |
| Wed – Sat | Employees work according to published schedule | All |

---

## 3. Scheduling Constraints

A schedule is **invalid** if any Hard Constraint is violated. Soft Constraints are optimisation targets — violations are permitted only when no better assignment exists.

---

### 3.1 Hard Constraints (MUST be enforced)

#### Employee Constraints

| ID | Rule | Detail |
|----|------|--------|
| HC-1 | No overlapping shifts | An employee cannot be assigned to two shifts at the same time. |
| HC-2 | Minimum rest period | At least 8 hours of rest between any two consecutive shifts for the same employee. E.g., finishing afternoon (22:45) blocks next day's morning (06:45). |
| HC-3 | Maximum daily hours | An employee cannot exceed their maximum allowed working hours in a single day. |
| HC-4 | Availability / "cannot work" | An employee marked unavailable for a shift slot must never be assigned to it. |
| HC-5 | Special assignments | If an employee has a mandatory fixed assignment (e.g., manager → morning), it must be honoured unconditionally. |

#### Shift Requirements

| ID | Rule | Detail |
|----|------|--------|
| HC-6 | Minimum coverage | Each shift must meet its required minimum headcount. If impossible, the system alerts the manager and marks the slot as `partial`. |
| HC-7 | Predefined shift types | Shifts must conform to the system's defined types: Morning (06:45–14:45), Afternoon (14:45–22:45), Night (22:45–06:45). Custom types may be added in Phase 2. |
| HC-8 | Fixed shift hours | Shift start/end times are fixed; assignments outside these boundaries are not permitted. |

#### System Legality & Labour Laws

| ID | Rule | Detail |
|----|------|--------|
| HC-9 | Vacation / time off | An employee on approved leave cannot be assigned any shift during that period. |
| HC-10 | Maximum consecutive days | An employee cannot be scheduled for more than 6 consecutive working days. |
| HC-11 | Weekly rest day | Every employee must receive at least one full rest day per week, in accordance with applicable labour law or company policy. |
| HC-12 | Constraint submission deadline | After Monday 23:59 the current week's constraints are locked; employees cannot modify them. |

---

### 3.2 Soft Constraints (TRY to enforce)

The algorithm assigns a **penalty score** to each violation. The goal is to minimise total penalty. When no penalty-free assignment exists, the lowest-penalty option is chosen.

#### Individual Preferences

| ID | Rule | Detail |
|----|------|--------|
| SC-1 | Preferred shift types | Honour an employee's stated preference for a specific shift type (morning / afternoon / night). |
| SC-2 | Preferred / non-preferred days | Honour requests to work or avoid specific days of the week. |
| SC-3 | Night shift dispreference | Employees who prefer to avoid night shifts should be assigned them only when necessary. |
| SC-4 | Fair personal requests | Accommodate reasonable one-off personal requests when feasible. |

#### Fairness & Even Distribution

| ID | Rule | Detail |
|----|------|--------|
| SC-5 | Balanced shift count | Each employee should receive a similar total number of shifts per scheduling period. |
| SC-6 | Shift-type balance | Morning / afternoon / night shifts should be distributed evenly across all employees over time. |
| SC-7 | Weekend distribution | Weekend shifts (Friday–Saturday) should be spread equally among all employees. |
| SC-8 | Balanced hours | Total working hours should be fair across all employees; no employee should be significantly over or under their peers. |
| SC-9 | Avoid overload | No single employee should be consistently assigned more shifts than others in the same period. |

#### Sequence & Stability

| ID | Rule | Detail |
|----|------|--------|
| SC-10 | Avoid night → afternoon (same day) | Avoid assigning an employee to an afternoon shift (14:45) on the same day they finish a night shift (06:45) — only 8 hours gap, technically legal but fatiguing. |
| SC-11 | Avoid afternoon → morning (next day) | Avoid assigning an employee to a morning shift (06:45) the day after an afternoon shift (22:45) — only 8 hours gap, technically legal but fatiguing. |
| SC-12 | Limit consecutive night shifts | Avoid assigning more than 3 consecutive night shifts to the same employee. |
| SC-13 | Shift sequence stability | Prefer grouping the same shift type together (e.g., several morning shifts in a row) to provide predictable routines. |
| SC-14 | Prevent rapid shift-type switches | Minimise rapid alternation between incompatible shift types (e.g., morning → night → afternoon in quick succession). |

---

## 4. Functional Requirements

### 4.1 Authentication (FR-1)

| ID | Requirement | Role |
|----|-------------|------|
| FR-1.1 | Managers can create employee accounts via admin panel (no public registration) | Manager |
| FR-1.2 | Login with email + password; session managed by JWT (24 h expiry) | All |
| FR-1.3 | Logout clears JWT from client storage | All |
| FR-1.4 | Role-based access: manager sees all features; employee sees own data only | All |
| FR-1.5 | Seed script populates initial employees in closed environment | Dev/Admin |

### 4.2 Constraint Management (FR-2)

| ID | Requirement | Role |
|----|-------------|------|
| FR-2.1 | Employee submits constraints via weekly grid with checkboxes per shift slot | Employee |
| FR-2.2 | Constraints auto-saved or saved on explicit action; "Saved" indicator shown | Employee |
| FR-2.3 | Editing locked after Monday 23:59; read-only view shown instead | Employee |
| FR-2.4 | Manager views all employee constraints; can filter by employee | Manager |
| FR-2.5 | Manager can export constraints to Excel | Manager |

### 4.3 Automatic Schedule Generation (FR-3)

| ID | Requirement | Role |
|----|-------------|------|
| FR-3.1 | Algorithm takes employee list, constraints, and coverage rules as input | System |
| FR-3.2 | Algorithm outputs a complete weekly schedule or a partial schedule + issue list | System |
| FR-3.3 | "Generate Schedule" button available to manager only, after Monday | Manager |
| FR-3.4 | Loading indicator shown during generation; success / failure result displayed | System |
| FR-3.5 | If staffing shortfall exists: system shows empty slots and lets manager decide | Manager |

### 4.4 Schedule Viewing & Editing (FR-4)

| ID | Requirement | Role |
|----|-------------|------|
| FR-4.1 | Manager sees full weekly table: all shifts, all employees, colour-coded by type | Manager |
| FR-4.2 | Unfilled shifts highlighted in red; manager is highlighted separately | Manager |
| FR-4.3 | Drag-and-drop editor: employee cards dragged into shift slots (dnd-kit) | Manager |
| FR-4.4 | Constraint violation warning modal shown when an invalid assignment is attempted | Manager |
| FR-4.5 | Undo history: up to 10 states | Manager |
| FR-4.6 | Coverage indicators show headcount per shift slot (e.g. 1/2 filled) | Manager |
| FR-4.7 | Employee sees only own assigned shifts in a calendar layout | Employee |
| FR-4.8 | Employee can export own schedule to Google Calendar / iCal | Employee |

### 4.5 Publishing (FR-5)

| ID | Requirement | Role |
|----|-------------|------|
| FR-5.1 | Manager publishes draft schedule; status changes draft → published | Manager |
| FR-5.2 | Published schedule becomes visible to all employees immediately | All |
| FR-5.3 | Schedule can be archived after the week ends | Manager |

### 4.6 Export & Reporting (FR-6)

| ID | Requirement | Role |
|----|-------------|------|
| FR-6.1 | Export full schedule as PDF (print-friendly) | Manager |
| FR-6.2 | Export full schedule as Excel / CSV | Manager |
| FR-6.3 | Analytics dashboard (future): shifts per employee, overtime, distribution | Manager |

### 4.7 Admin – User Management (FR-7)

| ID | Requirement | Role |
|----|-------------|------|
| FR-7.1 | Manager can add new employee accounts from admin panel | Manager |
| FR-7.2 | Manager can deactivate / reactivate employees | Manager |
| FR-7.3 | Manager can set `isFixedMorning` flag on any employee | Manager |

---

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance – Generation | Schedule generation completes in ≤ 5 seconds |
| Performance – Page Load | Pages load in ≤ 2 seconds on a standard connection |
| Scalability | Supports up to 50 concurrent users (MVP) |
| Security – Auth | bcrypt password hashing; JWT 24 h expiry; HTTPS enforced |
| Security – Validation | All inputs validated with Zod; XSS and injection prevented |
| Security – Authorisation | Role check on every protected API route |
| Availability | 99% uptime target; daily MongoDB Atlas backups |
| Recovery | Recovery time objective (RTO) ≤ 24 hours |
| Usability – Language | Full Hebrew RTL interface; all labels, errors, and alerts in Hebrew |
| Usability – Responsive | Mobile-responsive layout; tested on Chrome, Firefox, Safari, Edge |
| Accessibility | WCAG 2.1 AA compliance target |
| Maintainability | TypeScript throughout; README + API docs; Sentry error monitoring |
| Logging | Critical operations logged (schedule generation, publish, constraint lock) |

---

## 6. Technical Architecture

### 6.1 Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Runtime | Node.js 20+ | |
| Backend Framework | Express.js + TypeScript | Port 5001 |
| Database | MongoDB Atlas | Mongoose ODM |
| Authentication | JWT + bcrypt | 24-hour token expiry |
| Validation | Zod | Schema-first validation |
| Frontend | React 18 + TypeScript | Vite build tool · Port 5173 |
| State Management | Zustand | Lightweight global state |
| Routing | React Router v6 | |
| Styling | Tailwind CSS | RTL Hebrew support |
| Drag & Drop | @dnd-kit/core | Sprint 5 schedule editor |
| Testing | Unit tests | Backend + Frontend |
| Version Control | Git + GitHub | Sprint-based feature branches |
| Deployment – FE | Vercel / Netlify | Planned |
| Deployment – BE | Render / Railway | Planned |
| Monitoring | Sentry | Error tracking |

### 6.2 Database Schema

**Users Collection**

```ts
{
  _id:            ObjectId,
  name:           string,
  email:          string,        // unique
  password:       string,        // bcrypt hash
  role:           "manager" | "employee",
  isActive:       boolean,
  isFixedMorning: boolean,
  createdAt:      Date,
  updatedAt:      Date
}
```

**Constraints Collection**

```ts
{
  _id:         ObjectId,
  userId:      ObjectId,         // ref: Users
  weekId:      string,           // e.g. "2026-W11"
  constraints: [
    {
      date:     Date,
      shift:    "morning" | "afternoon" | "night",
      canWork:  boolean
    }
  ],
  isLocked:    boolean,          // true after Monday 23:59
  submittedAt: Date
}
```

**Schedules Collection**

```ts
{
  _id:         ObjectId,
  weekId:      string,           // e.g. "2026-W11"
  startDate:   Date,             // Sunday of the week
  endDate:     Date,             // Saturday of the week
  shifts: [
    {
      date:          Date,
      shiftType:     "morning" | "afternoon" | "night",
      assignedUsers: [{ userId: ObjectId, isConfirmed: boolean }],
      requiredCount: number,
      status:        "filled" | "partial" | "empty"
    }
  ],
  status:      "draft" | "published" | "archived",
  generatedBy: "auto" | "manual",
  publishedAt: Date
}
```

### 6.3 API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/login` | Login with email + password | Public |
| POST | `/api/auth/logout` | Logout | User |
| GET | `/api/auth/me` | Get current user info | User |
| GET | `/api/users` | List all employees | Manager |
| GET | `/api/users/:id` | Get user by ID | Manager |
| PUT | `/api/users/:id` | Update user | Manager |
| DELETE | `/api/users/:id` | Deactivate user | Manager |
| GET | `/api/constraints/:weekId` | Get own constraints for week | Employee |
| POST | `/api/constraints` | Submit constraints | Employee |
| GET | `/api/constraints/:weekId/all` | Get all employees' constraints | Manager |
| PUT | `/api/constraints/:weekId/lock` | Lock week constraints | Manager |
| GET | `/api/schedules/:weekId` | Get schedule for week | User |
| POST | `/api/schedules/generate` | Auto-generate schedule | Manager |
| PUT | `/api/schedules/:weekId` | Update (manual edit) schedule | Manager |
| POST | `/api/schedules/:weekId/publish` | Publish schedule | Manager |
| GET | `/api/schedules/:weekId/my-shifts` | Get own shifts for week | Employee |
| GET | `/api/schedules/:weekId/export` | Export schedule (PDF/Excel) | Manager |

---

## 7. Scheduling Algorithm

### 7.1 Approach

Custom Constraint Satisfaction Problem (CSP) solver — chosen for simplicity, debuggability, and full control.

| Option | Approach | Chosen? |
|--------|----------|---------|
| Option 1 | Custom CSP algorithm (implemented in Sprint 4) | ✅ YES |
| Option 2 | Google OR-Tools (requires Python bridge or WASM) | Fallback if needed |
| Option 3 | JS CSP libraries (constraint, csp-solver) | Not used |

### 7.2 Determinism Requirement

The algorithm **must be fully deterministic**: identical input always produces identical output.
Any use of `Math.random()`, `shuffle()`, or non-stable sort order is forbidden.
Tie-breaking at every stage must use a stable secondary key (e.g. `employee._id.toString()` ASC).

### 7.3 Algorithm Steps

1. **Initialise** — create empty 21-slot schedule (7 days × 3 shifts); sort employee list by `_id` ASC to guarantee stable iteration order throughout
2. **Fixed assignments** — assign manager to all morning slots (HC-5)
3. **Filter candidates per slot** — for each slot, remove: employees marked unavailable (HC-4), employees on leave (HC-9), employees violating the 8-hour rest rule (HC-2)
4. **Sort slots by difficulty** — ascending by number of valid candidates; ties broken by day index ASC, then shift order (morning=0, afternoon=1, night=2). This guarantees the hardest slots are filled first and slot order is stable across runs.
5. **Assign candidates** — for each slot in difficulty order:
   - Score every valid candidate with a penalty function (see §7.4)
   - Select the candidate with the **lowest penalty score**
   - Ties broken by `employee._id.toString()` ASC — no randomness
   - Update that employee's `penaltyContext` (shift count, last shift type, consecutive night count)
6. **Unfillable slots** — if no valid candidate exists, mark slot as `partial`, log the conflict, continue
7. **Return** — complete schedule object + `issues[]` array of unresolvable conflicts

### 7.4 Penalty Score Reference

Penalties are additive. Lower total score = better candidate for a slot.

| Soft Constraint | Penalty Points | Notes |
|----------------|---------------|-------|
| SC-10 — night → afternoon same day | 100 | Employee finishing night at 06:45 assigned afternoon at 14:45 |
| SC-11 — afternoon → morning next day | 100 | Employee finishing afternoon at 22:45 assigned morning at 06:45 |
| SC-12 — >3 consecutive nights | 60 | Increments per additional night beyond 3 |
| SC-6 — shift-type imbalance | 40 | Penalty per unit of deviation from even morning/afternoon/night distribution |
| SC-5 — shift count imbalance | 40 | Penalty per shift above the current team average |
| SC-7 — weekend overload | 40 | Employee has more weekend shifts than team average |
| SC-13/SC-14 — rapid shift-type switch | 20 | e.g. morning → night → afternoon in same week |
| SC-1/SC-2/SC-3 — stated preferences | 10 | Lowest priority; used only as final tie-breaker |

### 7.5 Variables

- **21 variables:** `Sunday_Morning`, `Sunday_Afternoon`, `Sunday_Night`, ..., `Saturday_Night`
- Each variable = list of assigned user IDs (length must match `requiredCount`)
- Each employee carries a running `penaltyContext` updated after every assignment:

```ts
interface PenaltyContext {
  totalShifts: number;
  morningCount: number;
  afternoonCount: number;
  nightCount: number;
  consecutiveNights: number;
  weekendShifts: number;
  lastShiftType: 'morning' | 'afternoon' | 'night' | null;
  lastShiftDay: number | null;
}
```

---

## 8. Development Roadmap

| Sprint | Focus | Key Deliverables | Status |
|--------|-------|-----------------|--------|
| Sprint 1 | Project Setup | Monorepo, Vite, Express skeleton, MongoDB connection, ESLint/TS config | ✅ DONE |
| Sprint 2 | Authentication | User model, JWT auth, login/register endpoints, AuthContext, protected routes | ✅ DONE |
| Sprint 3 | Constraint System | Constraint model, weekly grid UI, submit/edit/lock flow, deadline enforcement | ✅ DONE |
| Sprint 4 | Scheduling Algorithm | CSP algorithm, /generate endpoint, draft schedule creation, coverage validation | ✅ DONE |
| Sprint 5 | Manager Schedule UI | Drag-and-drop editor (dnd-kit), sidebar, trash zone, undo (10 states), coverage indicators, constraint warning modal | 🔄 IN PROGRESS |
| Sprint 6 | Employee UI + Polish | Employee schedule view, calendar layout, page-mount bug fix, admin user management panel | 📋 PLANNED |
| Sprint 7 | Export + Deployment | PDF/Excel export, CI/CD pipeline, Vercel + Render deploy, Sentry integration | 📋 PLANNED |

### Known Sprint 5 Bug (Carry-over)
>
> **Issue:** Frontend does not load existing published schedule on page mount. API returns 200 with full data; bug is isolated to frontend loading logic (suspected stale closure in `useEffect` dependency array).
> **Fix planned:** Start of Sprint 6.

---

## 9. Risks & Mitigations

| Risk | Level | Mitigation |
|------|-------|------------|
| No feasible schedule (too many constraints) | 🔴 HIGH | Allow partial schedule; surface issue list to manager; manager fills gaps manually |
| Algorithm performance at scale | 🟡 MEDIUM | Custom CSP is fast for 10 employees; switch to OR-Tools if scaling to 50+ |
| User adoption resistance | 🟡 MEDIUM | Simple Hebrew UI; parallel testing alongside manual process; training sessions |
| Auth/permission bypass | 🔴 HIGH | Employees were able to bypass week-lock on constraint submission (fixed in Sprint 3). Continue auditing all protected routes. |
| ObjectId comparison bugs | 🟡 MEDIUM | Always use `.toString()` or `.equals()` for Mongoose ObjectId comparisons |
| React stale-closure bugs | 🟡 MEDIUM | Audit all `useEffect` dependency arrays; use ESLint `exhaustive-deps` rule |

---

## 10. Future Enhancements

### Phase 2 – Generic SaaS

- Multi-tenancy: organisations register independently
- Dynamic shift definitions (any number of shifts, custom hours)
- SaaS pricing tiers + public landing page
- Manager can configure coverage rules without code

### Phase 3 – Mobile & Advanced

- React Native mobile app
- Push notifications for schedule publication and upcoming shifts
- Shift swapping: employees request swaps, manager approves
- Calendar integrations: Google Calendar, iCal export
- Advanced analytics: overtime tracking, fairness scores, trend charts

---

## 11. Success Criteria

| Category | Criterion |
|----------|-----------|
| Technical | System stable in production with 99% uptime |
| Technical | Algorithm solves ≥ 95% of weekly schedules without manual intervention |
| Technical | All API response times < 2 seconds; schedule generation < 5 seconds |
| Technical | Zero critical security vulnerabilities |
| Business | All 10 Bezeq employees actively use the system |
| Business | Manager saves ≥ 2 hours per week vs. manual process |
| Business | Zero scheduling errors (missed shifts, rest violations) |
| UX | Employee satisfaction score > 8/10 in post-launch survey |
| UX | 100% constraint submission rate (employees submit before deadline) |
| UX | Zero usability complaints about Hebrew RTL interface |
