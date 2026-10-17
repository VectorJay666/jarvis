# Changelog

## Unreleased

- fix(scripts): save `*.ps1` as UTF-8 with BOM so Windows PowerShell 5.1 does not read Chinese strings as GBK. `.gitattributes` uses `*.ps1 text eol=crlf` and does not re-encode the files (no `working-tree-encoding`).
- fix(app): commit `app/package-lock.json` so `npm ci` works. It is generated with `npm install` from the Expo SDK ranges already in `app/package.json` (no version bumps) and is not gitignored. `scripts/start-local.ps1` says to run `npm ci` when that lockfile exists, and `npm install` when it does not.
- feat(app): evening and late home backgrounds use dedicated plates instead of a black scrim. Dim crossfades to `jarvis-bg-dusk.png`, dark to `jarvis-bg-late.png` (artwork by Crea&Cons), and light keeps the seasonal photo. The fade is about 400ms. A missing theme stays on the light seasonal photo.
- feat(app): apply `/v1/home` theme tokens on the home screen. System chrome (screen background, glass sheet, input, cards, tab labels) follows `theme` from the Backend contract (`themeForPeriod`: morning/afternoon light, evening dim, late dark). Season artwork stays a user-chosen overlay. A missing theme falls back to the afternoon light preset and does not invent a period from the client clock when the server sent `theme` or `greet.period`. Verify with `curl -s localhost:9301/v1/home?hour=8`, `14`, `19`, and `23`, then open the web home with the same `?hour=` values and confirm greeting text and chrome background follow the payload.
