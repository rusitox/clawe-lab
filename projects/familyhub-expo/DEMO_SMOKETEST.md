# Family Hub — Demo smoke test (APK)

## Latest APK (EAS preview)
- APK (clean): https://expo.dev/artifacts/eas/azfxdnKgiQ98G3JM3AmSW1.apk
- Build logs: https://expo.dev/accounts/clawe/projects/familyhub-expo/builds/4d86c076-a1f9-47b7-8486-bcf302b43004

## What to test (end-to-end)
1) Install APK
2) Open app → **Login**
3) Tap **“Continuar con Google”** (mock) → should enter the app (MainTabs)
4) Tap **“+”** → screen **Nuevo**
5) Choose **Evento / Tarea / Actividad**
6) App navigates to **Calendario** and the new **demo item** should appear for *today*:
   - in **Día** timeline (Mi Día)
   - and as dots in **Mes** (same day)

## Expected behavior
- No crashes
- Navigation is smooth
- Item appears once (no duplication)

## If something looks off
Send:
- which step
- screenshot
- device model + Android version
