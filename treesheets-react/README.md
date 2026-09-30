# TreeSheets Web (React + TypeScript)

A React/TypeScript port of the single-file TreeSheets web clone. Same features, same look —
now as a proper Vite + React + TypeScript project you can push to GitHub and deploy on Vercel.

## What changed vs. the original HTML file

Functionally this is a 1:1 port — same data model, same keyboard shortcuts, same drag &
drop, same undo/redo, same import/export. The differences are purely structural:

- All the imperative DOM-building code (`renderGridNode`, `render()`, etc.) became React
  components (`GridNode`, `Cell`, `HelpPanel`, `Toolbar`, `Footer`).
- All the global `let` variables became a single `TreeSheetStore` class
  (`src/store.ts`) that components subscribe to with `useSyncExternalStore`, so it still
  behaves like the original's "mutate state, then re-render" model.
- Tailwind is now compiled from `src/index.css` via PostCSS instead of the Tailwind CDN
  script, and icons come from the `lucide-react` package instead of the `lucide` CDN.
- The last two things you asked for on the HTML version are included: double-click to edit
  a cell, the Esc-leaves-a-cell reminder in the help panel, and padding that can shrink to 0
  with the grid gap/border tied to the same slider so cell text can actually touch.

One quirk carried over unchanged from the original: clicking anywhere inside a cell
(including inside its own textarea while you're editing it) immediately exits edit mode,
because the "select cell" handler fires on every mousedown. You can still type and use
arrow keys / Enter / Escape freely — you just can't click to reposition the cursor inside
the textarea. Say the word if you'd like that fixed.

## Project structure

```
src/
  types.ts              data model (CellData, GridData, ...)
  treeUtils.ts           pure path-based tree helpers (getCellByPath, updateCellByPath, ...)
  store.ts                TreeSheetStore: all state + actions (the "brain" of the app)
  StoreContext.tsx        React context + useStore() hook
  App.tsx                 layout shell, global keydown wiring, theme
  components/
    GridNode.tsx          recursive grid + cell renderer, editing, drag & drop
    HelpPanel.tsx          right-hand commands panel
    Toolbar.tsx             floating draggable toolbar
    Footer.tsx               bottom status bar
  index.css                Tailwind + the original's custom CSS variables/rules
```

## Run locally

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

To produce a production build locally:

```bash
npm run build
npm run preview
```

To create a self-contained HTML file with the JavaScript and CSS embedded:

```bash
npm run build:single
```

This writes `dist/treesheets-standalone.html`.

The production build runs `tsc -b` followed by `vite build`; it completed successfully
in this workspace.

## Push to GitHub

```bash
git init
git add .
git commit -m "TreeSheets web app (React + TS)"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## Deploy on Vercel

1. Go to https://vercel.com/new and import the GitHub repo you just pushed.
2. Vercel auto-detects the "Vite" framework preset — the defaults it fills in are correct:
   - Build Command: `npm run build` (or `vite build`)
   - Output Directory: `dist`
   - Install Command: `npm install`
3. Click **Deploy**. That's it — no environment variables or extra config needed.

Alternatively, from the CLI:

```bash
npm i -g vercel
vercel
```
