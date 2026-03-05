# PR Notes — Family Hub Expo Happy Path

## Goal
Bring RN prototype closer to Stitch (clean-v0) + provide an APK demo with end-to-end mock flow.

## What’s included
- EAS Build config (preview → APK) + android package `com.clawe.familyhub`
- Mock login: **Continuar con Google** jumps to `MainTabs`
- CreateNewItem (“Nuevo”) parity tweaks (spacing/typography)
- End-to-end demo: from **Nuevo** create a demo item and show it in **Calendario** (Día/Mes)
- TypeScript cleanup (linking typing + legacy screens + DayTimeline supports Actividad)
- Smoke-test doc: `DEMO_SMOKETEST.md`

## Demo APK
- Latest clean APK: https://expo.dev/artifacts/eas/azfxdnKgiQ98G3JM3AmSW1.apk

## How to test
See: `projects/familyhub-expo/DEMO_SMOKETEST.md`

## PR link (create)
https://github.com/rusitox/clawe-lab/compare/main...feat/familyhub-expo-happypath?expand=1
