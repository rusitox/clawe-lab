# Playbook — Stitch → React Native (Expo) parity (UX/UI + behavior)

Este documento captura el **proceso reusable** para clonar un set de pantallas generadas en **Google Stitch** hacia un prototipo **React Native (Expo)**, manteniendo:
- Paridad visual (tokens, spacing, tipografía, componentes)
- Paridad de comportamiento (navegación, CTAs, estados mock)
- Soporte de **assets/ilustraciones** (SVG / raster)

---

## 0) Principios

### Source of truth
- Stitch es la **fuente de verdad** para UX/UI **y** comportamiento (no solo “look”).

### Canon de evaluación
- Elegir un “canon” de plataforma:
  - Recomendado: **Android** si el dispositivo de test es Android.
  - Expo Web se usa como demo rápida (no canon).

### Definition of Done por pantalla
Una pantalla está “DONE” cuando:
- Layout/tipografía/spacing/radius/sombras coinciden con Stitch
- Componentes clave se reutilizan (evitar copypaste)
- CTAs navegan a destino correcto
- Estados mínimos mock (empty/selected/loading) están presentes

---

## 1) Inventario de pantallas

1) Exportar `list_screens` del proyecto Stitch.
2) Mantener una **matriz de paridad** en markdown:
   - Columns: Stitch title, screenId, screenshot, RN file, status (MISSING/PARTIAL/DONE)

---

## 2) Inventario de assets (ilustraciones)

### Por qué es crítico
Stitch puede representar “ilustraciones” de varias maneras:
- SVG inline (`<svg>...</svg>`)
- imágenes raster (`<img src=...>`)
- `background-image: url(...)`

### Pipeline recomendado
Para cada screen:
1) Descargar HTML export (`htmlCode.downloadUrl`)
2) Detectar:
   - `inline_svg_count` (# de `<svg>`)
   - `img_src[]` (src de `<img>`)
   - `bg_urls[]` (background-image)
3) Generar inventario JSON + resumen.

---

## 3) Estrategia SVG en RN (Expo)

### Regla práctica
- **SVG cuando Stitch lo provee como SVG**.
- Si Stitch trae raster (img/bg), mantener raster salvo que sea simple convertir.

### Implementación (sin transformer)
- Usar `react-native-svg` + `SvgXml` para SVG como string:
  - Helper sugerido: `src/components/SvgXmlAsset.tsx`

---

## 4) Navegación/Comportamiento

### Mantener flows
- Si Stitch define un patrón (ej: “Nuevo” es una **pantalla dedicada**), replicarlo.
- Para prototipos: los CTAs pueden disparar “flow mock” (alert/navigate) pero debe haber navegación consistente.

---

## 5) Preview navegable (Expo Web)

### Export
```bash
npx expo export --platform web
```

### Servir estático
```bash
python3 -m http.server 8790 --directory dist
```

### Estabilidad
- Usar un script tipo `scripts/start_web_preview.sh` que mate el puerto y relance el server.
- Usar `?v=` en la URL para cache-bust.

---

## 6) Build APK (cuando toque)

### Recomendación
- Usar **EAS Build cloud** si no hay Android SDK/Java local.
- Guardar EXPO_TOKEN en un secreto del server, no en chat.

---

## 7) Checklist de ejecución (resumen)
- [ ] Definir canon (Android vs iOS)
- [ ] Matriz Stitch→RN creada
- [ ] Inventario de assets completado
- [ ] Instalar `react-native-svg`
- [ ] Core tour a paridad
- [ ] Extras a paridad
- [ ] Export web estable
- [ ] APK via EAS
- [ ] **Higiene Git:** commits/push incremental para no perder cambios + PR por hitos
