# Handoff: FactoryOps – redesign „1b · Pulpit planisty”

Repo: `rymarczyk-tomasz/FactoryOps`, branch **`demo`**, katalog `frontend/factory-ops`.
Stos: React 18 + TypeScript + Vite, react-bootstrap 2 / Bootstrap 5.3, react-calendar-timeline 0.30, react-router 7.

## Overview
Wdrożenie nowej warstwy wizualnej i kilku usprawnień UX w całej aplikacji. **Logika domenowa (`src/domain/*`, `src/data/*`) zostaje bez zmian** — to czysta zmiana UI (komponenty, strony, style) plus kilka nowych selektorów/wyliczeń prezentacyjnych.

Cel: plan na pełną szerokość, stała widoczność awarii, obciążenie w wierszu planu, panel zlecenia dosunięty (nie nakładany), jaśniejsze bloczki z ciemnym tekstem, spójne okna i komunikaty.

## About the Design Files
Pliki w `design/` to **referencje projektowe w HTML** (prototyp pokazujący wygląd i zachowanie), **nie kod produkcyjny do skopiowania**. Zadanie: odtworzyć te projekty w istniejącym kodzie React/TypeScript z użyciem jego wzorców i bibliotek (react-bootstrap, react-calendar-timeline). Nie wklejaj HTML ani inline-styles z prototypu — przenieś wartości do CSS (zmienne + klasy w `index.css` lub nowych plikach `.css`).

Otwórz `design/FactoryOps Review.dc.html` w przeglądarce (obok musi leżeć `support.js`). To płótno z sekcjami — każdy ekran ma identyfikator (np. `#1b`, `#2a`, `#3c`), można przejść przez `…dc.html#2a`.

## Fidelity
**High-fidelity.** Kolory, typografia, odstępy, promienie i stany są docelowe. Dane w makietach są przykładowe (wygenerowane według zasad z `seed.ts`) — w aplikacji pochodzą z `usePlan()`.

## Mapa ekranów → pliki w repo

| Sekcja w prototypie | Co to jest | Pliki do zmiany |
|---|---|---|
| `#0a`–`#0d` | **stan obecny** (tylko porównanie, nie implementować) | — |
| `#1b` | Plan (nowy) | `App.tsx`, `components/FactoryOpsTimeline.tsx`, `components/BlockDetailsPanel.tsx`, `index.css` |
| `#2a` | Lista zleceń | `pages/ListPage.tsx`, `components/MultiSelect.tsx` |
| `#2b` | Obciążenie | `pages/LoadPage.tsx` |
| `#2c` | Maszyny | `pages/MachinesPage.tsx` |
| `#3a` | Nowe / edycja zlecenia | `components/BlockFormModal.tsx` |
| `#3b` | Zgłoś awarię | `components/BreakdownModal.tsx` |
| `#3c` | Kalendarz dnia | `components/DayCalendarModal.tsx` |
| `#3d` | Nowa / edycja linii | `components/LineFormModal.tsx` |
| `#3e` | Nowa / edycja maszyny | `components/MachineFormModal.tsx` |
| `#3f` | Potwierdzenie | `components/ConfirmModal.tsx` (+ reset demo w `App.tsx`) |
| `#3g` | Menu kontekstowe, toast, podpowiedź, drop-info, MultiSelect | `components/RowContextMenu.tsx`, `App.tsx` (Toast), `FactoryOpsTimeline.tsx` (tooltip, drop-info), `components/MultiSelect.tsx` |

Sekcje `#1a` (wariant „Porządek”) — **odrzucona**, nie implementować.

---

## Design Tokens

Zdefiniuj w `:root` (np. nowy plik `src/theme.css` importowany po bootstrapie w `index.tsx`) i mapuj na zmienne Bootstrapa (`--bs-body-font-family`, `--bs-primary` itd.), żeby react-bootstrap dziedziczył.

### Typografia
- `--font-sans: 'IBM Plex Sans', system-ui, sans-serif` — wagi 400/500/600
- `--font-mono: 'IBM Plex Mono', ui-monospace, monospace` — wagi 400/500
- Ładowanie: `@fontsource/ibm-plex-sans` + `@fontsource/ibm-plex-mono` (preferowane, offline) lub Google Fonts.
- **Mono używamy dla**: nazw maszyn/linii (`HSTM 301`, `L2-M2`, `Linia 1` w wierszach planu), numerów (`ZAM/2026/00452`, `IMR-6001`), dat/godzin, procentów, liczników, kbd-hintów, etykiet sekcji (UPPERCASE).
- Skala: tytuł strony 19px/600 · tytuł okna 18px/600 · tytuł panelu 19px/600 · treść 14px · drugorzędna 13–13.5px · etykieta pola 12.5px · meta 11–12px · etykieta sekcji mono 10.5–11px, `letter-spacing: .06em`, uppercase.

### Kolory (neutralne — chłodny slate)
| Token | Wartość | Użycie |
|---|---|---|
| `--ink` | `oklch(0.25 0.02 260)` (~`#1f2937`) | tekst główny |
| `--ink-2` | `oklch(0.45 0.02 260)` | tekst drugorzędny, etykiety pól |
| `--ink-3` | `oklch(0.52–0.55 0.02 260)` | meta, placeholdery, etykiety sekcji |
| `--surface` | `#ffffff` | panele, tabele, okna |
| `--canvas` | `oklch(0.985 0.003 255)` | tło obszaru roboczego |
| `--rail` | `oklch(0.965 0.006 255)` | menu boczne |
| `--subtle` | `oklch(0.975 0.004 255)` | wiersze grup, stopki okien |
| `--seg-bg` | `oklch(0.95 0.006 255)` | tło segmented control |
| `--line` | `oklch(0.91 0.008 255)` | obramowania paneli |
| `--line-2` | `oklch(0.94–0.95 0.005 255)` | linie wierszy |
| `--input-border` | `oklch(0.88 0.008 255)` | inputy, przyciski outline |
| `--primary` | `#1e293b` | przycisk główny (ciemny), zaznaczenie |
| `--accent` | `#2563eb` | focus, aktywny filtr, logo |
| `--danger` | `#dc2626` | **tylko awarie i usuwanie**; linia „teraz” |
| `--danger-tint` | `oklch(0.95–0.97 0.02–0.03 25)` | tło alertu awarii |
| `--danger-ink` | `oklch(0.42–0.45 0.13–0.15 25)` | tekst na tle awarii |
| `--success` | `#16a34a` / tint `#dcfce7` / ink `#166534` | „W toku”, postęp |
| `--info-tint` | `#dbeafe` / ink `#1d4ed8` | „Zaplanowane” |
| `--warn` | `#f59e0b` / tint `oklch(0.96 0.04 75)` / ink `oklch(0.45 0.1 60)` | brak programisty, wyjątek dnia, miejsce upuszczenia, obciążenie > 90% |

### Kolory projektów (zastępują `PROJECT_COLORS` w `FactoryOpsTimeline.tsx`)
```ts
// czerwony #dc2626 i #059669 usunięte – kolidowały z awarią / statusem „W toku”
const PROJECT_COLORS = ['#2563eb', '#0d9488', '#d97706', '#7c3aed', '#db2777', '#65a30d', '#0891b2', '#4f46e5'];
```
Hash `projectColor()` bez zmian. Pochodne kolory (CSS `color-mix`, wspierany przez wszystkie aktualne przeglądarki):
- wypełnienie bloczka: `color-mix(in oklch, C 14%, white)`
- część wykonana (w toku): `color-mix(in oklch, C 34%, white)`
- obramowanie: `color-mix(in oklch, C 50%, white)`
- tekst: `color-mix(in oklch, C 72%, black)`
- chip numeru projektu: tło 14%, tekst 72% (jak wyżej)

### Promienie, cienie, odstępy
- radius: 4px (bloczek, chip), 5–6px (input, przycisk, segment), 7–8px (segmented track, karta, tabela), 10px (menu, toast, popover), 12px (okno modal), 999px (pill)
- cień karty w menu: `0 1px 2px rgba(15,23,42,.06)`; aktywny segment: `0 1px 2px rgba(15,23,42,.08)`
- popover/menu: `0 12px 32px rgba(15,23,42,.18)`; modal: `0 20px 50px rgba(15,23,42,.25)`; toast: `0 10px 28px rgba(15,23,42,.25)`
- focus inputu: `border 1.5px #2563eb` + `box-shadow 0 0 0 3px rgba(37,99,235,.15)`
- odstępy: 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24px. Padding stron 20–24px, okien 24px.
- wysokości: input/przycisk 32–36px, segment 30px (track padding 3px), pasek górny 60px, stopka-legenda 32px.

---

## Layout aplikacji (App.tsx)

Zastąp ciemny `Navbar` + `Container` + `card` układem:
```
┌ rail 200px ┬──────────── main (flex:1) ─────────────┐
│ logo       │ topbar 60px (tytuł, kontekst, akcje)     │
│ nawigacja  ├──────────────────────────────────────────┤
│ Awarie     │ treść strony (bez karty, pełna szer.)    │
│ teraz · N  │                                          │
│ …          │                                          │
│ Resetuj    │                                          │
└────────────┴──────────────────────────────────────────┘
```
- **Rail** (`--rail`, border-right `--line`, padding 18px 12px, gap 24px): logo (istniejący SVG z `App.tsx`, 22px) + „FactoryOps” 15px/600; linki `NavLink` (padding 8px 10px, radius 6px; aktywny: białe tło + cień karty + 500); sekcja **„Awarie teraz · N”** (mono 11px uppercase `--danger-ink`) — lista kart trwających awarii (`state.breakdowns.filter(isOngoing)`): kropka 7px red, nazwa maszyny mono 12.5/500, linia/„maszyna” 12px `--ink-3`, druga linia „od HH:MM · X h” 12px `--danger-ink`. Klik → przejście do planu i `showBlock`/reveal wiersza. Na dole „Resetuj demo” (tekst 12.5px, otwiera ConfirmModal).
- Rail zwija się poniżej `md` (np. do 56px z samymi inicjałami lub do offcanvas) — prototyp nie pokazuje mobile; zachowaj obecne zachowanie `Navbar.Toggle` jako fallback.
- Toast przenieś do prawego górnego rogu obszaru `main` lub zostaw top-center — wygląd wg `#3g`.

---

## Ekrany

### `#1b` Plan (FactoryOpsTimeline + BlockDetailsPanel)
**Topbar** (białe tło, border-bottom `--line`, padding 0 20px, gap 12px): „Plan” 19/600 · zakres mono 12.5px `--ink-3` (np. `07–14.10.2026`) · segmented Dzień/Tydzień/Miesiąc · grupa `‹` `Dziś` `›` (30×30, radius 6) · po prawej: wyszukiwarka 260px z kbd „/” (skrót klawiszowy fokusuje pole) · „Zgłoś awarię” (outline czerwony: tekst `--danger-ink`, border `oklch(0.88 0.04 25)`) · „Nowe zlecenie” (primary `#1e293b`). Przycisk „Cofnij” → skrót Ctrl/⌘+Z i przycisk w toaście (usunąć z paska). Przełącznik „Pokaż maszyny linii” → przenieść do menu nagłówka grupy lub zostawić jako mały link w nagłówku sidebaru.

**Timeline** — nadpisz CSS biblioteki (już robicie to `!important` w `index.css`):
- Nagłówek: białe tło (zamiast `#1e293b`), wysokość 48px, border-bottom `--line`. Sidebar header: „ZASÓB” / „7 DNI” mono 10.5px uppercase, rozsunięte.
- **Kolumny dni od 6:00** (doba zakładu). Obecny `DateHeader unit="day"` liczy od północy. Rozwiązanie: własny `intervalRenderer` nie wystarczy — użyj `DateHeader` z `unit="day"` i przesuń widoczną siatkę, albo (prościej) zamiast `DateHeader` wyrenderuj własny `CustomHeader` z interwałami liczonymi z `shiftDayStart()`. Komórka: dzień tygodnia 11px `--ink-3` nad datą mono 13/500 (`czw 8.10`). Dzień wolny dla maszyn pon–pt: data `#94a3b8`, podpis „wolne pon–pt”. Dziś: podpis „dziś · od 6:00” w kolorze red, padding-left 36px (żeby nie wchodził pod chip godziny). Pionowe linie siatki na granicach 6:00 (`--line-2`).
- **Linia „teraz”**: 2px `#dc2626` + chip na górze nagłówka: mono 10.5px, biały na czerwonym, `HH:MM`, wyśrodkowany na linii. Użyj `CustomMarker` z `TimelineMarkers`.
- **Sidebar** 230px (`sidebarWidth={230}`), wiersze: linia 40px, maszyna linii 32px, maszyna 40px, nagłówek grupy 30px (`ROW_HEIGHT=40`, `LINE_MACHINE_ROW_HEIGHT=32`, `HEADER_HEIGHT=30`). Zawartość wiersza (`groupRenderer`): kropka 7px (red gdy trwa awaria, inaczej `oklch(0.85 0.01 255)`) · nazwa mono 13/500 (maszyna linii 12px `--ink-2`, wcięcie 30px) · meta 11px `--ink-3`: `3× · 24/7` dla linii, `pon–pt` dla maszyny · **mini-pasek obciążenia 7 dni** (36×4px, tło `oklch(0.93 0.006 255)`, wypełnienie `#64748b`, `#d97706` gdy > 90%) + procent mono 11px. Usuń kolorowe Badge `3×`/`24/7`/`awaria`. Obciążenie liczyć przez `dailyLoad`/`loadPercent` z `domain/load.ts` dla 7 dób od `shiftDayStart(now)` (zmemoizować).
- Nagłówki grup: tło `--subtle`, tytuł 12.5/600 + licznik mono 11.5px `--ink-3`, chevron zostaje.
- **Bloczki** (`itemRenderer` / `itemProps.style`): `itemHeightRatio` 0.72, radius 4, padding 0 7px, 12px/500, tekst = kolor tekstu projektu (bez `text-shadow`). Etykieta: `operacja · nr projektu` (wariant z nazwą projektu tylko w podpowiedzi). Tło: wypełnienie 14%; dla **w toku** dodatkowa warstwa `linear-gradient(to right, <34%> 0 p%, transparent p%)` gdzie p = postęp do `now`; **zakończone** `opacity .5`; fragmenty w czasie wolnym — paski `repeating-linear-gradient(-45deg, oklch(0.975 0.004 255) 0 6px, color-mix(C 10%, white) 6px 12px)` (adaptacja istniejącego `blockBackground`). Zaznaczenie: `box-shadow 0 0 0 2px #1e293b`. Odstęp 1px z każdej strony między sąsiednimi bloczkami.
- Czas wolny wiersza: paski `oklch(0.975 0.004 255) / oklch(0.94 0.006 255)`, 5/10px.
- Awaria na maszynie: pasek `repeating-linear-gradient(45deg,#dc2626 0 4px,#b91c1c 4px 8px)`, top/bottom 2px, radius 3. Awaria na linii — zostaw obecną mechanikę „część wysokości” w tej samej kolorystyce.
- **Stopka-legenda** 32px (`--subtle`, border-top): swatche „w toku”, „wolne”, „awaria” + po prawej mono 11.5px: `dwuklik · nowe zlecenie   prawy klik · awaria / dzień   / · szukaj   ⌘Z · cofnij`. Zastępuje długą legendę w pasku narzędzi. Gdy trwa przeciąganie, w tym miejscu pokaż drop-info (`#3g`).

**Panel zlecenia** (`BlockDetailsPanel`): zamiast `Offcanvas` (nakłada się) — **kolumna 340px w układzie flex obok timeline'u**, timeline się zwęża (nie zasłania). Biały, border-left `--line`.
- Nagłówek (padding 18/20/14, border-bottom): chip nr projektu · pill statusu (W toku: `#dcfce7/#166534`; Zaplanowane: `#dbeafe/#1d4ed8`; Zakończone: `#f1f5f9/#475569`) · × po prawej; tytuł `operacja · nazwa projektu` 19/600; nr zamówienia mono 12px; dla w toku pasek postępu 6px zielony `#16a34a` + procent mono.
- Ciało: alert awarii (jeśli `breakdowns` w czasie zlecenia): tło `--danger-tint`, radius 8, „Awaria w trakcie zlecenia” 600 + opis „L2-M2 stoi od 04:00 — zlecenie wydłuża się co godzinę.”; lista definicji (grid `max-content 1fr`, gap 7px 16px, 13.5px): Linia/Maszyna, Czas pracy (z dopiskiem dla linii), Start, Koniec (mono 12.5px); select Programista (gdy brak — tekst ostrzegawczy „Nie przypisano” w `--warn` ink); **„Kolejka · {zasób}”**: poprzednie 1 + bieżące + 2 następne zlecenia na tym zasobie (sort po `start`), każde: pasek 4×22px w kolorze projektu (50%), tytuł 13/500, mono 11px `start → HH:MM`; bieżące na tle `oklch(0.96 0.008 255)`, zakończone opacity .55; klik zaznacza zlecenie.
- Stopka: „Edytuj” (primary, flex:1) · „Pokaż” · „Usuń” (tekst danger).
- Panel chowa się na czas przeciągania (zachowaj obecne zachowanie).

### `#2a` Lista zleceń (ListPage)
- Topbar: „Lista zleceń” + mono „N aktywnych · M w archiwum” · wyszukiwarka 340px z „/” · „Eksport do Excela” (outline) · „Nowe zlecenie” (primary).
- Pasek filtrów (padding 14px 24px, gap 8): **segmented statusów z licznikami** (Wszystkie / W toku / Zaplanowane / Zakończone — liczniki mono 11px) zamiast MultiSelect statusu; MultiSelect-y Maszyna/Projekt/Programista jako przyciski 30px z etykietą szarą + wartością (`Maszyna wszystkie ▾`); szybki filtr-pill **„Bez programisty · N”** (warn tint) = `programmerIds=[UNASSIGNED]`; po prawej przełącznik „Archiwum”.
- Tabela w białym panelu (radius 8 8 0 0): grid kolumn `44px 120px 1.5fr 1fr 110px 200px 70px 1fr`; nagłówek mono 10.5px uppercase 38px; wiersz 50px: checkbox · status (kropka + tekst) · zlecenie (`operacja · nr projektu` 500 + nr zamówienia mono 11.5px) · projekt (chip + nazwa) · zasób mono · start / → koniec (mono 12px, dwie linie) · czas mono do prawej · programista (avatar 24px z inicjałami + imię; gdy brak: przycisk dashed „Przypisz ▾” w warn). Zaznaczony wiersz: tło `oklch(0.97 0.015 255)`.
- **Domyślnie** sortowanie po starcie od bieżących (ukryj zakończone, chyba że wybrano „Zakończone”) — dziś lista zaczyna od zleceń sprzed 30 dni.
- **Akcje zbiorcze**: pasek na dole panelu 56px; gdy zaznaczono ≥1 — tło `#1e293b`, biały tekst: „N zaznaczone” · „Przypisz programistę ▾” (biały przycisk) · „Pokaż na planie” · „Eksportuj zaznaczone” · „Wyczyść zaznaczenie”. Bez zaznaczenia — szary pasek: „Pokazano X z N · …” + „Załaduj kolejne 200” (zastępuje obecny przycisk paginacji).
- Usuwa 200 `Form.Select` w wierszach (wydajność). Pojedyncze przypisanie — przez „Przypisz ▾” (popover) lub panel.
- Nowa akcja w `PlanContext`: `updateBlocks(ids, patch)` z jednym wpisem undo (albo pętla `updateBlock` jeśli undo grupuje).

### `#2b` Obciążenie (LoadPage)
- Topbar: „Obciążenie” + mono „08–14.10 · doby 6:00–6:00” · segmented 7 / 14 / 30 dni (nowy stan `DAYS`).
- Układ: lewa kolumna (flex:1) + prawa 340px z awariami.
- Kafelki (3 kolumny, białe, border, radius 8, padding 14/16): etykieta 12.5px · wartość 28/600 · pasek 4px (accent). Trzeci kafel: liczba trwających awarii w czerwieni + „wydłużają N zleceń”.
- Mapa cieplna w panelu: grid `200px repeat(7,1fr) 150px 80px`; nagłówek 44px (dzień tyg. 11px nad datą mono 12.5/500; dziś podpis „dziś” red); wiersz grupy 30px pełnej szerokości (`--subtle`, tytuł 600 + „średnio X%”); wiersz 38px: kropka awarii · nazwa mono · meta · komórki 28px radius 5 mono 12px. Kolor komórki: `color-mix(in oklch, #2563eb (8 + p·0.82)%, oklch(0.975 0.004 255))`, tekst biały gdy p > 55. Dzień wolny: komórka w paski + „wolne”. Dzisiejsza kolumna: `inset 0 0 0 1px` ciemny 25%; zasób z trwającą awarią: dzisiejsza komórka `inset 0 0 0 2px #dc2626`. „Wolna od” mono 12px, „Kolejka” mono do prawej.
- Prawa kolumna „Awarie” (+ licznik, „Zgłoś awarię”): karta na awarię — kropka, nazwa mono 14/500, linia, pill statusu; lista: Od / Do (trwa = red) / Czas („3 h · rośnie”) / Wpływ (wyliczyć: liczba zleceń, których `[start,end]` nachodzi na awarię na tej maszynie lub jej linii); przyciski „Zakończ teraz” (red, flex:1) + „Pokaż na planie”. Zakończone: opacity .75, bez przycisków (pokazywane przy „Pokaż zakończone”). Pod spodem skala kolorów 0–100%.

### `#2c` Maszyny (MachinesPage)
- Topbar: „Maszyny” + mono „60 maszyn · 9 linii · 29 w liniach” · wyszukiwarka · „Nowa linia” (outline) · „Nowa maszyna” (primary).
- **Linie jako karty** (grid 3 kolumny, gap 12): nazwa 14.5/600 · `3× · 24/7` mono · pill „1 stoi” gdy awaria · „⋯” (Dropdown: Edytuj / Domknij przerwy / Usuń — **usuń jako ostatnia, czerwona**) ; chipy maszyn mono 11.5px (awaria: czerwony tint); pasek obciążenia 7 dni + % + „N zleceń” (dla linii z samymi zleceniami maszyn: „N zleceń na maszynach”). Karta z awarią: border czerwony tint.
- **Maszyny samodzielne**: tabela grid `1.3fr 1fr 1.2fr 90px 150px 40px` — nazwa mono 13/500 · system pracy · obciążenie (pasek 120px + %) · zlecenia mono · stan (kropka + „Pracuje” / „Awaria · 5 h”) · „⋯”. Maszyny w liniach widać w kartach (nie powtarzać w tabeli; ewentualnie przełącznik „pokaż wszystkie”).

---

## Okna (wspólny wzorzec — zastąp style `Modal` react-bootstrap)
- `.modal-content`: radius 12, bez obramowania, cień modal. Backdrop: `rgba(15,23,42,.35)`.
- Header: padding 20px 24px 16px, tytuł 18/600, `×` 20px `--ink-3`, bez border-bottom.
- Body: padding 0 24px 20px, gap 16px; etykieta 12.5px `--ink-2` 5px nad polem; pola 36px.
- Footer: padding 14px 24px, border-top `oklch(0.93 0.006 255)`, tło `oklch(0.985 0.003 255)`; „Anuluj” jako przycisk-tekst; akcja główna `#1e293b` (lub `#dc2626` dla destrukcyjnych); opcjonalna podpowiedź po lewej (mono 11.5px lub 12.5px).
- Segmented control: track `--seg-bg` radius 7–8, padding 3, aktywny biały + cień + 500.

### `#3a` BlockFormModal
- Grid 2 kolumny, gap 16/18. Pola i walidacje bez zmian (patrz kod). Nowe:
  - Pod „Operacja / stopień” chipy szybkiego wyboru (5 ostatnio używanych operacji z `operations`), klik wpisuje wartość.
  - „Nazwa projektu” po auto-uzupełnieniu (`fillProjectName`) pokazuje w polu po prawej 11.5px zielony „uzupełniono z IMR-6001”.
  - „Linia / maszyna”: wartość nazwa mono 500 + opis szary (`cała linia · 3 maszyny` / `tylko ta maszyna`).
  - „Czas pracy jednej maszyny” z sufiksem „h”; `hoursHint()` pod polem, wartość na planie pogrubiona.
  - Programista nieprzypisany — tekst w warn ink.
  - „Start”: segmented „Na koniec kolejki” / „Od wybranej godziny” (zamiast radio); przy manual pole datetime + „Zostanie zaokrąglony do pełnej godziny.”
  - **Podgląd** (pełna szerokość, tło `oklch(0.97 0.012 255)`, radius 8): etykieta „PODGLĄD” mono + tekst `zasób · po ZAM/… · start … → koniec …`. Wyliczyć przez `previewMove`/logikę `schedule.ts` dla szkicu (bez zapisu). Jeśli trudne — wersja minimum: zasób + „na koniec kolejki po {ostatnie zlecenie}”.
  - Stopka: „Ctrl+Enter · zapisz i dodaj kolejne” (mono) · Anuluj · „Zapisz i dodaj kolejne” (outline) · „Dodaj”/„Zapisz”.

### `#3b` BreakdownModal
- Tytuł z czerwoną kropką. Select maszyny: nazwa mono + linia.
- „Stoi od”: chipy szybkie `teraz · −1 h · −2 h · −4 h · −8 h` (ustawiają `from` = `hourStartAtOrBefore(now) - k·h`; aktywny ciemny) + pole datetime + podpowiedź.
- Zamiast `alert-light`: blok **„Co się stanie”** (danger tint, border `oklch(0.9 0.04 25)`): opis z kodu skrócony + dla maszyny w linii „Linia X nie staje — pracuje na N−1 z N maszyn”; linia mono „Wydłuży: …” = zlecenia aktywne na tej maszynie/linii od `from`.
- Przycisk „Zgłoś awarię” czerwony.

### `#3c` DayCalendarModal
- Tytuł „Sobota, 10 października 2026” + mono „doba 6:00 → nd 6:00”.
- „Cały zakład”: segmented 4 opcji (zamiast ToggleButton group), opis pod spodem; dla „Tylko w godzinach” selekty `6:00 ▾ – 18:00 ▾` inline.
- „Wyjątki dla linii i maszyn” + „pracuje **N** z 60 maszyn” (mono) + wyszukiwarka 200px.
- Tabela w ramce radius 8: grid `1fr 260px 110px`; wiersz linii 36px (`--subtle`, 600, wynik „cała linia”); maszyny linii wcięte 30px; maszyna: nazwa mono + system 11.5px; select 30px; wynik 12.5/500 (pracuje `#15803d`, wolne `#b91c1c`, godziny `#a16207`). **Wiersz z własnym wyjątkiem**: kropka 6px `#f59e0b` przed nazwą i obramowanie selecta `#f59e0b`. Linie można zwijać (▸ Linia 2 … Linia 9).
- Stopka: „N wyjątki maszyn · zmiany przesuną zlecenia po zapisie” · Anuluj · Zapisz.

### `#3d` LineFormModal
- Lista maszyn w ramce: wiersz 40px — numer mono, nazwa mono 500, pill „nowa” (`#dcfce7/#166534`), notatka „samodzielna → przejdzie do linii” / „przejdzie z Linia X” (`#a16207`), × po prawej. Pod listą w jednym rzędzie (tło `--subtle`): select „Dodaj istniejącą…”, input „Nowa, np. L10-M4”, przycisk „Dodaj”. Opis pod ramką. Select systemu pracy. Przycisk „Dodaj linię” / „Zapisz”. Walidacje bez zmian.

### `#3e` MachineFormModal
- Tytuł „Edytuj:” + nazwa mono. **System pracy jako 2 karty-radio** (grid 2 kol.): „Pon–pt, 3 zmiany / weekend wolny, chyba że wyjątek” i „4-brygadowy, 24/7 / pracuje codziennie”; aktywna: border 1.5px `#1e293b`, tło `oklch(0.975 0.006 255)`. Select linii + podpowiedź + ostrzeżenie `leavesLineTooSmall` (warn ink).

### `#3f` ConfirmModal
- Tytuł bez obramowania (padding 22/24/8). Treść jak w kodzie (nr mono). Opcjonalny prop `impact?: ReactNode` → szary blok „SKUTEK” (np. „Linia 1 · 3 kolejne zlecenia startują 20 h wcześniej” — wyliczenie z różnicy reflow przed/po). Dopisek „Można cofnąć z komunikatu na górze ekranu lub Ctrl+Z.” gdy akcja undoable. Przycisk destrukcyjny czerwony.

### `#3g` Drobne elementy
- **RowContextMenu**: karta radius 10, cień popover; nagłówek (border-bottom): „Czwartek, 8 października · Linia 2” 600 + opis 12px; pozycje 8px 10px radius 6 (hover `oklch(0.96 0.008 255)`), „Dodaj zlecenie od 14:00” z hintem mono „dwuklik”; awarie jako blok danger tint z przyciskami „Zakończ teraz” (red, 26px) / „Usuń”; „Zgłoś awarię…” w danger ink; separator; „Dzień pracujący / wolny…” z mono datą.
- **Toast** (App.tsx): ciemny `#1e293b`, radius 10, cień toast, padding 10/12/10/14, 13px: zielona kropka · tekst (numery mono) · „Cofnij” biały przycisk 26px · × opacity .6. Pozostaw autohide 6 s.
- **Podpowiedź zlecenia**: zamień natywny `title` na własny hover-card (np. react-bootstrap `OverlayTrigger` + `Popover`, delay 400 ms): chip projektu + „operacja · nazwa”; grid Zamówienie / Czas / Termin / Programista (12.5px); stopka „Klik: szczegóły · dwuklik: edycja · przeciągnij: przenieś”. Nie pokazywać w trakcie przeciągania.
- **Drop-info**: biały pasek z border warn, kreska 3px `#f59e0b`, „**Wstawisz:** Linia 3 · czw. 14:00 · po 00448 · przed 00455” — w miejscu stopki-legendy.
- **MultiSelect**: przycisk 32px; z wyborem: border 1.5px `#2563eb`, tekst `#1d4ed8`, „Maszyna **3 wybrane**”. Menu radius 10, cień popover, szerokość 300: pole „Szukaj…” na górze (nowe — filtruje opcje), nagłówki grup mono 10.5 uppercase, checkboxy 15px radius 4 (zaznaczony `#1e293b` z ✓), opcje wcięte 32px mono; stopka „Wyczyść wybór” / „Gotowe”.

---

## Interactions & Behavior
- Wszystkie istniejące interakcje planu zostają (drag z kreską, autoscroll, dwuklik, prawy klik, klik w dzień, wyszukiwanie z Enter/Shift+Enter, Esc).
- Nowe skróty: `/` → fokus wyszukiwarki (plan, lista); `Ctrl/⌘+Z` → `undo()` (gdy fokus nie w polu tekstowym).
- Klik karty awarii w rail → nawigacja na `/` + reveal wiersza + przewinięcie do `breakdown.start`.
- Panel zlecenia: otwiera się po zaznaczeniu, × lub Esc zamyka, zwęża timeline (zmiana szerokości → timeline musi się przeliczyć; react-calendar-timeline reaguje na resize kontenera — w razie potrzeby wywołaj `window.dispatchEvent(new Event('resize'))` po otwarciu).
- Lista: klik w wiersz przełącza checkbox; klik w nr zamówienia/„Pokaż na planie” → plan z zaznaczonym zleceniem.
- Przejścia: segmenty/hover 120 ms ease; panel boczny bez animacji wysuwania (dosunięcie) albo 150 ms width.

## State Management
- Bez zmian w `PlanContext` poza: `updateBlocks(ids, patch)` (akcja zbiorcza z jednym undo).
- Nowe selektory (memo): obciążenie 7 dni na zasób (`loadUnits` + `dailyLoad`), liczba zleceń dotkniętych awarią, kolejka zasobu dla panelu, liczniki statusów listy.
- UI-state: `selectedIds` na liście, zakres dni na Obciążeniu, `startMode` w formularzu (już jest), wyszukiwanie w MultiSelect.

## Assets
- Logo: istniejący inline SVG z `App.tsx` (bez zmian).
- Fonty: IBM Plex Sans / IBM Plex Mono (OFL) — `npm i @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono`.
- Ikony: brak nowych — używane znaki tekstowe (`‹ › ▾ ▸ × ⋯ ✓`), jak w obecnym kodzie.

## Kolejność wdrożenia (sugerowana)
1. `theme.css` (tokeny, fonty, nadpisania Bootstrapa: przyciski, inputy, modal, dropdown, toast, badge) — od razu poprawia wszystkie okna.
2. Shell `App.tsx` (rail + topbar per strona, awarie w rail).
3. Plan: CSS timeline'u, sidebar z obciążeniem, bloczki, nagłówek dób od 6:00, marker „teraz”, stopka-legenda, panel dosunięty.
4. Lista (filtry, tabela, zaznaczanie, akcje zbiorcze).
5. Obciążenie, Maszyny.
6. Okna `#3a`–`#3f`, potem `#3g`.
7. `npm run lint && npm test && npm run build` — testy domeny muszą przejść bez zmian.

## Files
- `design/FactoryOps Review.dc.html` — wszystkie projekty (otwórz w przeglądarce; obok `design/support.js`). Sekcje: `#3a–#3g` okna i drobne elementy, `#2a–#2c` widoki, `#1b` plan (wybrany kierunek), `#1a` odrzucony, `#0a–#0d` stan obecny.
- `design/support.js` — runtime potrzebny do otwarcia prototypu (nie dotyczy implementacji).
