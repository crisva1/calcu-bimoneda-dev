/* ═══════════════════════════════════════════════════════
   CALCU BIMONEDA v3 — app.js
   Módulos: Config · Licencia · PWA · Tema · Drawer ·
            Onboarding · ModoSelector · Calculadora · App
   Lógica financiera original 100% intacta.
   ═══════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════
   1. CONFIG
   ════════════════════════════════════════════════════════ */
const CONFIG = {
  SAL:            "aleiluisolcris*1",
  DEFAULT_BCV:    48.00,
  DEFAULT_MERCADO:60.00,
  WS_NUMBER:      "584129050524",
  VERSION:        "3.0",
  SK: {
    LICENCIA:     '_prm',
    DEVICE_ID:    '_cid',
    BCV:          'calcu_bcv',
    MERCADO:      'calcu_binance',   // misma clave que v1/v2 para compatibilidad
    MODO:         'calcu_modo',
    ONBOARDING:   'calcu_onboarding_done',
    TEMA:         'calcu_tema',
    FECHA_TASAS:  'calcu_fecha_tasas',  // fecha en que se guardaron las tasas (YYYY-MM-DD)
  }
};

/* ════════════════════════════════════════════════════════
   2. RESET DIARIO DE TASAS
   Las tasas se invalidan automáticamente al cambiar el día.
   Funciona 100% offline comparando la fecha guardada con
   la fecha actual del dispositivo. No necesita servidor.
   ════════════════════════════════════════════════════════ */
const ResetDiario = {

  /* Retorna la fecha de hoy como string "YYYY-MM-DD" */
  hoy() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dia}`;
  },

  /* Guarda la fecha de hoy junto con las tasas */
  marcarFecha() {
    try {
      localStorage.setItem(CONFIG.SK.FECHA_TASAS, this.hoy());
    } catch(e) {}
  },

  /* Verifica si las tasas son de un día anterior */
  tasasSonDeHoy() {
    try {
      const fechaGuardada = localStorage.getItem(CONFIG.SK.FECHA_TASAS);
      if (!fechaGuardada) return false;       // nunca se guardaron
      return fechaGuardada === this.hoy();
    } catch(e) {
      return false;
    }
  },

  /* Borra las tasas guardadas (pero NO el modo ni el tema) */
  limpiarTasas() {
    try {
      localStorage.removeItem(CONFIG.SK.BCV);
      localStorage.removeItem(CONFIG.SK.MERCADO);
      localStorage.removeItem(CONFIG.SK.FECHA_TASAS);
      localStorage.removeItem(CONFIG.SK.ONBOARDING);
    } catch(e) {}
  },

  /* Punto de entrada: verificar al abrir la app.
     Si las tasas son de ayer o antes → limpiar y pedir de nuevo. */
  verificar() {
    if (!this.tasasSonDeHoy()) {
      this.limpiarTasas();
      // El onboarding se mostrará automáticamente porque ONBOARDING ya no es 'done'
    }
  }
};
const Licencia = {
  getID() {
    try {
      let id = localStorage.getItem(CONFIG.SK.DEVICE_ID);
      if (id) return id;
      const seed = [
        navigator.userAgent || '',
        screen.width + 'x' + screen.height,
        navigator.language || '',
        (navigator.hardwareConcurrency || 0).toString(),
        new Date().getTimezoneOffset().toString()
      ].join('|');
      let h = 5381;
      for (let i = 0; i < seed.length; i++) {
        h = (((h << 5) >>> 0) + h + seed.charCodeAt(i)) >>> 0;
      }
      id = "VZ-" + h.toString(16).toUpperCase().padStart(8,'0');
      localStorage.setItem(CONFIG.SK.DEVICE_ID, id);
      return id;
    } catch(e) { return "VZ-NOLOC"; }
  },

  genClave(id) {
    const base = id + CONFIG.SAL;
    let h = 5381;
    for (let i = 0; i < base.length; i++) {
      h = (((h << 5) >>> 0) + h + base.charCodeAt(i)) >>> 0;
    }
    return "KEY-" + h.toString(36).toUpperCase().padStart(7,'0');
  },

  estaActiva() {
    try { return localStorage.getItem(CONFIG.SK.LICENCIA) === 'true'; }
    catch(e) { return false; }
  },

  mostrarMuro() {
    const el = document.getElementById('mi-id-display');
    if (el) el.textContent = this.getID();
  },

  pedirAcceso() {
    const n = (document.getElementById('reg-nom').value || '').trim();
    const c = (document.getElementById('reg-ci').value  || '').trim();
    if (!n || !c) { this.mostrarError("Completa tu nombre y cédula primero."); return; }
    const txt = `SOLICITUD ACTIVACION\nNombre: ${n}\nCI: ${c}\nID: ${this.getID()}`;
    window.open(`https://wa.me/${CONFIG.WS_NUMBER}?text=${encodeURIComponent(txt)}`, '_blank');
  },

  activar() {
    const entrada = (document.getElementById('clave-in').value || '').trim().toUpperCase();
    if (!entrada) { this.mostrarError("Ingresa la clave de activación."); return; }
    if (entrada === this.genClave(this.getID())) {
      try { localStorage.setItem(CONFIG.SK.LICENCIA, 'true'); } catch(e) {}
      App.mostrar();
    } else {
      this.mostrarError("Clave inválida. Verifica e intenta de nuevo.");
      document.getElementById('clave-in').value = '';
    }
  },

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
    const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const yaInstalada = window.navigator.standalone === true;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this._prompt = e;
      // Mostrar banner Android en el muro
      const b = document.getElementById('banner-android');
      if (b) b.classList.add('visible');
    });

    window.addEventListener('appinstalled', () => {
      const b = document.getElementById('banner-android');
      if (b) b.classList.remove('visible');
    });

    // iOS: mostrar banner si no está instalada
    if (esIOS && !yaInstalada) {
      const b = document.getElementById('banner-ios');
      if (b) b.classList.add('visible');
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
          const b = document.getElementById('banner-android');
          if (b) b.classList.remove('visible');
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
   4. TEMA CLARO / OSCURO
   ════════════════════════════════════════════════════════ */
const Tema = {
  actual: 'light',

  init() {
    this.actual = localStorage.getItem(CONFIG.SK.TEMA) || 'light';
    this.aplicar(this.actual, false);

    // Sincronizar el toggle del drawer
    const toggle = document.getElementById('toggle-dark');
    if (toggle) toggle.checked = (this.actual === 'dark');
  },

  aplicar(modo, guardar = true) {
    this.actual = modo;
    document.documentElement.setAttribute('data-theme', modo);
    if (guardar) {
      try { localStorage.setItem(CONFIG.SK.TEMA, modo); } catch(e) {}
    }
    // Toggle en sync
    const toggle = document.getElementById('toggle-dark');
    if (toggle) toggle.checked = (modo === 'dark');
  },

  toggle() {
    this.aplicar(this.actual === 'dark' ? 'light' : 'dark');
  }
};

/* ════════════════════════════════════════════════════════
   5. DRAWER (menú lateral)
   ════════════════════════════════════════════════════════ */
const Drawer = {
  open() {
    document.getElementById('drawer').classList.add('open');
    document.getElementById('drawer-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    this.actualizarSubtitulos();
  },
  close() {
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawer-overlay').classList.remove('open');
    document.body.style.overflow = '';
  },
  actualizarSubtitulos() {
    // Tasas sub
    const bcv     = localStorage.getItem(CONFIG.SK.BCV)     || CONFIG.DEFAULT_BCV;
    const mercado = localStorage.getItem(CONFIG.SK.MERCADO)  || CONFIG.DEFAULT_MERCADO;
    const sub = document.getElementById('drawer-tasas-sub');
    if (sub) sub.textContent = `BCV: Bs ${parseFloat(bcv).toFixed(2)} · Mdo: Bs ${parseFloat(mercado).toFixed(2)}`;

    // Modo sub
    const modoSub = document.getElementById('drawer-modo-sub');
    if (modoSub) modoSub.textContent =
      ModoSelector.modoActual === 'protected' ? 'Cobro protegido ✓' : 'Cobro BCV';
  }
};

/* ════════════════════════════════════════════════════════
   6. MODAL DE CONFIGURACIÓN (tasas + modo)
   ════════════════════════════════════════════════════════ */
const ModalConfig = {
  tipo: null,

  abrirTasas() {
    this.tipo = 'tasas';
    const bcv     = localStorage.getItem(CONFIG.SK.BCV)     || CONFIG.DEFAULT_BCV;
    const mercado = localStorage.getItem(CONFIG.SK.MERCADO)  || CONFIG.DEFAULT_MERCADO;
    const factor  = bcv > 0 ? (parseFloat(mercado) / parseFloat(bcv)).toFixed(4) : '—';

    document.getElementById('modal-config-title').textContent = '📊 Tasas del día';
    document.getElementById('modal-config-body').innerHTML = `
      <div class="config-row">
        <div class="config-field">
          <div class="config-label">USD BCV (Bs/$)</div>
          <input class="field-input tasa" type="number" id="cfg-bcv"
            value="${parseFloat(bcv).toFixed(2)}" step="0.01" inputmode="decimal"
            oninput="ModalConfig.actualizarFactor()">
        </div>
        <div class="config-field">
          <div class="config-label">USD Mercado (Bs/$)</div>
          <input class="field-input tasa" type="number" id="cfg-mercado"
            value="${parseFloat(mercado).toFixed(2)}" step="0.01" inputmode="decimal"
            oninput="ModalConfig.actualizarFactor()">
        </div>
      </div>
      <div class="factor-display">
        <span class="factor-display-label">Protección de margen</span>
        <span class="factor-display-val" id="cfg-factor">${factor}</span>
      </div>
      <button class="btn btn-primary" onclick="ModalConfig.guardarTasas()">✓ Guardar tasas</button>
    `;
    document.getElementById('modal-config').classList.add('open');
    Drawer.close();
  },

  actualizarFactor() {
    const bcv     = parseFloat(document.getElementById('cfg-bcv')?.value)     || 0;
    const mercado = parseFloat(document.getElementById('cfg-mercado')?.value)  || 0;
    const el = document.getElementById('cfg-factor');
    if (el) el.textContent = bcv > 0 ? (mercado / bcv).toFixed(4) : '—';
  },

  guardarTasas() {
    const bcv     = parseFloat(document.getElementById('cfg-bcv').value)     || 0;
    const mercado = parseFloat(document.getElementById('cfg-mercado').value)  || 0;
    if (bcv <= 0 || mercado <= 0) { alert('Ingresa valores válidos.'); return; }
    try {
      localStorage.setItem(CONFIG.SK.BCV,     bcv.toString());
      localStorage.setItem(CONFIG.SK.MERCADO,  mercado.toString());
      localStorage.setItem(CONFIG.SK.ONBOARDING, 'done');
      ResetDiario.marcarFecha();   // ← renueva la fecha del día
    } catch(e) {}
    Calculadora.cargarTasas();
    Calculadora.calc();
    this.cerrar();
    // Badge guardado
    const badge = document.getElementById('savedBadge');
    if (badge) {
      badge.style.display = 'flex';
      clearTimeout(badge._t);
      badge._t = setTimeout(() => { badge.style.display = 'none'; }, 2500);
    }
  },

  abrirModo() {
    this.tipo = 'modo';
    const actual = ModoSelector.modoActual;
    document.getElementById('modal-config-title').textContent = '🛡️ Modo de cobro';
    document.getElementById('modal-config-body').innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
        <button class="drawer-item" style="border-radius:10px; border:1.5px solid ${actual==='protected'?'var(--orange)':'var(--border)'}; background:${actual==='protected'?'var(--orange-soft)':'var(--surface-2)'};"
          onclick="ModoSelector.setModo('protected'); ModalConfig.cerrar();">
          <div class="drawer-item-icon orange">🛡️</div>
          <div class="drawer-item-text">
            <div class="drawer-item-title">Cobro protegido</div>
            <div class="drawer-item-sub">Usa USD Mercado. Protege tu margen contra la brecha cambiaria.</div>
          </div>
          ${actual==='protected' ? '<span style="color:var(--orange); font-size:16px;">✓</span>' : ''}
        </button>
        <button class="drawer-item" style="border-radius:10px; border:1.5px solid ${actual==='bcv'?'var(--blue)':'var(--border)'}; background:${actual==='bcv'?'var(--blue-soft)':'var(--surface-2)'};"
          onclick="ModoSelector.setModo('bcv'); ModalConfig.cerrar();">
          <div class="drawer-item-icon blue">🏛️</div>
          <div class="drawer-item-text">
            <div class="drawer-item-title">Cobro BCV</div>
            <div class="drawer-item-sub">Usa solo la tasa oficial BCV. Sin ajuste de brecha.</div>
          </div>
          ${actual==='bcv' ? '<span style="color:var(--blue); font-size:16px;">✓</span>' : ''}
        </button>
      </div>
    `;
    document.getElementById('modal-config').classList.add('open');
    Drawer.close();
  },

  cerrar() {
    document.getElementById('modal-config').classList.remove('open');
  }
};

/* ════════════════════════════════════════════════════════
   7. ONBOARDING
   ════════════════════════════════════════════════════════ */
const Onboarding = {
  estaCompleto() {
    try { return localStorage.getItem(CONFIG.SK.ONBOARDING) === 'done'; }
    catch(e) { return false; }
  },

  mostrar() {
    const bcv     = localStorage.getItem(CONFIG.SK.BCV)     || CONFIG.DEFAULT_BCV;
    const mercado = localStorage.getItem(CONFIG.SK.MERCADO)  || CONFIG.DEFAULT_MERCADO;
    document.getElementById('ob-bcv').value     = parseFloat(bcv).toFixed(2);
    document.getElementById('ob-mercado').value = parseFloat(mercado).toFixed(2);
    document.getElementById('screen-onboarding').classList.add('visible');
  },

  confirmar() {
    const bcv     = parseFloat(document.getElementById('ob-bcv').value)     || 0;
    const mercado = parseFloat(document.getElementById('ob-mercado').value)  || 0;
    if (bcv <= 0 || mercado <= 0) { alert('Ingresa las tasas del día para continuar.'); return; }
    try {
      localStorage.setItem(CONFIG.SK.BCV,      bcv.toString());
      localStorage.setItem(CONFIG.SK.MERCADO,   mercado.toString());
      localStorage.setItem(CONFIG.SK.ONBOARDING,'done');
      ResetDiario.marcarFecha();   // ← guarda la fecha de hoy con las tasas
    } catch(e) {}
    document.getElementById('screen-onboarding').classList.remove('visible');
    Calculadora.cargarTasas();
    Calculadora.calc();
  }
};

/* ════════════════════════════════════════════════════════
   8. SELECTOR DE MODO
   ════════════════════════════════════════════════════════ */
const ModoSelector = {
  modoActual: 'protected',

  init() {
    try {
      const saved = localStorage.getItem(CONFIG.SK.MODO);
      if (saved) this.modoActual = saved;
    } catch(e) {}
    this.actualizarPill();
  },

  setModo(modo) {
    this.modoActual = modo;
    try { localStorage.setItem(CONFIG.SK.MODO, modo); } catch(e) {}
    this.actualizarPill();
    Calculadora.calc();
  },

  actualizarPill() {
    const pill = document.getElementById('mode-pill');
    const txt  = document.getElementById('mode-pill-txt');
    if (!pill || !txt) return;
    if (this.modoActual === 'protected') {
      pill.className = 'mode-pill protected';
      txt.textContent = 'PROTEGIDO';
    } else {
      pill.className = 'mode-pill bcv';
      txt.textContent = 'TASA BCV';
    }
  }
};

/* ════════════════════════════════════════════════════════
   9. CALCULADORA — Lógica financiera original intacta
   ════════════════════════════════════════════════════════ */
const Calculadora = {

  fmt(n) {
    return n.toLocaleString('es-VE', { minimumFractionDigits: 2 });
  },

  /* Redondeo al medio dólar superior — ORIGINAL
     2.00→2.00 | 2.01→2.50 | 2.51→3.00 | 3.99→4.00 */
  redondearUSD(n) {
    return Math.ceil(n * 2) / 2;
  },

  cargarTasas() {
    const bcv     = localStorage.getItem(CONFIG.SK.BCV)     || CONFIG.DEFAULT_BCV;
    const mercado = localStorage.getItem(CONFIG.SK.MERCADO)  || CONFIG.DEFAULT_MERCADO;
    // Estos campos ya NO están en pantalla principal, pero los mantenemos
    // en memoria para el cálculo. Si existen en el DOM (modal) se actualizan.
    this._bcv     = parseFloat(bcv);
    this._mercado = parseFloat(mercado);
  },

  flashEl(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('value-updated');
    void el.offsetWidth;
    el.classList.add('value-updated');
  },

  setVal(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  },

  calc() {
    // Leer tasas desde localStorage (siempre actualizadas)
    const bcv     = parseFloat(localStorage.getItem(CONFIG.SK.BCV))     || this._bcv     || CONFIG.DEFAULT_BCV;
    const mercado = parseFloat(localStorage.getItem(CONFIG.SK.MERCADO))  || this._mercado || CONFIG.DEFAULT_MERCADO;

    const loy  = parseFloat(document.getElementById('loyverse').value) || 0;
    const aBS  = parseFloat(document.getElementById('abonoBS').value)  || 0;
    const aUSD = parseFloat(document.getElementById('abonoUSD').value) || 0;

    // Factor de protección = mercado / BCV
    const factor = bcv > 0 ? mercado / bcv : 1;

    // Tasa efectiva según modo seleccionado
    const tasaEfectiva = ModoSelector.modoActual === 'protected' ? factor : 1;

    // Precio en Bs y precio en divisas
    const precioEnBs = loy * bcv;
    const especial   = tasaEfectiva > 0 ? loy / tasaEfectiva : 0;

    this.setVal('precioBs',       'Bs ' + this.fmt(precioEnBs));
    this.setVal('precioEspecial', '$' + this.redondearUSD(especial).toFixed(2));

    // Cálculo de cobros según abonos — LÓGICA ORIGINAL
    let cobrarUSD = 0;
    let cobrarBS  = 0;

    if (aBS > 0 && aUSD === 0) {
      cobrarUSD = (loy - (aBS / bcv)) / tasaEfectiva;
    } else if (aUSD > 0 && aBS === 0) {
      cobrarBS = (loy - (aUSD * tasaEfectiva)) * bcv;
    } else if (aBS > 0 && aUSD > 0) {
      cobrarUSD = ((loy - (aBS / bcv)) / tasaEfectiva) - aUSD;
      if (cobrarUSD < 0) {
        cobrarBS  = Math.abs(cobrarUSD) * bcv;
        cobrarUSD = 0;
      }
    } else {
      cobrarUSD = especial;
      cobrarBS  = precioEnBs;
    }

    this.setVal('cobrarBS',  'Bs ' + this.fmt(Math.max(0, cobrarBS)));
    this.setVal('cobrarUSD', '$'   + this.redondearUSD(Math.max(0, cobrarUSD)).toFixed(2));

    this.flashEl('cobrarBS');
    this.flashEl('cobrarUSD');
    this.flashEl('precioEspecial');
  },

  nuevaVenta() {
    document.getElementById('loyverse').value = '';
    document.getElementById('abonoBS').value  = '';
    document.getElementById('abonoUSD').value = '';
    document.getElementById('loyverse').focus();
    this.calc();
  }
};

/* ════════════════════════════════════════════════════════
   10. APP — Controlador principal
   ════════════════════════════════════════════════════════ */
const App = {
  mostrar() {
    // Elimina bloqueo inicial
    const bloqueo = document.getElementById('bloqueo-inicial');
    if (bloqueo) bloqueo.parentNode.removeChild(bloqueo);

    document.getElementById('muro-bloqueo').style.cssText = 'display:none !important';
    document.getElementById('app-content').style.cssText  = 'display:block !important';

    // Inicializar módulos
    Tema.init();
    ModoSelector.init();

    // ← Verificar si las tasas son de hoy. Si no, las borra y pide de nuevo.
    ResetDiario.verificar();

    Calculadora.cargarTasas();

    // Onboarding si es primera vez o si las tasas se resetearon
    if (!Onboarding.estaCompleto()) {
      Onboarding.mostrar();
    } else {
      Calculadora.calc();
    }
  },

  verificar() {
    if (Licencia.estaActiva()) {
      this.mostrar();
    } else {
      Licencia.mostrarMuro();
    }
  }
};

/* ════════════════════════════════════════════════════════
   FUNCIONES GLOBALES (puentes para onclick="" en HTML)
   ════════════════════════════════════════════════════════ */

// Licencia
function pedirAcceso()    { Licencia.pedirAcceso(); }
function activar()        { Licencia.activar(); }
function accionInstalar() { InstallPWA.accion(); }
function cerrarModalIos() { InstallPWA.cerrarModalIos(); }

// Onboarding
function confirmarOnboarding() { Onboarding.confirmar(); }

// Drawer
function abrirDrawer()   { Drawer.open(); }
function cerrarDrawer()  { Drawer.close(); }

// Config modal
function abrirConfigTasas() { ModalConfig.abrirTasas(); }
function abrirSelectorModo(){ ModalConfig.abrirModo();  }
function cerrarModalConfig() { ModalConfig.cerrar(); }

// Tema
function toggleTema() { Tema.toggle(); }

// Calculadora
function calc()       { Calculadora.calc(); }
function nuevaVenta() { Calculadora.nuevaVenta(); }

// Drawer items
function irSoporte() {
  Drawer.close();
  window.open(`https://wa.me/${CONFIG.WS_NUMBER}?text=${encodeURIComponent('Hola, necesito soporte con Calcu Bimoneda')}`, '_blank');
}
function mostrarAcercaDe() {
  Drawer.close();
  alert(`Calcu Bimoneda v${CONFIG.VERSION}\nProyecto Cristal\n\nCalculadora de cobros bimoneda Bs/USD para comerciantes venezolanos.\n\nID: ${Licencia.getID()}`);
}

/* ════════════════════════════════════════════════════════
   ARRANQUE — doble red para Safari iOS + PWA
   ════════════════════════════════════════════════════════ */
let _verificado = false;
function _arrancar() {
  if (_verificado) return;
  _verificado = true;
  InstallPWA.init();
  App.verificar();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _arrancar);
} else {
  _arrancar();
}
window.addEventListener('load', _arrancar);
