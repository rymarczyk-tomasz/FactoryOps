# Uwagi użytkownika (Wiśnia) – runda po v0.2.0-ui

**Status: wdrożone w v0.3.0** (branch `demo`, merge da69bd6).

Commity – pierwsza runda (P0–P2):

| Punkt | Commit | Opis |
| --- | --- | --- |
| P0-1 | 8a83e64 | Godziny technologiczne przeliczone na czas zegarowy na planie |
| P0-2 | 704758f | Zlecenia usuniętej linii lub maszyny trafiają do „Bez maszyny” |
| P0-3 | 5b62452 | Wykrywanie i pokazywanie konfliktów linii z maszynami |
| P1-1 | 54c0eaa | Flagi gotowości materiału i programu |
| P1-2 | 9deb292 | Kolor projektu wybierany przez planistę |
| P1-3 | 12194ec | Identyfikator „IMR-xxxx · stopień”, bez numeru zamówienia w formularzu |
| P1-4 | bd469c0 | „Stopień / detal” zamiast „Operacja” |
| P1-5 | f75cf00 | Zapisane widoki, sortowanie wielopoziomowe, filtr dat startu |
| P2-1 | 3322db0 | Ściągawka „Jak to działa” |
| P2-2 | 9205cf9 | Czytelna stopka-legenda |
| P2-3 | 8e8eb2f | Lista wyników wyszukiwania po prawej |

Commity – poprawki po przeglądzie:

- 3431b88 – pierwsza runda poprawek (podwiersze „Bez maszyny”, licznik konfliktów, karta podpowiedzi, ZAM, toasty, lista, obciążenie maszyn linii);
- 654eac6 – druga runda (chipy „+N” na dobę, karty konfliktów, pigułki listy, toasty gotowości, „13 z listy”).

Decyzje Tomasza: przełącznika „Planuj jako linię / jako osobne maszyny” nie dodajemy; duplikaty stopni w projekcie bez ostrzeżeń; widoki listy w localStorage.

Priorytety: **P0** to błąd lub ryzyko utraty danych, **P1** to ważna funkcja dla planisty, **P2** to rzeczy „nice to have”.
Przed P1-3, P1-4 i P1-5 dopytaj Tomasza o model danych. Zmieniają one `domain/*`, więc testy domeny trzeba rozszerzyć, a nie tylko utrzymać w zielonym stanie.

## P0 – błędy

### P0-1. Godziny technologiczne nie są przeliczane na zegarowe
- Pole „Czas pracy jednej maszyny” przyjmuje godziny **technologiczne**, ale „Na planie: 100 h” pokazuje tę samą liczbę. Dla linii czas jest dzielony przez liczbę maszyn, jednak nie uwzględnia czasu wolnego (dni wolne, zmiany).
- Pod polem pokaż na żywo: `100 h pracy → na planie 4 dni 6 h zegarowo (pt 14:00 → wt 20:00)`. Wylicz to tą samą funkcją, której używa harmonogram (koniec minus start po reflow), a nie samym dzieleniem.
- Nazwa pola: „Czas technologiczny (h)”.

### P0-2. Usunięcie linii lub maszyny gubi zlecenia
- Dziś zlecenia linii idą do usunięcia razem z nią (komunikat: „zostanie usunięta razem ze zleceniami linii (417)”).
- Ma być tak: zlecenia zostają, ale bez przypisanego zasobu (`resourceId = null`, status „Bez maszyny”).
- Treść potwierdzenia: „417 zleceń straci przypisanie i trafi do grupy *Bez maszyny*.”
- Na planie dodaj grupę **„Bez maszyny · N”** na górze, z czerwonym znacznikiem. Na liście dodaj filtr-pill „Bez maszyny · N”. Przypisanie robi się przeciągnięciem na wiersz albo w panelu.
- Undo działa tak jak dziś.

### P0-3. Zlecenie na maszynie linii koliduje ze zleceniem całej linii
- Gdy linia ma zlecenie na 3 maszyny, a na jedną z nich dodano osobne zlecenie, stopień linii jest liczony na 3 maszyny, choć jedna jest zajęta. W efekcie część pracy „znika”.
- Wykrywanie: dla każdej linii szukaj nakładania się zleceń linii i zleceń jej maszyn w czasie. Wynik podawaj jako listę konfliktów `{lineId, machineId, lineBlockId, machineBlockId, od, do}`.
- Wyświetlanie:
  - przy nazwie linii w sidebarze czerwony znacznik `!` z liczbą konfliktów;
  - w rail, pod „Awarie teraz”, sekcja „Konflikty · N” z listą, a klik przewija do konfliktu;
  - na bloczkach konfliktowych czerwona przerywana ramka.
- Po rozwinięciu linii jej maszyny mają pokazywać **własne bloczki** i fragment zlecenia linii, który na nich przypada, wyszarzony.
- Do decyzji z Tomaszem: czy linie, które robią różne stopnie na różnych maszynach, mają być planowane jako niezależne maszyny (przełącznik w edycji linii: „Planuj jako linię / jako osobne maszyny”).

## P1 – planista

### P1-1. Gotowość materiału i programu na bloczku
- Dwie nowe flagi na zleceniu: `materialReady: boolean` i `programReady: boolean`.
- Na bloczku dwie małe ikony 12 px przy lewej krawędzi, przed etykietą: **klocki** = materiał gotowy, **kartka** = program gotowy. Gdy flaga jest wyłączona, ikona ma kolor `#94a3b8` z 40% krycia albo jest ukryta (zdecyduj według czytelności w widoku Miesiąc).
- W panelu zlecenia dwa przełączniki (checkboxy-pigułki) pod „Programista”: zmiana od razu, z undo.
- **Masowe oznaczanie**:
  - w menu prawego kliku na bloczku opcje „Materiał gotowy” i „Program gotowy” (toggle);
  - przy zaznaczeniu wielu bloczków (Ctrl/Shift+klik na planie albo zaznaczenie na liście) ta sama akcja dla wszystkich;
  - na liście kolumny-ikony, filtr i akcja zbiorcza w ciemnym pasku.
  - Cel: oznaczenie 20 stopni w kilka kliknięć.
- Ikony z jednego zestawu, np. Lucide `blocks` i `file-check` (paczka `lucide-react`).

### P1-2. Kolor projektu wybierany przez planistę
- W formularzu przy polu projektu 8 swatchy z `PROJECT_COLORS`. Domyślnie kolor z hasha.
- Po wpisaniu istniejącego `IMR-xxxx` kolor ustawia się sam na kolor tego projektu.
- Kolor zapisuj **na projekcie** (`projects[imr].color`), nie na zleceniu, i edytuj go też z panelu. Zmiana koloru zmienia wszystkie bloczki projektu.

### P1-3. Mniej pól: identyfikator to IMR
- Do potwierdzenia: czy „Numer zamówienia” (ZAM/…) można usunąć. Wiśnia twierdzi, że wystarcza IMR-1234.
- Jeśli tak: z formularza znika numer zamówienia, a etykiety bloczków, listy i panelu używają `IMR-xxxx · stopień`. Zostaw pole w modelu jako opcjonalne, żeby nie ruszać importu ani eksportu.

### P1-4. „Operacja” → „Stopień / detal”
- Etykieta pola: „Stopień / detal”, placeholder „np. Stopień 3, Wirnik”. Słowo „operacja” kojarzy się z procesem (5-osi, spawanie).
- **Usuń chipy szybkiego wyboru**: każdy stopień jest inny, więc się nie powtarzają. Zamiast nich zwykły `datalist` z wartościami z bieżącego projektu (IMR).
- Nazwy w kodzie zostają po angielsku, a etykiety w UI po polsku.

### P1-5. Lista: zapisane widoki i sortowanie wielopoziomowe
- Przykład użycia: „nieprzypisany programista · start od teraz do +14 dni · tylko Zaplanowane · sortuj: maszyna, potem start”.
- Do zrobienia:
  - filtr zakresu dat startu z presetami „Dziś”, „+7 dni”, „+14 dni” i „Własny”;
  - sortowanie wielopoziomowe: Shift+klik w nagłówek dodaje kolejny poziom, a w nagłówku widać numer poziomu i strzałkę;
  - zapisane widoki: przycisk „Zapisz widok”, który zapisuje filtry i sortowanie w localStorage, oraz zakładki-pigułki nad filtrami. Jeden wbudowany widok: „Do zaprogramowania · 14 dni”.

## P2 – drobne / nice to have

### P2-1. Ściągawka
- Przycisk `?` w topbarze planu (i skrót `?`) otwiera okno „Jak to działa” w trzech sekcjach:
  - Mysz: klik, dwuklik, przeciąganie, prawy klik na wierszu i na dniu;
  - Klawiatura: tabela z README;
  - Kalendarz: jak włączyć jeden weekend dla jednej maszyny (prawy klik na dniu → „Dzień pracujący / wolny…” → wyjątek dla maszyny).
- Ściągawka zastępuje część tekstu w stopce.

### P2-2. Stopka-legenda jest nieczytelna
- Każdy skrót jako para: `<kbd>dwuklik</kbd> nowe zlecenie`. `kbd` ma tło `--seg-bg`, radius 4 i padding 1/5. Między parami 20 px przerwy i separator `·` w `--ink-3`.
- Rozmiar 12 px zamiast 11.5, kolor `--ink-2`.
- Gdy brakuje miejsca, chowaj pary od końca, bo pełna lista jest w ściągawce.

### P2-3. Wyniki wyszukiwania jako lista po prawej
- Przy aktywnym wyszukiwaniu albo „wybranych z listy” przycisk „Lista wyników” w pasku wyszukiwania otwiera kolumnę 300 px (w tym samym miejscu co panel zlecenia).
- Każdy wynik pokazuje IMR, stopień, zasób i start. Klik przewija do bloczka i podświetla go mocniej: ramka 2 px plus pulsowanie 2×.

### Odrzucone
- Kreskowanie postępu w toku w czasie wolnym. Wiśnia sam wycofał ten pomysł („olać”).
