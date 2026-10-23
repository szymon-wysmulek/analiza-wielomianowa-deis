# DEIS Polynomial Lab

Interaktywna aplikacja przeglądarkowa do analizy wielomianowej spektrogramów impedancyjnych DEIS, wyznaczania impedancji różniczkowej i względnej oraz symulowania odpowiedzi wybranych elektrycznych obwodów zastępczych.

Projekt stanowi materiał uzupełniający rozprawę doktorską. Aplikacja pozwala szybko porównać wpływ segmentacji, stopnia wielomianu i progu jakości dopasowania na wynik analizy bez instalowania dodatkowego oprogramowania.

## Uruchom aplikację

**[Otwórz DEIS Polynomial Lab](https://szymon-wysmulek.github.io/analiza-wielomianowa-deis/)**

Aplikacja działa bezpośrednio w nowoczesnej przeglądarce. Obliczenia są wykonywane lokalnie po stronie użytkownika, a projekt nie wymaga serwera obliczeniowego ani logowania.

## Spis treści

- [Najważniejsze możliwości](#najważniejsze-możliwości)
- [Szybki start](#szybki-start)
- [Dostępne zestawy przykładowe](#dostępne-zestawy-przykładowe)
- [Ustawienia analizy](#ustawienia-analizy)
- [Automatyczny dobór parametrów](#automatyczny-dobór-parametrów)
- [Jak czytać wyniki](#jak-czytać-wyniki)
- [Impedancja różniczkowa i względna](#impedancja-różniczkowa-i-względna)
- [Symulator](#symulator)
- [Eksport wyników](#eksport-wyników)
- [Uruchomienie lokalne](#uruchomienie-lokalne)
- [Struktura repozytorium](#struktura-repozytorium)
- [Publikacja przez GitHub Pages](#publikacja-przez-github-pages)
- [Wskazówki interpretacyjne](#wskazówki-interpretacyjne)
- [Rozwiązywanie problemów](#rozwiązywanie-problemów)

## Najważniejsze możliwości

- trójwymiarowa prezentacja spektrogramów impedancyjnych DEIS;
- analiza przebiegu impedancji przy wybranej częstotliwości;
- lokalna aproksymacja części rzeczywistej i urojonej impedancji wielomianami;
- segmentacja za pomocą nakładających się okien albo przedziałów opartych na węzłach Czebyszewa;
- automatyczny dobór najniższego stopnia wielomianu spełniającego zadany próg `R²`;
- tryb `AUTO`, który dobiera rozmiar okna i nakładanie dla całego spektrogramu;
- diagnostyka dopasowania: `R²`, RMSE, MAE, błąd maksymalny, pokrycie oraz reszty;
- obliczanie impedancji różniczkowej i względnej;
- symulacja czterech typów obwodów zastępczych z parametrami zmiennymi w czasie;
- opcjonalny szum Gaussa w danych symulowanych;
- eksport wyników wybranej częstotliwości do pliku CSV;
- obsługa widoku perspektywicznego i równoległego, obrotu oraz powiększenia wykresów 3D.

## Szybki start

1. Otwórz [aplikację online](https://szymon-wysmulek.github.io/analiza-wielomianowa-deis/).
2. W sekcji **Dane** wybierz jeden z trzech zestawów przykładowych.
3. Ustaw częstotliwość analizowanego przebiegu.
4. Wybierz strategię segmentacji i sposób doboru stopnia wielomianu.
5. Kliknij **Przelicz analizę**.
6. Odczytaj metryki jakości, wykres reszt i rozkład stopni wielomianu.
7. Jeżeli nie chcesz dobierać parametrów segmentacji ręcznie, ustaw zakres stopni oraz próg `R²`, a następnie kliknij **AUTO · dobierz parametry**.

> **Najprostszy wariant:** wybierz zestaw danych, ustaw zakres stopni i próg `R²`, uruchom `AUTO`, a następnie oceń pokrycie, reszty i rozkład stopni.

## Dostępne zestawy przykładowe

| Zestaw | Liczba widm | Liczba częstotliwości | Zakres częstotliwości | Zmienna analizy |
|---|---:|---:|---:|---|
| Powłoka akrylowa | 990 | 24 | 3–4507 Hz | czas `t` [h] |
| Korozja wżerowa | 750 | 23 | 5–4507 Hz | potencjał `E` [V] |
| Inhibitor korozji | 540 | 35 | 3–61030 Hz | czas `t` [h] |

Dla powłoki akrylowej i inhibitora analiza oraz wizualizacja są prowadzone w funkcji czasu. Dla korozji wżerowej wszystkie dopasowania, pochodne i wykresy są wykonywane w funkcji potencjału.

W zestawie dotyczącym korozji wżerowej używany jest ciągły potencjał skanu odtworzony z kolumny potencjału. Zapobiega to problemom numerycznym powodowanym przez powtarzające się i skwantowane wartości potencjału. Czas nie uczestniczy w analizie tego zestawu.

## Ustawienia analizy

### Źródło i zestaw danych

W aplikacji dostępne są dwa źródła:

- **Przykładowe** – trzy dołączone zestawy eksperymentalne;
- **Symulowane** – dane wygenerowane w symulatorze obwodów zastępczych.

Opcja **Symulowane** staje się aktywna po wygenerowaniu pierwszego spektrogramu w symulatorze. Można później przełączać się między ostatnią symulacją i zestawami przykładowymi.

### Częstotliwość

Suwak **Częstotliwość** wybiera kolumnę spektrogramu używaną na wykresie przebiegu izoczęstotliwościowego, wykresie reszt i w głównych metrykach jakości. Charakterystyki różniczkowe i względne są obliczane dla wszystkich dostępnych częstotliwości.

### Składowa do diagnostyki

Pole **Składowa do diagnostyki** określa wielkość prezentowaną na wykresie reszt:

- `Z′` – część rzeczywista impedancji;
- `−Z″` – część urojona w konwencji stosowanej na wykresach impedancyjnych;
- `|Z|` – moduł impedancji.

Zmiana tej opcji nie modyfikuje samego dopasowania. Wpływa na sposób prezentacji diagnostyki.

### Widma w podglądzie

Parametr **Widma w podglądzie** określa gęstość trójwymiarowej wizualizacji. Nie zmienia liczby danych użytych w obliczeniach.

### Nakładające się okna

W tej strategii dane są dzielone na lokalne fragmenty:

- **Rozmiar okna** – liczba kolejnych widm użytych w jednym dopasowaniu;
- **Krok** – przesunięcie początku kolejnego okna.

Jeżeli krok jest mniejszy od rozmiaru okna, segmenty zachodzą na siebie. Przybliżony udział nakładania można obliczyć jako:

```text
nakładanie [%] = (1 − krok / rozmiar_okna) × 100
```

Wyniki z nakładających się segmentów są uśredniane w punktach wspólnych. Mniejsze okno lepiej odwzorowuje szybkie zmiany, ale może zwiększać wrażliwość na szum. Większe okno zwykle daje stabilniejsze, bardziej globalne dopasowanie.

### Segmentacja Czebyszewa

Strategia **Czebyszew** dzieli zakres zmiennej niezależnej na przedziały wyznaczone na podstawie węzłów Czebyszewa. Parametr **Liczba węzłów** steruje liczbą i rozmieszczeniem segmentów.

Ta metoda może być przydatna, gdy oczekiwane zmiany są silniejsze w pobliżu krańców analizowanego zakresu.

### Dobór stopnia przez próg R²

Dla każdego segmentu aplikacja sprawdza kolejne stopnie od wartości **Stopień min.** do **Stopień maks.**. Wybierany jest pierwszy, czyli najniższy stopień, dla którego średnia jakość dopasowania części rzeczywistej i urojonej spełnia warunek:

```text
R²_średnie = (R²_Re + R²_Im) / 2 ≥ ustawiony próg R²
```

Jeżeli żaden stopień z wybranego zakresu nie spełni kryterium, segment nie jest przyjmowany. Skutkiem może być pokrycie mniejsze niż 100%.

Wyższy próg `R²` oznacza bardziej rygorystyczne kryterium. Może jednak prowadzić do wyboru wyższych stopni albo odrzucenia części segmentów.

### Stały stopień

Po wybraniu opcji **Stały** każdy segment jest aproksymowany wielomianem o tej samej wartości **Stopień wielomianu**. Tryb ten jest pomocny podczas porównywania z góry przyjętych modeli.

## Automatyczny dobór parametrów

Przycisk **AUTO · dobierz parametry** automatyzuje dobór segmentacji dla całego spektrogramu.

Przed uruchomieniem AUTO ustaw:

1. **Stopień min.**;
2. **Stopień maks.**;
3. wymagany **Próg R²**.

AUTO zachowuje dokładnie te trzy wartości. Automatycznie dobiera wyłącznie:

- rozmiar okna;
- krok, a tym samym poziom nakładania.

Algorytm porównuje do 12 wariantów utworzonych z typowych rozmiarów okna i poziomów nakładania około 40%, 60% i 75%. Każdy wariant jest oceniany na wszystkich częstotliwościach spektrogramu. Najpierw uwzględniane jest pokrycie danych, następnie znormalizowany błąd dopasowania, a przy zbliżonych wynikach preferowany jest prostszy model i mniejsze nakładanie.

Po zakończeniu metryczka AUTO pokazuje:

- zastosowany próg `R²`;
- zadany zakres stopni;
- zakres stopni faktycznie użytych w zaakceptowanych segmentach;
- średni użyty stopień;
- wybrane okno i krok;
- przybliżone nakładanie;
- pokrycie całego spektrogramu.

AUTO przełącza analizę na nakładające się okna i kryterium `R²`. Wynik można następnie dopracować ręcznie.

## Jak czytać wyniki

### Spektrogram impedancyjny

Główny wykres przedstawia rodzinę widm impedancyjnych. Można osobno włączać:

- linię danych izoczęstotliwościowych;
- linię dopasowania wielomianowego.

Widok 3D obsługuje projekcję perspektywiczną i równoległą. Suwaki zmieniają azymut, elewację oraz powiększenie. Wykres można także obracać przeciągnięciem i powiększać kółkiem myszy.

### Metryki jakości

| Metryka | Znaczenie |
|---|---|
| **R² średnie** | Średnia z `R²` części rzeczywistej i urojonej dla dopasowanego przebiegu. Wartość bliższa 1 oznacza lepsze odwzorowanie danych. |
| **RMSE** | Pierwiastek ze średniego kwadratu zespolonego błędu dopasowania. Mocniej reaguje na duże błędy. |
| **MAE** | Średni moduł błędu zespolonego. Jest łatwiejszy do interpretacji jako typowy błąd punktu. |
| **Błąd maks.** | Największy moduł błędu wśród punktów objętych dopasowaniem. |
| **Pokrycie** | Procent punktów, dla których co najmniej jeden segment spełnił kryterium i dostarczył wynik. |

Wysokie `R²` nie powinno być oceniane w oderwaniu od pokrycia, reszt oraz stopni wielomianu. Bardzo wysoki stopień może poprawić metrykę dopasowania, ale jednocześnie zwiększyć ryzyko nadmiernego dopasowania.

### Przebieg izoczęstotliwościowy 3D

Wykres zestawia dane i wynik aproksymacji dla częstotliwości wybranej suwakiem. Trzeci wymiar przedstawia czas albo potencjał, zależnie od zestawu.

### Reszty aproksymacji

Wykres reszt pokazuje różnicę między danymi i dopasowaniem dla składowej wybranej w polu **Składowa do diagnostyki**. Losowy rozkład niewielkich reszt zwykle świadczy o poprawnym dopasowaniu. Struktura, trend albo pojedyncze duże odchylenia mogą wskazywać na niedopasowanie, zmianę mechanizmu lub dane odstające.

### Stopnie w segmentach

Panel pokazuje, ile zaakceptowanych segmentów wykorzystało poszczególne stopnie wielomianu. Pomaga szybko ocenić złożoność modelu i sprawdzić, czy rygorystyczny próg `R²` nie wymusza bardzo wysokich stopni.

### Porównanie uruchomień

Tabela zapisuje ostatnie uruchomienia w bieżącej sesji. Ułatwia porównanie strategii segmentacji, kryterium, `R²` oraz RMSE. Przycisk **Wyczyść** usuwa historię z widoku.

## Impedancja różniczkowa i względna

Aplikacja wyznacza pochodną lokalnego przybliżenia wielomianowego, a następnie oblicza:

```text
Z_DIFF = ∂Z/∂x
Z_REL  = (∂Z/∂x) / Z
```

gdzie:

- `x = t` dla danych analizowanych w funkcji czasu;
- `x = E` dla korozji wżerowej analizowanej w funkcji potencjału.

Jednostki są zmieniane automatycznie:

| Oś analizy | `Z_DIFF` | `Z_REL` |
|---|---|---|
| czas | Ω·cm²·h⁻¹ | h⁻¹ |
| potencjał | Ω·cm²·V⁻¹ | V⁻¹ |

Pochodne uzyskane z nakładających się segmentów są uśredniane i wygładzane filtrem Savitzky'ego–Golaya z oknem do 21 punktów i wielomianem pierwszego stopnia.

## Symulator

Symulator pozwala utworzyć kontrolowany spektrogram i sprawdzić zachowanie analizy dla znanego modelu.

### Dostępne modele

| Model | Opis |
|---|---|
| `R₁(C₁R₂)` | Rezystancja szeregowa i jeden pojemnościowy proces relaksacyjny. |
| `R₁(C₁R₂)(C₂R₃)` | Dwa nakładające się pojemnościowe procesy relaksacyjne. |
| `R₁(Q₁R₂)` | Proces dyspersyjny opisany elementem stałofazowym CPE. |
| `Randles + W` | Obwód Randlesa z dyfuzją Warburga. |

### Zmienność parametrów

Każdy parametr modelu może zmieniać się w czasie według jednego z przebiegów:

- stałego;
- liniowego;
- eksponencjalnego;
- sigmoidalnego;
- sinusoidalnego.

Dla przebiegu sinusoidalnego wartość końcowa oznacza ekstremum osiągane w połowie eksperymentu.

### Parametry eksperymentu

Można ustawić:

- czas trwania eksperymentu;
- liczbę widm;
- minimalną i maksymalną częstotliwość;
- liczbę częstotliwości rozmieszczonych logarytmicznie;
- poziom szumu Gaussa w procentach.

Domyślny poziom szumu wynosi `0%`. Po kliknięciu **Generuj i analizuj** aplikacja tworzy dane, wybiera reprezentatywną częstotliwość i uruchamia analizę. Nowy zestaw staje się dostępny pod źródłem **Symulowane**.

## Eksport wyników

Przycisk **Eksport CSV** zapisuje wynik bieżącej analizy dla wybranej częstotliwości. Plik zawiera:

- `time_h` albo `potential_v` – wartość osi analizy;
- `frequency_hz` – analizowaną częstotliwość;
- `re_z`, `im_z` – dane impedancyjne;
- `re_fit`, `im_fit` – wartości dopasowane;
- `absolute_residual` – moduł błędu;
- `mean_degree` – średni stopień wynikający z nakładających się segmentów.

Puste wartości dopasowania oznaczają punkty nieobjęte przez żaden zaakceptowany segment.

## Uruchomienie lokalne

Projekt jest statyczną aplikacją HTML/CSS/JavaScript i nie wymaga instalowania zależności ani procesu budowania.

### Sposób zalecany

Sklonuj repozytorium:

```bash
git clone https://github.com/szymon-wysmulek/analiza-wielomianowa-deis.git
cd analiza-wielomianowa-deis
```

Uruchom prosty serwer HTTP, na przykład za pomocą Pythona:

```bash
python -m http.server 8000
```

Następnie otwórz:

```text
http://127.0.0.1:8000/
```

Można również użyć dowolnego innego serwera plików statycznych, na przykład rozszerzenia Live Server.

## Struktura repozytorium

```text
.
├── index.html                 # struktura interfejsu
├── styles.css                 # wygląd i układ responsywny
├── app.js                     # analiza, wizualizacja i symulator
├── favicon.svg
├── data/
│   ├── akryl-data.js          # przykład: powłoka akrylowa
│   ├── pitting-data.js        # przykład: korozja wżerowa
│   ├── inhibitor-data.js      # przykład: inhibitor korozji
│   └── raw/                   # źródłowe pliki tekstowe zestawów
└── README.md
```

Aplikacja podczas pracy wczytuje pliki `data/*-data.js`. Pliki z katalogu `data/raw/` pełnią rolę danych źródłowych i nie są odczytywane bezpośrednio przez interfejs.

## Publikacja przez GitHub Pages

Repozytorium jest przygotowane jako statyczna strona GitHub Pages. Po zapisaniu zmian w gałęzi publikowanej przez Pages wykonaj:

```bash
git add .
git commit -m "Aktualizacja aplikacji DEIS"
git push
```

Jeżeli Pages nie jest jeszcze skonfigurowane:

1. otwórz **Settings → Pages** w repozytorium;
2. w sekcji **Build and deployment** wybierz publikację z gałęzi;
3. wskaż gałąź `main` i katalog główny `/`;
4. zapisz ustawienia i poczekaj na zakończenie wdrożenia.

Po publikacji aplikacja jest dostępna pod adresem:

```text
https://szymon-wysmulek.github.io/analiza-wielomianowa-deis/
```

## Wskazówki interpretacyjne

- Zacznij od umiarkowanego progu, na przykład `R² = 0,990`, i sprawdź pokrycie.
- Oceniaj jednocześnie `R²`, RMSE, wykres reszt i rozkład stopni.
- Jeśli wiele segmentów osiąga maksymalny dopuszczony stopień, rozważ większe okno, szerszy zakres stopni albo mniej rygorystyczny próg.
- Jeżeli pokrycie jest małe, część segmentów nie spełniła kryterium w zadanym zakresie stopni.
- Bardzo małe okna mogą reagować na lokalne fluktuacje i szum zamiast na zmianę procesu.
- Silne nakładanie wygładza przejścia między segmentami, ale zwiększa liczbę obliczeń.
- Tryb AUTO jest dobrym punktem wyjścia, lecz ostateczny wybór parametrów powinien uwzględniać charakter eksperymentu i sens fizyczny wyniku.
- Dla korozji wżerowej interpretuj pochodne jako zmiany względem potencjału, nie czasu.

## Rozwiązywanie problemów

### Po aktualizacji nadal wyświetla się stara wersja

GitHub Pages i przeglądarka mogą przechowywać starsze pliki w pamięci podręcznej. Poczekaj na zakończenie wdrożenia, a następnie użyj twardego odświeżenia:

- Windows/Linux: `Ctrl + F5` albo `Ctrl + Shift + R`;
- macOS: `Cmd + Shift + R`.

### Pokrycie wynosi mniej niż 100%

Co najmniej część segmentów nie osiągnęła ustawionego progu `R²`. Możesz:

- obniżyć próg `R²`;
- zwiększyć maksymalny stopień;
- zmienić rozmiar okna;
- zwiększyć nakładanie;
- uruchomić AUTO dla bieżącego zakresu stopni i progu.

### AUTO wybiera wysokie stopnie

AUTO nie zmienia zadanego zakresu stopni ani progu `R²`. Wysokie stopnie oznaczają, że niższe stopnie z tego zakresu nie spełniły kryterium w części segmentów. Ogranicz **Stopień maks.**, obniż próg albo zwiększ okno i uruchom analizę ponownie.

### AUTO działa wolniej

Czas obliczeń rośnie wraz z liczbą widm, częstotliwości, testowanych stopni i segmentów. Zawężenie zakresu stopni albo ręczne ustawienie większego kroku ogranicza liczbę obliczeń.

### Symulacja nie pokazuje oczekiwanej zmiany

Sprawdź wybrany przebieg parametrów oraz wartości początkowe i końcowe. Dla przebiegu stałego używana jest tylko wartość początkowa. Przy szumie `0%` symulacja jest pozbawiona losowych zaburzeń.

---

Repozytorium: [github.com/szymon-wysmulek/analiza-wielomianowa-deis](https://github.com/szymon-wysmulek/analiza-wielomianowa-deis)
