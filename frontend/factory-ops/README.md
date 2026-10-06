# FactoryOps frontend

Standalone demo of the production planner. It currently runs without the backend: the plan is stored in the browser's `localStorage` and seeded with sample data ("Resetuj demo" restores it).

## Scripts

- `npm start` – dev server on <http://localhost:5173>
- `npm run build` – type check and production build to `dist/`
- `npm run lint` – ESLint
- `npm test` – unit tests (Vitest)

## Structure

- `src/domain/` – pure planning logic, no React:
  - `shifts.ts` – planning in full hours (order hours rounded up); the plant day starts at 6:00, so the 22–6 night shift belongs to the day it starts
  - `calendar.ts` – working days per machine: Mon–Fri or 4-brigade 24/7, plus day exceptions for one machine or the whole plant – a whole day on/off or working hours such as Saturday 6:00–18:00 (right-click on the plan)
  - `schedule.ts` – blocks on a machine run one after another; moving a block pushes the following ones; block length comes from the order hours (edited in the form, not by dragging)
- `src/data/` – `PlanRepository` (swap `LocalStoragePlanRepository` for an API implementation later), sample data, `PlanContext` with all plan actions and undo
- `src/components/`, `src/pages/` – UI
