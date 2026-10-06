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
- `src/components/`, `src/pages/` – UI: plan (zoom, collapsible line/machine groups, search, order side panel), order list (filters, sorting, CSV export for Excel), load page (7-day heatmap, breakdowns), machines page
