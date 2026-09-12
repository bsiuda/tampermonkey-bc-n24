# BC N24 Tampermonkey Script

Userscript do Business Central rozwijany pod Tampermonkey.

![Version](https://img.shields.io/badge/version-1.1.0-0a7b83?style=flat-square)
![Tampermonkey](https://img.shields.io/badge/Tampermonkey-userscript-4caf50?style=flat-square)
![Business Central](https://img.shields.io/badge/Business%20Central-N24-1f6feb?style=flat-square)

## Linki

- Repozytorium: https://github.com/bsiuda/tampermonkey-bc-n24
- Instalacja / aktualizacja: https://raw.githubusercontent.com/bsiuda/tampermonkey-bc-n24/main/BC_N24_RowHighlight.user.js

## Co robi skrypt

Skrypt pomaga w codziennej pracy w Business Central:
- podmienia wybrane etykiety pol,
- koloruje wskazane pola w naglowku,
- oznacza wiersze wedlug typu budzetu,
- zaznacza wiersze z brakami w wymaganych polach `W_*`,
- pogrubia wiersze typu `Suma` / `Total`.

## Szybka instalacja

1. Zainstaluj rozszerzenie Tampermonkey w przegladarce.
2. Otworz link:
   https://raw.githubusercontent.com/bsiuda/tampermonkey-bc-n24/main/BC_N24_RowHighlight.user.js
3. Tampermonkey wykryje skrypt automatycznie.
4. Kliknij `Install`.
5. Odswiez Business Central.

## Krotka instrukcja dla zespolu

Tekst do wyslania dalej:

> Zainstaluj Tampermonkey w przegladarce, potem otworz link:
> https://raw.githubusercontent.com/bsiuda/tampermonkey-bc-n24/main/BC_N24_RowHighlight.user.js
> Tampermonkey sam wykryje skrypt. Kliknij `Install`, a potem odswiez Business Central.
> Kolejne aktualizacje beda pobierane z tego samego linku.

## Jak aktualizowac skrypt

Skrypt ma ustawione metadane:
- `@downloadURL`
- `@updateURL`
- `@version`

Dzieki temu Tampermonkey moze wykrywac nowe wersje.

Gdy opublikujesz zmiany:
1. podnies `@version` w pliku `.user.js`,
2. wypchnij zmiany do repo,
3. w Tampermonkey uruchom `Check for userscript updates` albo poczekaj na automatyczne sprawdzenie.

## Workflow dla edycji

Lokalny folder repo:
`tampermonkey-bc-n24`

Najprostszy workflow po zmianie skryptu w katalogu roboczym:

```powershell
Copy-Item '.\BC_N24_RowHighlight.user.js' '.\tampermonkey-bc-n24\BC_N24_RowHighlight.user.js' -Force
Push-Location '.\tampermonkey-bc-n24'
git add .
git commit -m "Update userscript"
git push
Pop-Location
```

## Udostepnianie zespolowi

- repo jest publiczne,
- link `raw.githubusercontent.com` dziala bez logowania,
- wszyscy powinni instalowac skrypt z jednego centralnego URL, a nie z lokalnego pliku.

## Changelog

### 1.1.0

- dodano `@description`,
- uporzadkowano instrukcje instalacji,
- przygotowano repo pod branch `main`,
- ujednolicono linki aktualizacji.

### 1.0.0

- pierwsza publikacja skryptu,
- kolorowanie wierszy i pol,
- obsluga brakow w polach `W_*`,
- pogrubienie wierszy `Suma` / `Total`.

## mBank — kolory i ikony transakcji

Dodatkowy skrypt `mBank_RowHighlight.user.js`, wersja **1.3.2**, działa na podstronach `https://online.mbank.pl/*`.

[Zainstaluj skrypt mBank](https://raw.githubusercontent.com/bsiuda/tampermonkey-bc-n24/main/mBank_RowHighlight.user.js)

Po wejściu do `/futurepaymentsnew` ustawia dzień daty końcowej filtra na **13**, zachowując miesiąc i rok odczytane z pola. Wykonuje jedną automatyczną zmianę na wejście, a następnie pozwala edytować datę ręcznie.

W tabelach rozpoznaje kolumny „Opis” i „Typ transakcji” po nagłówkach:

| Warunek | Kolor i ikona |
| --- | --- |
| Opis zawiera KCZ, IKZE, darowizna lub XTB | Zielony, wykres wzrostu |
| Opis zawiera Spłata pożyczki lub Santander Leasing | Czerwony, karta — raty / kredyty / leasing |
| Typ transakcji zawiera Subskrypcja | Pomarańczowy, cykliczne strzałki |
| Opis zawiera Tauron lub Spółka Wodociągowa | Niebieski, rachunek |

Dopasowanie pomija wielkość liter, polskie znaki i nadmiarowe odstępy. Przy zbiegu reguł obowiązuje kolejność: czerwony, niebieski, pomarańczowy, zielony. Ikony pokazują nazwę kategorii po najechaniu; oznaczenia są aktualizowane po zmianach zawartości listy.

### Instalacja i aktualizacje skryptu mBank

1. Otwórz powyższy link z włączonym Tampermonkey i zainstaluj skrypt.
2. Jeżeli korzystasz z wcześniejszej kopii wklejanej ręcznie, zastąp ją tą wersją i pozostaw włączoną jedną kopię.
3. Odśwież stronę mBanku.

Metadane `@downloadURL` i `@updateURL` wskazują plik w tym repozytorium. Przy kolejnych wydaniach zwiększ `@version`.

Skrypt nie zawiera przykładowych danych transakcji ani zewnętrznych bibliotek. Ikony SVG są zapisane w kodzie. Składnię i wygląd ikon sprawdzono lokalnie; nie zweryfikowano działania w zalogowanym mBanku ani list o innej strukturze HTML.
