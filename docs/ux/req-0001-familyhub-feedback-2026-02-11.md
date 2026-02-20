# REQ-0001 — Family Hub — Feedback + nuevos requerimientos (2026-02-11)

Fuente: feedback de Rusitox en Telegram (2026-02-11).

## Cambios / mejoras sugeridas

### 1) Onboarding — miembros: distinguir padre/madre vs hijo/a
- En el paso de agregar miembros, permitir identificar **rol**: padre/madre/tutor vs hijo/a.
- (Opcional a definir) Atributos: edad, curso/grado, escuela.
- Impacta: permisos, notificaciones, vistas.

### 2) Falta pantalla: Configuración familiar
- Actualmente “Configuración familiar” no tiene pantalla.
- Agregar pantalla y definir secciones (miembros/permisos/datos de familia/etc.).

### 3) Ajustes — Integraciones (placeholder)
- Agregar sección “Integraciones” y mostrar opciones futuras **grisadas/disabled** con etiqueta “Próximamente”.
- Definir integraciones target (ej: Google Calendar, WhatsApp, etc.).

### 4) Notificaciones — preferencias por tipo y por persona
- Permitir configurar:
  - tipos de notificación (eventos, tareas, recordatorios, cambios, etc.)
  - por qué miembro/persona aplican
- (A definir) quiet hours, canales, global vs por-miembro.

## Nuevo feature v1: Agente IA conversacional (entra en la primera versión)

- Feature: un **agente conversacional** que responda sobre toda la actividad de la familia.
- Requiere modelar **contexto familiar**:
  - escuela(s)
  - trabajos
  - direcciones (escuela/trabajo/casa)
  - horarios habituales
  - roles y permisos
- Considerar desde el inicio: privacidad/permisos, fuente de verdad (calendario/eventos), y límites del alcance v1.

## Conflictos de calendario — regla de disponibilidad de padres/tutores

No es solo “overlap de eventos”: el conflicto se define por **capacidad** (padres/tutores disponibles) vs **demanda** (actividades simultáneas de hijos).

Ejemplos:
- 2 actividades simultáneas con **1 padre disponible** → conflicto
- 3 hijos con actividades simultáneas con **2 padres disponibles** → conflicto

Pendiente: definir formalmente el modelo de “disponibilidad” (por franja horaria + constraints) y cómo se captura en UI.

## Tracking

Estos puntos están reflejados en el Kanban (Backlog) como tareas separadas:
- `fh-onboarding-member-role`
- `fh-family-settings-screen`
- `fh-settings-integrations-placeholder`
- `fh-notifications-preferences`
- `fh-ai-family-assistant` (P1)
- `fh-calendar-conflict-alerts`
