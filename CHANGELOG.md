# Changelog

## Unreleased

- feat(app): apply `/v1/home` theme tokens on the home screen. System chrome (screen background, glass sheet, input, cards, tab labels) follows `theme` from the Backend contract (`themeForPeriod`: morning/afternoon light, evening dim, late dark). Season artwork stays a user-chosen overlay. A missing theme falls back to the afternoon light preset and does not invent a period from the client clock when the server sent `theme` or `greet.period`. Verify with `curl -s localhost:9301/v1/home?hour=8`, `14`, `19`, and `23`, then open the web home with the same `?hour=` values and confirm greeting text and chrome background follow the payload.
