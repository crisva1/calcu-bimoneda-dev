/* ═══════════════════════════════════════════════════════
   CALCU BIMONEDA — app.js
   Lógica principal. Separada en módulos funcionales.
   NO se modifica ninguna fórmula financiera.

   Módulos:
   1. Config & constantes
   2. Sistema de licencias (Proyecto Cristal)
   3. Instalación PWA
   4. Onboarding inicial de tasas
   5. Selector de modo de cobro
   6. Calculadora bimoneda (lógica original intacta)
   7. Arranque
   ═══════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════
   1. CONFIG & CONSTANTES
   ════════════════════════════════════════════════════════ */

const CONFIG = {
  SAL:             "aleiluisolcris*1",
  DEFAULT_BCV:     48.00,
  DEFAULT_MERCADO: 60.00,
  DEFAULT_EUR_BCV: 52.00,
  WS_NUMBER:       "584129050524",
  STORAGE: {
    LICENCIA:    '_prm',
    DEVICE_ID:   '_cid',
    BCV:         'calcu_bcv',
    MERCADO:     'calcu_binance',   // Mantenemos la misma clave de storage para compatibilidad
    EUR_BCV:     'calcu_eur_bcv',
    MODO:        'calcu_modo',
    ONBOARDING:  'calcu_onboarding_done',
  }
};

/* ════════════════════════════════════════════════════════
   2. SISTEMA DE LICENCIAS — Proyecto Cristal
   ════════════════════════════════════════════════════════ */

const Licencia = {

  /* Genera o recupera el ID único del dispositivo */
  getID() {
    try {
      let id = localStorage.getItem(CONFIG.STORAGE.DEVICE_ID);
      if (id) return id;

      const seed = [
        navigator.userAgent || '',
        screen.width + 'x' + screen.height,
        navigator.language || '',
        (navigator.hardwareConcurrency || 0).toString(),
        new Date().getTimezoneOffset().toString()
      ].join('|');

      // DJB2 hash de 32-bit (unsigned, consistente cross-platform)
      let h = 5381;
      for (let i = 0; i < seed.length; i++) {
        h = (((h << 5) >>> 0) + h + seed.charCodeAt(i)) >>> 0;
      }

      id = "VZ-" + h.toString(16).toUpperCase().padStart(8, '0');
      localStorage.setItem(CONFIG.STORAGE.DEVICE_ID, id);
      return id;
    } catch (e) {
      return "VZ-NOLOC";
    }
  },

  /* Genera la clave esperada para un ID dado */
  genClave(id) {
    const base = id + CONFIG.SAL;
    let h = 5381;
    for (let i = 0; i < base.length; i++) {
      h = (((h << 5) >>> 0) + h + base.charCodeAt(i)) >>> 0;
    }
    return "KEY-" + h.toString(36).toUpperCase().padStart(7, '0');
  },

  /* Verifica si la licencia está activa */
  estaActiva() {
    try {
      return localStorage.getItem(CONFIG.STORAGE.LICENCIA) === 'true';
    } catch (e) {
      return false;
    }
  },

  /* Muestra el muro de activación */
  mostrarMuro() {
    const idEl = document.getElementById('mi-id-display');
    if (idEl) idEl.textContent = this.getID();
  },

  /* Solicitar acceso vía WhatsApp */
  pedirAcceso() {
    const n = (document.getElementById('reg-nom').value || '').trim();
    const c = (document.getElementById('reg-ci').value  || '').trim();

    if (!n || !c) {
      this.mostrarError("Completa tu nombre y cédula primero.");
      return;
    }

    const texto = `SOLICITUD ACTIVACION\nNombre: ${n}\nCI: ${c}\nID: ${this.getID()}`;
    window.open(`https://wa.me/${CONFIG.WS_NUMBER}?text=${encodeURIComponent(texto)}`, '_blank');
  },

  /* Validar e ingresar clave de activación */
  activar() {
    const entrada = (document.getElementById('clave-in').value || '').trim().toUpperCase();

    if (!entrada) {
      this.mostrarError("Ingresa la clave de activación.");
      return;
    }

    const claveEsperada = this.genClave(this.getID());

    if (entrada === claveEsperada) {
      try {
        localStorage.setItem(CONFIG.STORAGE.LICENCIA, 'true');
      } catch (e) { /* ignorar */ }
      App.mostrar();
    } else {
      this.mostrarError("Clave inválida. Verifica e intenta de nuevo.");
      document.getElementById('clave-in').value = '';
    }
  },

  /* Muestra error en el muro */
  mostrarError(txt) {
    const el = document.getElementById('msg-error');
    if (!el) return;
    el.textContent = txt;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.textContent = ''; }, 4000);
  }
};

/* ════════════════════════════════════════════════════════
   3. INSTALACIÓN PWA
   ════════════════════════════════════════════════════════ */

const InstallPWA = {
  _prompt: null,

  init() {
    // Android: captura el evento antes de que Chrome lo muestre
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this._prompt = e;
      const btn = document.getElementById('btn-instalar');
      if (btn) btn.style.display = 'block';
    });

    // Si ya está instalada, oculta el botón
    window.addEventListener('appinstalled', () => {
      const btn = document.getElementById('btn-instalar');
      if (btn) btn.style.display = 'none';
    });

    // iOS: siempre muestra el botón si no está en modo standalone
    const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const yaInstalada = window.navigator.standalone === true;
    if (esIOS && !yaInstalada) {
      const btn = document.getElementById('btn-instalar');
      if (btn) {
        btn.style.display = 'block';
        btn.textContent = '📲 Cómo instalar en iPhone';
      }
    }
  },

  accion() {
    const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (esIOS) {
      document.getElementById('modal-ios').classList.add('activo');
    } else if (this._prompt) {
      this._prompt.prompt();
      this._prompt.userChoice.then((r) => {
        if (r.outcome === 'accepted') {
          const btn = document.getElementById('btn-instalar');
          if (btn) btn.style.display = 'none';
        }
        this._prompt = null;
      });
    }
  },

  cerrarModalIos() {
    document.getElementById('modal-ios').classList.remove('activo');
  }
};

/* ════════════════════════════════════════════════════════
   4. ONBOARDING — Configuración inicial de tasas
   ════════════════════════════════════════════════════════ */

const Onboarding = {

  estaCompleto() {
    try {
      return localStorage.getItem(CONFIG.STORAGE.ONBOARDING) === 'done';
    } catch (e) {
      return false;
    }
  },

  mostrar() {
    const screen = document.getElementById('screen-onboarding');
    if (!screen) return;

    // Prefill con valores guardados o defaults
    const bcv     = localStorage.getItem(CONFIG.STORAGE.BCV)     || CONFIG.DEFAULT_BCV;
    const mercado = localStorage.getItem(CONFIG.STORAGE.MERCADO)  || CONFIG.DEFAULT_MERCADO;
    const eur     = localStorage.getItem(CONFIG.STORAGE.EUR_BCV)  || CONFIG.DEFAULT_EUR_BCV;

    document.getElementById('ob-bcv').value     = bcv;
    document.getElementById('ob-mercado').value = mercado;
    document.getElementById('ob-eur').value     = eur;

    screen.classList.add('visible');
  },

  confirmar() {
    const bcv     = parseFloat(document.getElementById('ob-bcv').value)     || CONFIG.DEFAULT_BCV;
    const mercado = parseFloat(document.getElementById('ob-mercado').value)  || CONFIG.DEFAULT_MERCADO;
    const eur     = parseFloat(document.getElementById('ob-eur').value)      || CONFIG.DEFAULT_EUR_BCV;

    // Validación básica
    if (bcv <= 0 || mercado <= 0) {
      alert("Ingresa las tasas del día para continuar.");
      return;
    }

    // Guardar en localStorage
    try {
      localStorage.setItem(CONFIG.STORAGE.BCV,      bcv.toString());
      localStorage.setItem(CONFIG.STORAGE.MERCADO,   mercado.toString());
      localStorage.setItem(CONFIG.STORAGE.EUR_BCV,   eur.toString());
      localStorage.setItem(CONFIG.STORAGE.ONBOARDING, 'done');
    } catch (e) { /* ignorar */ }

    // Cerrar onboarding y cargar app
    const screen = document.getElementById('screen-onboarding');
    if (screen) screen.classList.remove('visible');

    Calculadora.cargarTasas();
    Calculadora.calc();
    ModoSelector.actualizar();
  },

  /* Botón "Actualizar tasas" en la app principal */
  editar() {
    this.mostrar();
  }
};

/* ════════════════════════════════════════════════════════
   5. SELECTOR DE MODO DE COBRO
   ════════════════════════════════════════════════════════ */

const ModoSelector = {
  modoActual: 'protected', // 'protected' | 'bcv'

  init() {
    // Cargar modo guardado
    try {
      const saved = localStorage.getItem(CONFIG.STORAGE.MODO);
      if (saved) this.modoActual = saved;
    } catch (e) { /* usar default */ }

    this.actualizar();
  },

  setModo(modo) {
    this.modoActual = modo;
    try {
      localStorage.setItem(CONFIG.STORAGE.MODO, modo);
    } catch (e) { /* ignorar */ }
    this.actualizar();
    Calculadora.calc();
  },

  actualizar() {
    const btnProtected = document.getElementById('btn-modo-protected');
    const btnBCV       = document.getElementById('btn-modo-bcv');
    const modePill     = document.getElementById('mode-pill');
    const modeInfo     = document.getElementById('mode-info');

    if (btnProtected && btnBCV) {
      // Resetear
      btnProtected.className = 'mode-btn';
      btnBCV.className       = 'mode-btn';

      if (this.modoActual === 'protected') {
        btnProtected.classList.add('active-protected');
        if (modePill) {
          modePill.className = 'mode-pill protected';
          modePill.innerHTML = '<span class="mode-pill-dot"></span>PROTEGIDO';
        }
        if (modeInfo) {
          modeInfo.innerHTML = '<span>Cobro protegido:</span> usa USD Mercado para proteger tu margen contra la brecha cambiaria.';
          modeInfo.classList.add('visible');
        }
      } else {
        btnBCV.classList.add('active-bcv');
        if (modePill) {
          modePill.className = 'mode-pill bcv';
          modePill.innerHTML = '<span class="mode-pill-dot"></span>TASA BCV';
        }
        if (modeInfo) {
          modeInfo.innerHTML = '<span>Cobro BCV:</span> calcula usando únicamente la tasa oficial BCV.';
          modeInfo.classList.add('visible');
        }
      }
    }
  },

  /* Retorna la tasa efectiva según el modo */
  getTasaEfectiva(bcv, mercado) {
    if (this.modoActual === 'protected') {
      return mercado; // Usa mercado/USDT para calcular
    } else {
      return bcv; // Usa solo BCV
    }
  }
};

/* ════════════════════════════════════════════════════════
   6. CALCULADORA BIMONEDA — Lógica financiera original
   IMPORTANTE: No se modifican las fórmulas. Solo se
   actualiza el nombre de variables de UI.
   ════════════════════════════════════════════════════════ */

const Calculadora = {

  /* Formateador de números al estilo venezolano */
  fmt(n) {
    return n.toLocaleString('es-VE', { minimumFractionDigits: 2 });
  },

  /* Redondeo al medio dólar superior — lógica original intacta
     Ejemplos: 2.00→2.00 | 2.01→2.50 | 2.51→3.00 | 3.99→4.00 */
  redondearUSD(n) {
    return Math.ceil(n * 2) / 2;
  },

  /* Flash animado al actualizar un valor */
  flashEl(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('value-updated');
    // Force reflow
    void el.offsetWidth;
    el.classList.add('value-updated');
  },

  /* Cargar tasas desde localStorage */
  cargarTasas() {
    const bcv     = localStorage.getItem(CONFIG.STORAGE.BCV);
    const mercado = localStorage.getItem(CONFIG.STORAGE.MERCADO);

    document.getElementById('bcv').value     = bcv     ? bcv     : CONFIG.DEFAULT_BCV;
    document.getElementById('mercado').value = mercado ? mercado : CONFIG.DEFAULT_MERCADO;
  },

  /* Actualiza al cambiar tasa manualmente */
  onTasaChange() {
    this.calc();
    try {
      localStorage.setItem(CONFIG.STORAGE.BCV,    document.getElementById('bcv').value);
      localStorage.setItem(CONFIG.STORAGE.MERCADO, document.getElementById('mercado').value);
    } catch (e) { /* ignorar */ }

    // Mostrar badge de tasas guardadas
    const badge = document.getElementById('savedBadge');
    if (badge) {
      badge.style.display = 'flex';
      clearTimeout(badge._t);
      badge._t = setTimeout(() => { badge.style.display = 'none'; }, 2500);
    }
  },

  /* ── CÁLCULO PRINCIPAL — fórmulas originales ─────────
     La brecha cambiaria entre BCV y Mercado (USDT) es el
     núcleo de la protección del margen comercial.

     factor = mercado / bcv
     precioEspecial = montoUSD / factor   (precio protegido)

     El "factor de ajuste" / "Protección de margen" mide
     cuánto más barato sale el dólar efectivo vs el oficial.
  ───────────────────────────────────────────────────── */
  calc() {
    const bcv     = parseFloat(document.getElementById('bcv').value)     || 0;
    const mercado = parseFloat(document.getElementById('mercado').value)  || 0;
    const loy     = parseFloat(document.getElementById('loyverse').value) || 0;
    const aBS     = parseFloat(document.getElementById('abonoBS').value)  || 0;
    const aUSD    = parseFloat(document.getElementById('abonoUSD').value) || 0;

    // Factor de protección = mercado / BCV
    const factor = (bcv > 0) ? mercado / bcv : 1;

    // Precio total en Bs según BCV
    const precioEnBs = loy * bcv;

    // Precio protegido en USD (usa el factor según modo)
    let tasaEfectiva;
    if (ModoSelector.modoActual === 'protected') {
      tasaEfectiva = factor; // Divide por factor → precio USD más bajo/protegido
    } else {
      tasaEfectiva = 1;      // Modo BCV: el precio USD = monto directo
    }

    const especial = (tasaEfectiva > 0) ? loy / tasaEfectiva : 0;

    // Actualizar UI — factor y precios base
    this.setVal('factor',         factor.toFixed(4));
    this.setVal('precioBs',       'Bs ' + this.fmt(precioEnBs));
    this.setVal('precioEspecial', '$' + this.redondearUSD(especial).toFixed(2));

    // Calcular cobros según abonos — lógica original
    let cobrarUSD = 0;
    let cobrarBS  = 0;

    if (aBS > 0 && aUSD === 0) {
      // Solo abono en Bs
      cobrarUSD = (loy - (aBS / bcv)) / tasaEfectiva;
    } else if (aUSD > 0 && aBS === 0) {
      // Solo abono en USD
      cobrarBS = (loy - (aUSD * tasaEfectiva)) * bcv;
    } else if (aBS > 0 && aUSD > 0) {
      // Pago mixto Bs + USD
      cobrarUSD = ((loy - (aBS / bcv)) / tasaEfectiva) - aUSD;
      if (cobrarUSD < 0) {
        // Si sobra Bs por dar de cambio
        cobrarBS  = Math.abs(cobrarUSD) * bcv;
        cobrarUSD = 0;
      }
    } else {
      // Sin abonos → mostrar precio especial y precio Bs
      cobrarUSD = especial;
      cobrarBS  = precioEnBs;
    }

    // Actualizar resultados finales con animación flash
    this.setVal('cobrarBS',  'Bs ' + this.fmt(Math.max(0, cobrarBS)));
    this.setVal('cobrarUSD', '$'   + this.redondearUSD(Math.max(0, cobrarUSD)).toFixed(2));

    this.flashEl('cobrarBS');
    this.flashEl('cobrarUSD');
    this.flashEl('precioEspecial');
  },

  /* Helper: actualiza texto de un elemento */
  setVal(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  },

  /* Limpia los campos de venta para una nueva transacción */
  nuevaVenta() {
    document.getElementById('loyverse').value = '';
    document.getElementById('abonoBS').value  = '';
    document.getElementById('abonoUSD').value = '';

    // Pequeña animación al limpiar
    document.getElementById('loyverse').focus();

    this.calc();
  }
};

/* ════════════════════════════════════════════════════════
   7. APP — Controlador principal
   ════════════════════════════════════════════════════════ */

const App = {

  /* Muestra la app y oculta el muro de licencia */
  mostrar() {
    // 1. Elimina el estilo de bloqueo inyectado en <head>
    const estiloEmergencia = document.getElementById('bloqueo-inicial');
    if (estiloEmergencia) estiloEmergencia.parentNode.removeChild(estiloEmergencia);

    // 2. Oculta el muro
    const muro = document.getElementById('muro-bloqueo');
    if (muro) muro.style.cssText = 'display:none !important';

    // 3. Muestra la app
    const app = document.getElementById('app-content');
    if (app) app.style.cssText = 'display:block !important';

    // 4. Inicializa módulos
    Calculadora.cargarTasas();
    ModoSelector.init();

    // 5. Mostrar onboarding si nunca se configuró
    if (!Onboarding.estaCompleto()) {
      Onboarding.mostrar();
    } else {
      Calculadora.calc();
    }
  },

  /* Verificación de licencia al arrancar */
  verificar() {
    if (Licencia.estaActiva()) {
      this.mostrar();
    } else {
      Licencia.mostrarMuro();
    }
  }
};

/* ════════════════════════════════════════════════════════
   FUNCIONES GLOBALES — Puentes para eventos HTML inline
   Necesarios para onclick="" en el HTML
   ════════════════════════════════════════════════════════ */

// Licencia
function pedirAcceso()     { Licencia.pedirAcceso(); }
function activar()         { Licencia.activar(); }
function accionInstalar()  { InstallPWA.accion(); }
function cerrarModalIos()  { InstallPWA.cerrarModalIos(); }

// Onboarding
function confirmarOnboarding() { Onboarding.confirmar(); }
function editarTasas()         { Onboarding.editar(); }

// Calculadora
function onTasaChange()  { Calculadora.onTasaChange(); }
function calc()          { Calculadora.calc(); }
function nuevaVenta()    { Calculadora.nuevaVenta(); }

// Selector de modo
function setModo(modo) { ModoSelector.setModo(modo); }

/* ════════════════════════════════════════════════════════
   ARRANQUE — Doble red de seguridad para Safari iOS
   ════════════════════════════════════════════════════════ */

let _verificado = false;

function _arrancar() {
  if (_verificado) return;
  _verificado = true;

  InstallPWA.init();
  App.verificar();
}

// Dispara en cuanto el DOM está listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _arrancar);
} else {
  _arrancar();
}

// Segunda red: cubre casos donde el SW retrasa DOMContentLoaded
window.addEventListener('load', _arrancar);
