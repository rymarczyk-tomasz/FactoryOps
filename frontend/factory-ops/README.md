# FactoryOps frontend

Standalone demo of the production planner. It currently runs without the backend: the plan is stored in the browser's `localStorage` and seeded with sample data ("Resetuj demo" restores it).

## Scripts

- `npm start` – dev server on <http://localhost:5173>
- `npm run build` – type check and production build to `dist/`
- `npm run lint` – ESLint
- `npm test` – unit tests (Vitest)

## Structure

- `src/domain/` – pure planning logic, no React:
  - `shifts.ts` – planning in full hours; the plant day starts at 6:00, so the 22–6 night shift belongs to the day it starts. Each hour has a capacity: how many machines work in it (0 = stopped)
  - `calendar.ts` – capacity per machine row: working days (Mon–Fri or 4-brigade 24/7, day exceptions or working hours such as Saturday 6:00–18:00, right-click on the plan), number of identical machines (a production line has 3, so an order takes a third of the time) and breakdowns of some or all of them
  - `schedule.ts` – orders on a machine run one after another. An order without a date follows the previous one both ways (pushed when it grows, pulled back when it shrinks or is removed); an order dropped with a clear gap keeps that date but is still pushed. Nothing is moved before "now", and started orders are not pulled back. Order length comes from the hours in the form (one machine's hours), not from dragging
  - `load.ts` – daily load per machine (busy vs available machine-hours) for the "Obciążenie" page
  - `machines.ts` – saving a machine/line from the dialog, keeping breakdowns attached to the right line machines
- `src/data/` – `PlanRepository` (swap `LocalStoragePlanRepository` for an API implementation later), sample data, `PlanContext` with all plan actions and undo
- `src/components/`, `src/pages/` – UI (see below). Presentation helpers that compute from the plan without changing it (load per day, breakdown impact, removal impact, placement preview for the order form) live in `src/components/planSelectors.ts`

## UI

The design follows the Claude Design handoff "1b · Pulpit planisty" (`docs/design/1b/`). Styles are plain CSS: design tokens and Bootstrap overrides in `src/theme.css`, app shell in `src/index.css`, and one CSS file per component or page. Fonts: IBM Plex Sans / Mono.

- **Shell** – left rail with navigation and "Awarie teraz" (ongoing breakdowns with duration and the number of orders they extend; a click opens the plan at that row). Each page has its own top bar. Messages after a change appear bottom-right with "Cofnij".
- **Plan** – timeline with plant days starting at 6:00, a "now" line, load per row for the next 7 days, a 32px footer with the legend (or the drop position while dragging). Clicking an order opens the details panel (docked; below 1360px wide it overlays the plan). Hovering an order shows a card with its details. Right-click on a row: add an order, end/remove breakdowns, report a breakdown, day calendar.
- **Lista zleceń** – status tabs with counts, multi-select filters, "Bez programisty", row selection (Shift+click for a range) with bulk programmer assignment, CSV export and "Pokaż na planie" (several orders are highlighted on the plan and can be stepped through).
- **Obciążenie** – tiles, heatmap for 7/14/30 days (full days ≥98% in one colour without a label, so free capacity stands out), breakdown cards with impact.
- **Maszyny** – lines as cards (members, load, orders, "⋯" menu), standalone machines in a table.
- **Dialogs** – order form with a placement preview computed on the draft, breakdown report with "what happens", day calendar with per-line/machine exceptions, line and machine forms, confirmations with the impact of the change.

## Keyboard

| Key | Where | Action |
| --- | --- | --- |
| `/` | plan, list | focus search |
| `Enter` / `Shift+Enter` | plan search | next / previous match |
| `Esc` | plan | close the hover card, then the order panel; clear search when in the field |
| `Esc` | menus, dialogs | close |
| `Ctrl+Z` / `⌘Z` | anywhere outside text fields and dialogs | undo the last change |
| `Ctrl+Enter` | new order form | save and add another |
| arrows, `Home`, `End` | segmented controls, work-mode cards | change the choice |
| double-click | plan | new order at that hour (on an order: edit it) |
| right-click | plan row | row menu |
| Shift+click | list row | select a range |

All controls are reachable with Tab and show a visible focus outline.
