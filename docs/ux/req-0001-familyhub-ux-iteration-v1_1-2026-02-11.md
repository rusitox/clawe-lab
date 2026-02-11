# REQ-0001 — Family Hub — UX/UI iteration v1.1 (2026-02-11)

Este documento captura decisiones y propuestas para la siguiente iteración UX/UI, incluyendo el feature del **Agente IA conversacional**.

## Decisiones (confirmadas por Rusitox)

1) **Agente IA**: acceso vía **botón flotante (FAB)** que abre una experiencia conversacional (chat).
2) **Disponibilidad de padres/tutores**: regla **implícita** — si no tienen eventos cargados en una franja horaria, se consideran **disponibles**.

Implicación: el valor del producto depende de tener el calendario “completo” (o suficientemente completo). Hay que diseñar mecanismos que faciliten **carga dinámica** de eventos/actividades.

---

## Objetivos de la iteración v1.1

- Completar huecos de UX (pantallas faltantes) y mejorar onboarding.
- Diseñar la primera versión del Agente IA como acelerador de uso y carga de datos.
- Definir “conflictos” de calendario en términos de **capacidad vs demanda** (padres/tutores disponibles vs actividades simultáneas).

---

## 1) Settings / Configuración

### 1.1 Pantalla "Configuración familiar" (missing)
Propuesta de secciones:
- Datos de familia (nombre, domicilio base)
- Miembros
  - rol (padre/madre/tutor vs hijo/a)
  - relación (opcional)
- Permisos (quién puede crear/editar/borrar)
- Onboarding (replay / estado)
- Integraciones (placeholder "próximamente")

### 1.2 Integraciones (placeholder)
Mostrar en Ajustes una sección “Integraciones” con cards grisadas:
- Google Calendar (próximamente)
- iCloud Calendar (próximamente)
- WhatsApp (próximamente)
- Email (próximamente)

---

## 2) Onboarding

### 2.1 Miembros: rol padre/madre/tutor vs hijo/a
Campos mínimos en v1.1:
- Nombre
- Rol: Padre/Madre/Tutor | Hijo/a
- (Opcional) Escuela/curso para hijos

Esto habilita:
- Notificaciones por persona
- Conflictos por disponibilidad
- Respuestas del Agente IA contextualizadas

---

## 3) Notificaciones

Preferencias recomendadas:
- Por tipo: eventos, tareas, recordatorios, cambios
- Por persona: para qué miembros se notifican
- Quiet hours (opcional)

---

## 4) Conflictos de calendario (capacidad vs demanda)

### 4.1 Modelo mental
- **Demanda**: actividades simultáneas que requieren acompañamiento/logística.
- **Capacidad**: cantidad de padres/tutores “disponibles” en esa franja.

Regla base (v1):
- Conflicto si: `demanda > capacidad`

Decisión v1: `demanda` se computa con un flag manual por actividad de hijo/a: `Requiere adulto` (`requiresAdult`).
- UI: checkbox en crear/editar.
- IA/chat: debe preguntar explícitamente “¿requiere adulto?” antes de guardar.

Donde:
- `capacidad` = #padres/tutores sin eventos en esa franja (disponibilidad implícita)
- `demanda` = #hijos con actividades simultáneas que requieren acompañamiento (definir flag “requiere adulto”)

### 4.2 UX del conflicto
- Badge/alert en Semana y Día cuando hay conflicto
- Warning al crear/editar actividad si genera conflicto
- Vista detalle del conflicto: “Faltan 1 adultos disponibles” + sugerencias

---

## 5) Agente IA conversacional (v1)

### 5.1 Acceso
- FAB persistente → abre “Chat con Family Hub”.

### 5.2 Casos de uso v1 (alto impacto)
1) **Carga de eventos por chat** (creación rápida)
   - Ej: “Agendá natación de Tomás martes y jueves 18:00 en el club”
   - El agente propone un draft → UI de confirmación → se guarda.

2) **Consultas**
   - “¿Qué tenemos mañana?”
   - “¿Quién puede llevar a Juana a inglés el viernes?”

3) **Detección de conflictos**
   - “¿Hay choques esta semana?”

### 5.3 Diseño de interacción (seguridad / confianza)
- El agente **no crea nada sin confirmación**.
- Siempre muestra “resumen de lo que va a guardar” (quién, qué, cuándo, dónde).

### 5.4 Contexto familiar (datos necesarios)
Mínimo para que el agente sea útil:
- miembros + roles
- escuelas/trabajos + direcciones
- rutinas habituales
- permisos

---

## Tracking

Relacionado a tareas Kanban:
- `fh-family-settings-screen`
- `fh-onboarding-member-role`
- `fh-notifications-preferences`
- `fh-settings-integrations-placeholder`
- `fh-calendar-conflict-alerts`
- `fh-ai-family-assistant` (P1)
