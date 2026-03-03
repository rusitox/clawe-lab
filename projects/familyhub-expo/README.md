# Family Hub (Expo prototype)

This is a **code prototype** for the Family Hub app.

## Requirements (Mac)

- Node.js (>= 18)
- Xcode (for iOS simulator)
- `npm` (comes with Node)

## Run

```bash
cd projects/familyhub-expo
npm install
npx expo start
```

Then:
- Press `i` to open iOS simulator.
- Or scan the QR with **Expo Go** on your phone.

## Happy path navigation

- Welcome → Onboarding → MainTabs (Semana/Mes/Día)

## Stitch parity reference (Semana)

Stitch export screenshot (source of truth):
- `docs/ux/family-hub/stitch/clean-v0/app-first/01-semana.png`
- Convenience copy (extracted from JSON): `docs/ux/family-hub/stitch/clean-v0/app-first/01-semana.extracted.png`

How to validate:
1) Run the app (`npx expo start`) and open the **Semana** tab
2) Compare side-by-side against the Stitch screenshot
3) Reply with **OK/NO** and what looks off (spacing/typography/cards/shadows)

## Deep link demo

This prototype routes:

- `familyhub://invite/<code>`
- `https://familyhub.app/invite/<code>` (handled by linking config inside the app)

Example:

- `https://familyhub.app/invite/ABC123`

Note: for **real universal links** on iOS, we will need the Apple `apple-app-site-association` file + associated domains setup.
