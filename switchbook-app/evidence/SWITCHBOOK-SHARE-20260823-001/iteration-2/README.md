# Iteration 2 visual evidence

These artifacts were captured from the deterministic `/share/visual-qa` fixture with
`SWITCHBOOK_VISUAL_QA=1`. Without that server-side environment flag, the route returns
404. The fixture uses no database and calls no production API.

Desktop screenshots use a 1440×1000 viewport. Mobile screenshots use a 390×844
viewport. Each is a full-page Chromium capture.

`broken-primary-valid-secondary-desktop.png` was captured only after Chromium found
`img[src^="data:image/svg"]`. Its first candidate is the intentionally missing
`/visual-qa-intentionally-missing.png`; the visible SVG therefore proves automatic
client-side advancement to the valid secondary candidate. The red and blue carousel
dots show the failed primary and active secondary, respectively.

`SHA256SUMS.txt` records checksums for all nine PNG artifacts.
