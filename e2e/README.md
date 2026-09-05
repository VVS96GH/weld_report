# E2E tests (Playwright)

Layout/navigation matrix for the welding report dashboard across 5 viewports
(`mobile-360`, `mobile-375`, `tablet-768`, `desktop-1280`, `wide-1536`).

## Running against a dev server (default)

Start `next dev` yourself, then:

```
npm run test:e2e
```

`E2E_BASE_URL` defaults to `http://localhost:3000`; override it if the server
runs elsewhere.

## Running against a built app

To have Playwright build and launch the app itself (e.g. in CI, or whenever
nothing is already listening on the target port):

```
E2E_START_SERVER=1 npm run test:e2e
```

This runs `npm run start -- -p 3000` and reuses an already-running server if
one is found at the URL.

## Browser install path

If Chromium isn't installed at Playwright's default cache location, point
`PLAYWRIGHT_BROWSERS_PATH` at wherever `npx playwright install chromium` put
it before running tests. Unset (or unneeded) when the default location has it.

## Adding a page to the layout matrix

Edit the `PAGES` array in `e2e/layout.spec.ts` (valid range: 1-44, per
`lib/welding-pages.ts`).
