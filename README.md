# iRacing Team Race Dashboard

A static, single-page dashboard for tracking long iRacing team races. Manual lap entry, live timer, fastest-lap highlights, lap-time and position graphs, per-driver stats. State is saved to `localStorage` so a refresh or browser close doesn't lose anything.

## Run locally

No build step. Either:

- Open `index.html` directly in a browser, or
- Serve the folder (recommended for cleaner caching):
  ```
  python -m http.server 8000
  ```
  then visit `http://localhost:8000`.

## Deploy to GitHub Pages

Commit and push to `main`, then in the repo settings turn on Pages → Source: `main` / `(root)`. The site will be at `https://<user>.github.io/<repo>/`.

## Editing cars / tracks

Edit `js/data.js` — the `CARS` object is keyed by category, and `TRACKS` is a flat list. The dropdowns rebuild on next page load.
