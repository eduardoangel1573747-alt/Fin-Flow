# Documentación del Flujo de Trabajo (Fin Flow FPR)

Este directorio contiene la especificación formal y el modelo de flujo de trabajo interactivo para el sistema **Fin Flow FPR** (`Proyecto-Finanzas`).

## Archivos Generados

- [`workflow.json`](file:///C:/Users/ANGEL-IT/Desktop/HTML%20ETC/ProyeF/Proyecto-Finanzas/WorkFlow/workflow.json): Modelo intermedio JSON (IR) estructurado bajo el esquema de Archify v2.
- [`workflow.html`](file:///C:/Users/ANGEL-IT/Desktop/HTML%20ETC/ProyeF/Proyecto-Finanzas/workflow.html): Diagrama interactivo autocontenido con navegación, zoom/pan, buscador, tema oscuro/claro y trazabilidad de código fuente.

---

## Estructura del Flujo de Trabajo

### 1. Fases Operativas
1. **Acceso y Sesión (Cols 0-1)**: Autenticación segura mediante Firebase Auth (`pages/login.html` y `js/scriptL.js`), verificación de tokens y obtención del estado inicial desde Firestore (`doc users/{uid}/state`).
2. **Operaciones y Módulos (Cols 2-3)**: Visualización en el Dashboard (`index.html`), ajuste de preferencias (`js/settings-global.js`), captura en submódulos especializados (`GastosDiarios`, `CuentasCarteras`, `Objetivos`) y cálculo reactivo en memoria (`js/scrip.js`).
3. **Cierre y Auditoría (Cols 4-5)**: Consolidación y cierre de mes (`openCloseMonthModal`), persistencia asíncrona en la nube (`setDoc`), auditoría histórica en `Historial.html` y generación de reportes financieros.

### 2. Carriles (Lanes)
- **Interfaz de Usuario (Cliente Web)**: Vistas frontend donde el usuario interactúa.
- **Autenticación & Seguridad**: Puertas de control de acceso y verificación de credenciales.
- **Lógica de Negocio y Controladores**: Motor financiero, cálculos y operaciones de estado.
- **Persistencia y Servicios Firebase**: Firestore y almacenamiento cloud en tiempo real.
