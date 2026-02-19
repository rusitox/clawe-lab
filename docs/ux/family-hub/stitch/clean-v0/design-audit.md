# Design audit — Family Hub cards vs Stitch v0 (clean)

Fecha: 2026-02-19

## 1) Lo que ya está “OK” (cubierto por v0 actual)
- **Core navigation**: Semana / Mes / Día / Nuevo / Familia / Ajustes
- **Onboarding base**: crear familia + agregar miembros + permisos kids + invitar

## 2) Cards que implican **pantallas nuevas** (no cambios al v0 existente)
Estas cards no “corrigen” el diseño actual, sino que agregan flows/pantallas nuevas:

- `fh-family-settings-screen` — **Config. Familiar** (missing) → nueva pantalla + entrypoint desde Ajustes/Familia.
- `fh-onboarding-member-role` — rol padre/madre vs hijo/a → ajustar step "Add members" + potencial sub-step (edad/curso) + reglas mínimas.
- `fh-settings-integrations-placeholder` — Integraciones en Ajustes → agregar sección + placeholders disabled.
- `fh-notifications-preferences` — Preferencias de notificaciones → pantalla nueva (o subpantalla desde Ajustes).
- `fh-calendar-conflict-alerts` — Alertas de conflicto → mejorar UI en Día/Semana + estado en Create/Edit.
- `fh-ai-family-assistant` — UI de chat (FAB + screen) + permisos/ámbito.
- `fh-whatsapp-ai-ingest` / `fh-onboarding-whatsapp-bot-invite` — flow de conexión/invite del bot a grupo.
- `fh-auth-login-signup-screens` / `fh-user-profile-phone` / `fh-auth-whatsapp-option` — auth + phone mapping.

## 3) Cambios sugeridos al diseño actual (si querés iterar)
No son obligatorios; son ajustes de consistencia/UX:

- **Ajustes**: agregar IA (FAB) como sección/toggle futuro (aunque el feature sea v1) para reforzar el modelo mental.
- **Familia**: agregar CTA claro a “Config. Familiar” cuando exista.
- **Nuevo**: cuando definamos integraciones/ingest, sumar “Importar desde…” como opción disabled (próximamente).

## 4) Próximo paso recomendado
Implementar en Stitch en este orden (rápido a impacto):
1) **Config. Familiar (missing)**
2) **Integraciones en Ajustes (placeholders)**
3) **Rol miembro (padre/madre vs hijo/a)**

Luego: notificaciones + conflictos + IA + WhatsApp + auth.
