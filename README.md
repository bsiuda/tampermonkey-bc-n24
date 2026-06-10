# BC N24 Tampermonkey Script

Userscript do Business Central, rozwijany pod Tampermonkey.

## Repo

- Repozytorium: https://github.com/bsiuda/tampermonkey-bc-n24
- Plik instalacyjny: https://raw.githubusercontent.com/bsiuda/tampermonkey-bc-n24/master/BC_N24_RowHighlight.user.js

## Co robi skrypt

Skrypt dodaje pomocnicze oznaczenia w interfejsie Business Central:
- podmienia wybrane etykiety pol,
- koloruje wybrane pola w naglowku,
- koloruje wiersze siatki wedlug warunkow,
- oznacza wiersze z brakami w wymaganych polach W_*,
- pogrubia wiersze typu Suma / Total.

## Instalacja

1. Zainstaluj rozszerzenie Tampermonkey w przegladarce.
2. Otworz link do pliku `.user.js`:
   https://raw.githubusercontent.com/bsiuda/tampermonkey-bc-n24/master/BC_N24_RowHighlight.user.js
3. Tampermonkey wykryje userscript i otworzy ekran instalacji.
4. Kliknij `Install`.
5. Odswiez Business Central.

## Aktualizacje

Skrypt ma ustawione:
- `@downloadURL`
- `@updateURL`

Dzieki temu Tampermonkey moze pobierac nowe wersje z repozytorium.

Przy zmianach w skrypcie warto:
1. zmienic `@version` w naglowku skryptu,
2. zacommitowac i wypchnac zmiany do repo,
3. odczekac chwile lub wymusic update w Tampermonkey.

## Edycja i publikacja

Lokalny folder repo:
`tampermonkey-bc-n24`

Podstawowy workflow:

```powershell
after editing the script:
Copy-Item '.\BC_N24_RowHighlight.user.js' '.\tampermonkey-bc-n24\BC_N24_RowHighlight.user.js' -Force
Push-Location '.\tampermonkey-bc-n24'
git add .
git commit -m "Update userscript"
git push
Pop-Location
```

## Wazne uwagi

- Po zmianie logiki dobrze podniesc `@version`.
- Jesli kilka osob ma korzystac ze skryptu, wszyscy powinni instalowac go z linku `raw.githubusercontent.com`, a nie z lokalnego pliku.
- Repo jest publiczne, wiec link instalacyjny dziala bez logowania do GitHub.
