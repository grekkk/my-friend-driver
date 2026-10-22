# My Friend Driver

Polska aplikacja PWA do rozliczania wspólnych przejazdów. Zapisz przejazd, zarejestruj płatność i sprawdź, ile pozostało do zapłaty. Działa lokalnie, bez konta i backendu.

Docelowy adres: **https://grekkk.github.io/my-friend-driver/**

## Funkcje

- Cztery zakładki SPA: Główna, Historia, Analityka, Ustawienia.
- Znajomi ze stawką, saldem i własną historią; edycja oraz potwierdzane usuwanie z historią.
- Szybkie dodawanie przejazdu w panelu od dołu: dzisiejsza data, ostatni znajomy, jego stawka, jedna sztuka. Liczbę, datę, stawkę i koszt można zmienić, a notatkę dodać opcjonalnie.
- Płatności częściowe i „Rozlicz całość”. Nowa płatność nie może przekroczyć należności. Nadpłata powstała po edycji/usunięciu rozliczonego przejazdu jest prezentowana osobno i pomniejsza kolejne koszty u tego znajomego.
- Historia z edycją, potwierdzaniem usuwania, filtrem znajomego i miesiąca oraz ładowaniem kolejnych 50 wpisów.
- Koszty i liczba przejazdów, płatności, porównanie miesięcy, wykres roku i zestawienie według znajomych. Koszt jest liczony według daty przejazdu, płatność według daty rozliczenia.
- Motyw jasny, ciemny i systemowy, systemowa typografia iOS, Safe Area, dostępne formularze i dialogi, ograniczony ruch.
- CountUp.js animuje kwoty w groszach; formatowanie PLN odbywa się podczas wyświetlania, a `prefers-reduced-motion` wyłącza animację.
- Automatyczny lokalny zapis, walidacja, migracja, eksport/import JSON z potwierdzeniem oraz podwójne potwierdzenie resetu.
- PWA offline, ikony Apple/maskable, instalacja do ekranu początkowego, aktualizacja na żądanie bez kasowania danych.

## Uruchomienie

Wymagania: Node.js **24**, pnpm **11.25.0** (wersja przypięta w `packageManager`).

```sh
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
```

Adres lokalny ma ścieżkę `/my-friend-driver/`. Repozytorium zachowuje zastaną licencję MIT.

```sh
pnpm test             # logika i magazyn danych
pnpm check            # TypeScript
pnpm build            # produkcyjny dist wraz z manifestem i SW
pnpm exec playwright install chromium
pnpm test:e2e         # testy produkcyjnej aplikacji w Chromium
pnpm preview         # podgląd dist
```

Na Windows konfiguracja testów używa lokalnego Edge, jeśli znajduje się w opisanej ścieżce; na pozostałych systemach używa Chromium Playwright. Testy nie korzystają z danych użytkownika. Tworzą odrębne konteksty przeglądarki i lokalne dane testowe. Wersja deweloperska nie rejestruje SW; działanie offline testuj na produkcyjnym buildzie.

## Model danych i prywatność

Źródłem prawdy jest jeden dokument JSON pod kluczem `my-friend-driver:data` w localStorage. Schemat **2** zawiera `friends`, `transactions` i `settings`. Każda operacja najpierw waliduje i zapisuje cały dokument jednym `setItem`, a następnie aktualizuje UI. Błąd zapisu pozostawia poprzedni stan i pokazuje komunikat. Konflikt między kartami jest wykrywany przez porównanie poprzedniego dokumentu; zdarzenie `storage` odświeża stan w pozostałych oknach. localStorage nie zapewnia transakcyjnej blokady wielu kart: należy unikać równoczesnej edycji w kilku oknach.

Wszystkie kwoty, stawki i obliczenia salda używają **całkowitych groszy**. Dzielenie przez 100 występuje wyłącznie przy prezentacji. Rekord przejazdu zachowuje kopię stawki; zmiana znajomego nie przelicza historii. Saldo jest zawsze wyprowadzane z operacji źródłowych. Daty operacji są lokalnymi ciągami `YYYY-MM-DD`, bez konwersji przez UTC. `createdAt` służy tylko do porządkowania wpisów w tym samym dniu.

Migracja z wersji 1 zachowuje znajomych i transakcje, dodaje `rememberFriend: true` i brak ostatniego znajomego. Dokument wersji 1 ma ten sam format operacji co wersja 2, ale ustawienia `theme` i `defaultRate`. Migracja odbywa się przy odczycie; jej wynik jest zapisywany przy następnej poprawnej operacji. Nowsze, nieznane wersje są odrzucane. Uszkodzony zapis **nie jest automatycznie nadpisywany**: UI oferuje pobranie oryginału, import poprawnej kopii lub potwierdzony reset.

Import sprawdza typy, daty, zakresy, unikalność identyfikatorów, referencje do znajomych i wersję. Limit pliku: 15 MB, 1000 znajomych, 50 000 wpisów. localStorage może wyczerpać się wcześniej; aplikacja zgłasza błąd i nie pozoruje zapisu. Reset zastępuje tylko własny dokument pustymi danymi, nie wywołuje `localStorage.clear()` i nie usuwa cudzych cache.

Nie ma geolokalizacji, analityki śledzącej, CDN, połączeń bankowych ani wysyłania danych aplikacji na serwer. Z hostem statycznym kontaktują się jedynie pobrania plików aplikacji i sprawdzanie nowych wersji. Dane lokalne nie są zaszyfrowane przez aplikację; korzystaj z zabezpieczeń urządzenia.

**Regularnie eksportuj JSON.** Safari/WebKit lub system mogą usunąć dane witryny; tryb prywatny i wyczyszczenie pamięci również mogą je skasować. Instalacja PWA nie zastępuje kopii zapasowej. Karta Safari i aplikacja z ekranu początkowego mogą korzystać z odrębnej pamięci. Przed przenoszeniem zrób eksport/import.

## PWA i aktualizacje

`vite-plugin-pwa`/Workbox buforuje lokalne pliki produkcyjne. Vite `base`, manifest `id`, `start_url`, `scope`, fallback nawigacji i SW są ustawione dla **`/my-friend-driver/`**. Nawigacja zakładek jest stanem React, więc nie tworzy dodatkowych ścieżek wymagających przekierowań serwera.

Pierwsza pełna wizyta wymaga internetu. Service Worker obejmuje stronę po aktywacji; kolejne uruchomienia działają offline. Nowa wersja czeka na świadome „Aktualizuj”; przy otwartym panelu edycji przycisk jest zablokowany. Aktualizacja zmienia cache zasobów, a nie localStorage. Sprawdzanie aktualizacji odbywa się również po powrocie do aplikacji online. Brak sieci nie blokuje zapisu przejazdów.

Na iPhonie: Safari → Udostępnij → Do ekranu początkowego → Dodaj. Aplikacja zawiera instrukcje odpowiednie dla platformy i nie udaje systemowego przycisku instalacji.

## Publikacja GitHub Pages

Workflow `.github/workflows/deploy.yml` uruchamia się przy pushu na `main`, pull requeście lub ręcznie. Wykonuje deterministyczną instalację z lockfile, testy jednostkowe, TypeScript/build oraz testy przeglądarkowe (także offline i aktualizacji SW). PR uruchamia weryfikację bez deploymentu.

Po poprawnej weryfikacji oficjalne akcje `configure-pages`, `upload-pages-artifact` i `deploy-pages` publikują `dist`. Zadanie deploymentu ma `pages: write` i `id-token: write`; używa środowiska `github-pages`. Workflow próbuje też włączyć Pages przez `enablement: true`. GitHub może wymagać jednorazowego ustawienia administratora, gdy wbudowany token Actions nie ma uprawnienia Administration:

1. Repozytorium → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Actions → Test and deploy to GitHub Pages → Run workflow** (lub ponowienie nieudanego uruchomienia).

Nie potrzeba ręcznego przesyłania plików ani dodatkowego serwera. Workflow nie wykonuje force-pusha. Nowe wydania publikuje zwykły push na `main`.

## Weryfikacja

Testy obejmują: znajomych, kopiowanie stawek, wiele przejazdów, edycję/usuwanie, częściowe i pełne płatności, blokadę nadpłat, rozdzielenie kosztów i płatności między miesiącami/latami, lokalne daty i lata przestępne, kwoty PLN, kopie JSON, błędne importy, migrację, uszkodzone i przepełnione localStorage, konflikty kart, podwójny reset, CountUp, motywy, ograniczony ruch, responsywność 320–1440 px, manifest i ikony, restart offline, zapis offline oraz aktualizację Service Workera bez utraty historii.

Nie wykonano testów na fizycznym iPhonie. Na urządzeniu należy jeszcze sprawdzić instalację z Safari, klawiaturę ekranową, Safe Area/Dynamic Island, VoiceOver i ponowne uruchomienie z ekranu początkowego po restarcie telefonu. Symulacja rozmiaru telefonu w Chromium nie zastępuje Safari/WebKit.

## Projekt interfejsu

Zastosowano skill `design-taste-frontend`, wariant aplikacyjny **Pastel consumer**, seed `1026300192`, bez ponownego losowania. Systemowe fonty Apple i Tab Bar wynikają z briefu i zastępują desktopową powłokę z biblioteki. Duży tytuł 32 px jest świadomym wyjątkiem z uwagi na wymaganie iOS Large Titles. Wizualnym punktem ciężkości jest saldo, a tożsamość znajomych niosą inicjały. Każda zakładka odpowiada kolejno: ile jestem winien, skąd wynika saldo, ile kosztują przejazdy w miesiącu oraz jak zarządzać aplikacją i kopiami danych. Nie ma danych demonstracyjnych w aplikacji. Wykres słupkowy bazuje na lokalnym helperze skilla, ograniczonym w buildzie do używanej funkcji i uzupełnionym o zwalnianie obserwatorów i polską etykietę dostępności.

Dokumentacja konfiguracji: [Vite na GitHub Pages](https://vite.dev/guide/static-deploy.html#github-pages), [aktualizacje Vite PWA](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html), [oficjalny workflow Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
