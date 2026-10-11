# FactoryOps – zasady pracy

## Gałęzie i wydania

- `demo` jest gałęzią wydań: każdy push na `demo` buduje i publikuje frontend na GitHub Pages (`.github/workflows/deploy-demo.yml`).
- Tagi wydań (np. `v0.3.0`) stawiamy na `demo`. Nie scalamy `demo` do `main`, dopóki użytkownik o to nie poprosi.
- Każda zmiana idzie tym samym schematem:
  1. nowa gałąź od `demo` (np. `feature/…`, `fix/…`, `docs/…`);
  2. commity, push gałęzi (`git push -u origin <gałąź>`);
  3. `git checkout demo` i `git merge --no-ff <gałąź>`, potem `git push origin demo`;
  4. usunięcie gałęzi lokalnie i na origin (`git branch -d`, `git push origin --delete`);
  5. powrót na `demo`.
- Po pushu na `demo` sprawdź, czy workflow GH Pages przeszedł i czy strona się otwiera.

## Frontend (`frontend/factory-ops`)

- Przed każdym commitem: `npm run lint && npm test && npm run build`.
- Zmiany w `src/domain/*` wymagają rozszerzenia testów domeny.
