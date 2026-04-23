# CLAUDE.md

This file provides global configuration and orientation for Claude Code. Heavy business logic lives in `docs/` — explicit references are given in the `<external_docs>` section below.

---

<project_overview>

## Project Overview

ShiftScheduler is a web-based shift management platform for 24/7 control-room environments. It replaces a manual scheduling process with an automated CSP engine, a structured weekly workflow, and a real-time collaboration layer between managers and employees. Employees submit availability constraints → the CSP engine generates a validated, optimised schedule → the manager reviews, edits via drag-and-drop, and publishes — all within a fixed Tuesday workflow window, targeting ~10 employees and 21 shift slots per week.

</project_overview>

---

<tech_stack>

## Tech Stack

| Layer      | Technology                                             |
| ---------- | ------------------------------------------------------ |
| Frontend   | React 19, Vite 8, TypeScript 6, Tailwind CSS 3         |
| Backend    | Node.js 22, Express 4, TypeScript 5, Mongoose 8        |
| Database   | MongoDB (Mongoose ODM)                                 |
| Auth       | JWT (jsonwebtoken), bcryptjs                           |
| Validation | Zod (backend)                                          |
| Monorepo   | npm workspaces (root `package.json`)                   |
| Linting    | ESLint 9 (flat config) + typescript-eslint, Prettier 3 |

</tech_stack>

---

<architecture>

## Architecture

```text
shiftScheduler/
├── backend/                Express REST API (port 5001)
│   └── src/
│       ├── config/         DB connection (Mongoose)
│       ├── controllers/    Route handlers
│       ├── middleware/     auth (JWT), error
│       ├── models/         Mongoose schemas
│       ├── routes/         Express routers
│       ├── services/       Business logic (CSP scheduler)
│       ├── types/          Express Request augmentations
│       └── utils/          AppError, weekUtils, helpers
├── frontend/               React SPA (port 5173)
│   └── src/
│       ├── components/     Shared UI components
│       ├── pages/          Route-level views
│       ├── hooks/          Custom React hooks
│       ├── lib/            API client, date/week utilities
│       ├── types/          TypeScript interfaces
│       └── assets/         Static assets
├── docs/                   Extended reference documentation
├── eslint.config.js        Root ESLint config (covers both workspaces)
├── .prettierrc             Root Prettier config
├── .env.example            All environment variables documented
└── CLAUDE.md               This file
```

### Key Files

| File | Purpose |
| ---- | ------- |
| `backend/src/server.ts` | Express entry; mounts all routes under `/api/v1`, global error handler |
| `backend/src/app.ts` | App factory (used for testing) |
| `backend/src/config/db.ts` | Mongoose connection; reads `MONGODB_URI` |
| `backend/src/routes/index.ts` | Route aggregator |
| `backend/src/middleware/authMiddleware.ts` | JWT verification + role guards (`isManager`, `isAdmin`); attaches `req.user = { id, email, role }` |
| `backend/src/middleware/errorMiddleware.ts` | Handles `AppError` instances; fallback for generic errors |
| `backend/src/utils/AppError.ts` | Custom error class with `statusCode` and `isOperational` flag |
| `backend/src/utils/weekUtils.ts` | IST Sunday–Saturday week helpers; `getWeekDates()` creates LOCAL midnight dates |
| `backend/src/services/schedulerService.ts` | Schedule generation orchestration |
| `backend/src/services/cspScheduler.ts` | CSP engine: backtracking, MRV, LCV, forward checking, linear fairness penalties |

</architecture>

---

<commands>

## Commands

### Root (run both services)

```bash
npm run dev           # start backend :5001 + frontend :5173 concurrently
npm run build         # build both packages
npm run lint          # ESLint check (backend/src + frontend/src)
npm run lint:fix      # ESLint auto-fix
npm run format        # Prettier write
npm run format:check  # Prettier check (CI)
```

### Backend

```bash
npm run dev --workspace=backend    # ts-node-dev hot reload
npm run build --workspace=backend  # tsc → dist/
npm test --workspace=backend       # jest --runInBand
npm test --workspace=backend -- --testPathPatterns=<pattern>
```

### Frontend

```bash
npm run dev --workspace=frontend    # Vite dev server on port 5173
npm run build --workspace=frontend  # tsc + vite build
npm run lint --workspace=frontend
```

### Environment

Copy `.env.example` to `backend/.env` and fill in values:

- `MONGODB_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — min 32 chars
- `ALLOWED_ORIGIN` — frontend origin (default `http://localhost:5173`)
- `PORT` — defaults to 5001

The Vite dev server proxies `/api/*` to backend port 5001 — no CORS config needed in development.

</commands>

---

<timezone_convention>

## Timezone Convention (critical)

IST is **UTC+3**. All deadline and shift boundary calculations use IST as the reference. Never use JavaScript's local clock for deadline logic.

All date keys must use **local time**, not UTC:

```ts
// CORRECT — local time matches IST in production
const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// WRONG — UTC offset causes off-by-one in IST (+3h)
const bad = d.toISOString().split('T')[0];
```

This applies in `schedulerService.ts`, `cspScheduler.ts`, and every frontend page that builds date keys. `getWeekDates()` creates LOCAL midnight dates — always match against them with local-time keys.

Localization settings:

| Setting | Value |
| ------- | ----- |
| Language | Hebrew (`lang="he"`) |
| Direction | RTL (`dir="rtl"` on `<html>`) |
| Timezone | `Asia/Jerusalem` (IST = UTC+3) |
| Week start | Sunday (index 0) |
| Date format | `he-IL` locale via `Intl` API |

- All user-visible strings must be in proper Hebrew (not transliterated).
- Use `Intl.DateTimeFormat` with `timeZone: 'Asia/Jerusalem'` for date/time display.
- Tailwind RTL utilities (`rtl:ml-4`, `rtl:text-right`, etc.) activate automatically because `dir="rtl"` is set on `<html>` in `frontend/index.html`.

</timezone_convention>

---

<coding_standards>

## Code Style

- **Prettier**: `singleQuote`, `semi: true`, `trailingComma: 'es5'`, `printWidth: 100`.
- **ESLint**: `@typescript-eslint/recommended`, `react-hooks/rules-of-hooks`.
- Unused variables prefixed with `_` are allowed (`_req`, `_res`, `_next` in Express handlers).
- No `import React from 'react'` needed — React 19 JSX transform is configured.
- Backend uses `AppError` (`backend/src/utils/AppError.ts`) for all operational HTTP errors; never throw plain `Error` in route handlers.
- Zod schemas live next to the route/controller that uses them.

</coding_standards>

---

<testing>

## Testing

Tests live under `backend/src/__tests__/`. Run with `--runInBand` to avoid parallel DB conflicts.

```bash
npm test --workspace=backend                                   # all tests
npm test --workspace=backend -- --testPathPatterns=<pattern>   # filtered
```

- CSP integration tests use week **2026-W11**
- Stress tests use week **2026-W25**
- Use `--testPathPatterns` (plural) — `--testPathPattern` (singular) is deprecated.

</testing>

---

<git_conventions>

## Git Conventions

- **Branching**: Use `feature/`, `fix/`, or `refactor/` prefixes.
- **Commits**: Follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`).

</git_conventions>

---

<mvp_boundaries>

## MVP Boundaries

**In scope for MVP (v1.0):** Auth, constraint submission, CSP schedule generation, drag-and-drop editor, employee dashboard, shift definitions, audit log, in-app notifications.

**Phase 2 (v1.1) — do not implement unless explicitly asked:** Shift swap workflow, PDF export, Excel export, system settings UI.

**Phase 3 (v2.0+) — do not implement unless explicitly asked:** Mobile app, push notifications, multi-tenancy, analytics.

**Explicitly out of scope for MVP:** shift swaps, mobile app, multi-tenancy, HR/payroll integrations, overtime calculation, calendar sync, employee preference scoring ('prefer not' vs 'cannot work'), automated frontend tests.

</mvp_boundaries>

---

<external_docs>

## External Documentation References

The following files contain heavy business logic that is loaded on demand — do not duplicate their content here.

- **When you are working on user roles, shift definitions, schedule states, or account management rules, please read the rules detailed in `docs/DOMAIN_MODEL.md`.**
- **When you are working on the scheduling algorithm, heuristics, fairness scoring, or pre-assignment logic, please read the rules detailed in `docs/CSP_ALGORITHM.md`.**
- **When you are working on constraint validation, hard violation blocking, or soft warning behavior, please read the rules detailed in `docs/CONSTRAINTS.md`.**
- **When you are working on the weekly workflow, deadline enforcement, notifications, or the audit log, please read the rules detailed in `docs/WEEKLY_FLOW.md`.**

</external_docs>
