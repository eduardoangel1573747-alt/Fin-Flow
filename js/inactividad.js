const TIEMPO_INACTIVIDAD_MS = 60 * 1000; // 60 segundos en total
const TIEMPO_AVISO_ANTES_MS = 15 * 1000; // Mostrar aviso 15 segundos antes (a los 45s)
const CLAVE_ULTIMA_ACTIVIDAD = "index_last_activity_timestamp";
const INTERVALO_THROTTLE_MS = 1000;

function iniciarControlInactividadConModal() {
  let ultimaEscrituraStorage = 0;
  let modalVisible = false;

  // --- 1. Creación del modal y estilos ---
  function asegurarModalEnDOM() {
    if (document.getElementById("modal-inactividad-overlay")) return;

    const estilo = document.createElement("style");
    estilo.id = "modal-inactividad-estilos";
    estilo.textContent = `
      #modal-inactividad-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        font-family: system-ui, -apple-system, sans-serif;
      }
      #modal-inactividad-overlay.activo {
        display: flex;
      }
      #modal-inactividad-caja {
        background: #ffffff;
        color: #1f2937;
        padding: 24px;
        border-radius: 10px;
        max-width: 380px;
        width: 90%;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
        text-align: center;
      }
      #modal-inactividad-caja h3 {
        margin: 0 0 10px;
        font-size: 1.15rem;
      }
      #modal-inactividad-caja p {
        margin: 0 0 20px;
        font-size: 0.95rem;
        line-height: 1.4;
      }
      .modal-inactividad-acciones {
        display: flex;
        gap: 10px;
        justify-content: center;
      }
      .modal-inactividad-acciones button {
        padding: 9px 16px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 600;
      }
      #btn-mantener-sesion {
        background: #2563eb;
        color: #ffffff;
      }
      #btn-cerrar-sesion-ahora {
        background: #e5e7eb;
        color: #1f2937;
      }
    `;

    const overlay = document.createElement("div");
    overlay.id = "modal-inactividad-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `
      <div id="modal-inactividad-caja">
        <h3>Tu sesión está por expirar</h3>
        <p>No hemos detectado actividad. Se cerrará la sesión en <strong id="segundos-restantes">15</strong> segundos.</p>
        <div class="modal-inactividad-acciones">
          <button type="button" id="btn-mantener-sesion">Mantener sesión</button>
          <button type="button" id="btn-cerrar-sesion-ahora">Cerrar sesión</button>
        </div>
      </div>
    `;

    document.head.appendChild(estilo);
    document.body.appendChild(overlay);

    document.getElementById("btn-mantener-sesion").addEventListener("click", () => {
      registrarActividad(true);
      ocultarModal();
    });

    document.getElementById("btn-cerrar-sesion-ahora").addEventListener("click", () => {
      ejecutarLogoutFinal();
    });
  }

  function mostrarModal(segundosRestantes) {
    asegurarModalEnDOM();
    const spanSegundos = document.getElementById("segundos-restantes");
    if (spanSegundos) {
      spanSegundos.textContent = String(Math.max(0, segundosRestantes));
    }
    const overlay = document.getElementById("modal-inactividad-overlay");
    if (overlay) {
      overlay.classList.add("activo");
      modalVisible = true;
    }
  }

  function ocultarModal() {
    const overlay = document.getElementById("modal-inactividad-overlay");
    if (overlay) {
      overlay.classList.remove("activo");
      modalVisible = false;
    }
  }

  // --- 2. Control de actividad y timestamp ---
  function registrarActividad(forzar = false) {
    const ahora = Date.now();
    if (!forzar && ahora - ultimaEscrituraStorage < INTERVALO_THROTTLE_MS) {
      return;
    }
    ultimaEscrituraStorage = ahora;
    sessionStorage.setItem(CLAVE_ULTIMA_ACTIVIDAD, ahora.toString());

    if (modalVisible) {
      ocultarModal();
    }
  }

  function ejecutarLogoutFinal() {
    ocultarModal();
    sessionStorage.removeItem(CLAVE_ULTIMA_ACTIVIDAD);
    clearInterval(intervaloRevision);
    removerListeners();

    if (typeof logout === "function") {
      logout();
    } else {
      console.warn("La función logout() no está definida en este contexto.");
    }
  }

  function verificarInactividad() {
    const guardado = sessionStorage.getItem(CLAVE_ULTIMA_ACTIVIDAD);
    if (!guardado) return;

    const ultimaActividad = Number(guardado);
    const transcurrido = Date.now() - ultimaActividad;
    const restanteMs = TIEMPO_INACTIVIDAD_MS - transcurrido;
    const umbralAvisoMs = TIEMPO_INACTIVIDAD_MS - TIEMPO_AVISO_ANTES_MS;

    if (transcurrido >= TIEMPO_INACTIVIDAD_MS) {
      ejecutarLogoutFinal();
    } else if (transcurrido >= umbralAvisoMs) {
      const segundosRestantes = Math.ceil(restanteMs / 1000);
      mostrarModal(segundosRestantes);
    } else if (modalVisible) {
      ocultarModal();
    }
  }

  const eventosActividad = ["mousemove", "keydown", "click", "scroll", "touchstart"];
  const manejarActividad = () => registrarActividad(false);

  function removerListeners() {
    eventosActividad.forEach((evento) => {
      window.removeEventListener(evento, manejarActividad);
    });
    document.removeEventListener("visibilitychange", manejarVisibilidad);
  }

  function manejarVisibilidad() {
    if (document.visibilityState === "visible") {
      verificarInactividad();
    }
  }

  asegurarModalEnDOM();
  registrarActividad(true);

  eventosActividad.forEach((evento) => {
    window.addEventListener(evento, manejarActividad, { passive: true });
  });

  const intervaloRevision = setInterval(verificarInactividad, 1000);
  document.addEventListener("visibilitychange", manejarVisibilidad);
}

document.addEventListener("DOMContentLoaded", iniciarControlInactividadConModal);