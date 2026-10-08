Wdróż redesign „1b · Pulpit planisty” w aplikacji FactoryOps (branch `demo`, katalog `frontend/factory-ops`).

Pełna specyfikacja jest w `design_handoff_factoryops_1b/README.md`. Wizualne referencje są w `design_handoff_factoryops_1b/design/FactoryOps Review.dc.html` (otwórz w przeglądarce; sekcje #1b, #2a–#2c, #3a–#3g).

Zasady:
- Nie zmieniaj logiki w `src/domain/*` ani zachowania `PlanContext` (poza dodaniem `updateBlocks` do akcji zbiorczych). Testy domeny muszą przejść bez zmian.
- Zostań przy react-bootstrap i react-calendar-timeline. Styl przenieś do CSS (tokeny w `src/theme.css`), nie do inline-styles.
- Pracuj etapami według sekcji „Kolejność wdrożenia” w README. Po każdym etapie uruchom `npm run lint && npm test && npm run build` i zrób osobny commit.
- Gdy coś w README jest niejasne albo wymaga wyliczeń, których nie da się zrobić na obecnych danych (np. podgląd skutku), zrób wersję minimum opisaną w README i zostaw TODO.

Zacznij od przeczytania README i plików wymienionych w „Mapa ekranów → pliki w repo”, potem przedstaw krótki plan pierwszego etapu.
