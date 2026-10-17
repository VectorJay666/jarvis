# Changelog

## Unreleased

- feat(app): dim the seasonal photo when `/v1/home` theme is evening or late. A scrim over `SeasonBackground` stays clear for light (morning/afternoon and a missing theme), covers the photo with about `rgba(0,0,0,0.45)` for dim, and about 70% black for dark. Opacity eases over 400ms when the period changes so bright artwork does not clash with dark chrome. Secondary labels drawn on the photo use the theme text color in dim and dark so they stay readable; light mode keeps the muted gray.
- feat(app): apply `/v1/home` theme tokens on the home screen. System chrome (screen background, glass sheet, input, cards, tab labels) follows `theme` from the Backend contract (`themeForPeriod`: morning/afternoon light, evening dim, late dark). Season artwork stays a user-chosen overlay. A missing theme falls back to the afternoon light preset and does not invent a period from the client clock when the server sent `theme` or `greet.period`. Verify with `curl -s localhost:9301/v1/home?hour=8`, `14`, `19`, and `23`, then open the web home with the same `?hour=` values and confirm greeting text and chrome background follow the payload.
