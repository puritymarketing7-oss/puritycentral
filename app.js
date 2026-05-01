import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

// =========================================================================
// CONFIGURACIÓN DE FIREBASE (¡Completar con los datos del Paso 2 y 4!)
// =========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyDTyBkvph-yN6BdyL-k3o5X7bjYDRLKRq8",
    databaseURL: "https://tvcentralpurity-default-rtdb.firebaseio.com",
    projectId: "tvcentralpurity",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Referencias DOM
const grid = document.getElementById('devices-grid');
const modal = document.getElementById('config-modal');
const closeModal = document.getElementById('close-modal');
const form = document.getElementById('config-form');
const salasContainer = document.getElementById('salas-inputs-container');
let globalDevicesData = {};

// Inicializar Inputs de Salas Dinámicamente (1-20)
function initSalasInputs() {
    salasContainer.innerHTML = '';
    for (let i = 0; i < 20; i++) {
        const div = document.createElement('div');
        div.className = 'sala-input-wrap';
        div.innerHTML = `
            <label>S${i + 1}</label>
            <input type="number" id="cfg_s${i}" value="0">
        `;
        salasContainer.appendChild(div);
    }
}
initSalasInputs();

// =========================================================================
// SISTEMA DE LOGIN Y SEGURIDAD (ANTI BRUTE-FORCE)
// =========================================================================
const loginScreen = document.getElementById('login-screen');
const devicesGridContainer = document.getElementById('devices-grid');
const btnLogin = document.getElementById('btn-login');
const passInput = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const btnLogout = document.getElementById('btn-logout');
const btnChangePass = document.getElementById('btn-change-pass');
const passModal = document.getElementById('password-modal');

let currentPasswordHash = "";

// Hashear la contraseña (Seguridad para que no se vea en texto plano en la base de datos)
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Inicializar un hash de emergencia inmediatamente por si Firebase tarda en responder
hashPassword("puritymartin").then(h => {
    if (!currentPasswordHash) currentPasswordHash = h;
});

// Sincronizar el hash de Firebase
const adminRef = ref(db, 'admin');
onValue(adminRef, async (snapshot) => {
    const data = snapshot.val();
    if (data && data.password_hash) {
        currentPasswordHash = data.password_hash;
    } else {
        // Si es la primera vez, guardar el hash por defecto en la nube
        const defaultHash = await hashPassword("puritymartin");
        currentPasswordHash = defaultHash;
        try {
            update(ref(db), { 'admin/password_hash': defaultHash });
        } catch(e) {
            console.warn("No se pudo guardar el hash en la nube.");
        }
    }
}, async (error) => {
    loginError.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Firebase falló. Usando modo local.`;
    loginError.style.display = 'block';
});

function checkLogin() {
    const adminActions = document.getElementById('admin-actions');
    if (sessionStorage.getItem('isLogged') === 'true') {
        loginScreen.style.display = 'none';
        devicesGridContainer.style.display = 'grid';
        if(adminActions) adminActions.style.display = 'flex';
    } else {
        loginScreen.style.display = 'block';
        devicesGridContainer.style.display = 'none';
        if(adminActions) adminActions.style.display = 'none';
    }
}

// Sistema Anti-Brute Force (Guardado en memoria local del navegador)
function getLockoutTime() { return parseInt(localStorage.getItem('lockoutTime')) || 0; }
function getFailedAttempts() { return parseInt(localStorage.getItem('failedAttempts')) || 0; }
function setLockout(attempts, time) {
    localStorage.setItem('failedAttempts', attempts);
    localStorage.setItem('lockoutTime', time);
}

btnLogin.addEventListener('click', async () => {
    const now = Date.now();
    const lockoutTime = getLockoutTime();
    
    // 1. Revisar si está bloqueado
    if (now < lockoutTime) {
        const waitMinutes = Math.ceil((lockoutTime - now) / 60000);
        loginError.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Bloqueado por seguridad. Intentá en ${waitMinutes} min.`;
        loginError.style.display = 'block';
        return;
    }

    // 2. Verificar contraseña
    const inputHash = await hashPassword(passInput.value);
    if (inputHash === currentPasswordHash) {
        sessionStorage.setItem('isLogged', 'true');
        setLockout(0, 0); // Resetear intentos
        loginError.style.display = 'none';
        passInput.value = '';
        checkLogin();
    } else {
        let attempts = getFailedAttempts() + 1;
        if (attempts >= 3) {
            // Bloqueo de 5 minutos al 3er intento fallido
            setLockout(attempts, now + 5 * 60 * 1000);
            loginError.innerHTML = `<i class="fa-solid fa-shield"></i> Límite excedido. Bloqueo de 5 minutos.`;
        } else {
            setLockout(attempts, 0);
            loginError.innerHTML = `Clave incorrecta. Te quedan ${3 - attempts} intentos.`;
        }
        loginError.style.display = 'block';
    }
});

passInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') btnLogin.click(); });
btnLogout.addEventListener('click', () => { sessionStorage.removeItem('isLogged'); checkLogin(); });

// Modal de Cambio de Clave
btnChangePass.onclick = () => passModal.classList.add('show');
document.getElementById('close-pass-modal').onclick = () => passModal.classList.remove('show');

document.getElementById('btn-save-pass').addEventListener('click', async () => {
    const oldPass = document.getElementById('old-pass').value;
    const newPass = document.getElementById('new-pass').value;
    
    if (!oldPass || !newPass) {
        showToast('Completá ambos campos', 'error');
        return;
    }
    
    const oldHash = await hashPassword(oldPass);
    if (oldHash !== currentPasswordHash) {
        showToast('La contraseña actual es incorrecta', 'error');
        return;
    }
    
    if (newPass.length < 6) {
        showToast('La nueva clave debe tener mínimo 6 letras', 'error');
        return;
    }
    
    const newHash = await hashPassword(newPass);
    try {
        await update(ref(db), { 'admin/password_hash': newHash });
        showToast('¡Contraseña actualizada en la nube!', 'success');
        passModal.classList.remove('show');
        document.getElementById('old-pass').value = '';
        document.getElementById('new-pass').value = '';
    } catch(e) {
        showToast('Error al actualizar', 'error');
    }
});

// Inicializar estado
checkLogin();

// Escuchar cambios en la base de datos (Realtime)
const devicesRef = ref(db, 'devices');
onValue(devicesRef, (snapshot) => {
    const data = snapshot.val();
    grid.innerHTML = ''; // Limpiar grilla

    if (!data) {
        grid.innerHTML = '<div class="loading-state"><p>No se encontraron dispositivos registrados.</p></div>';
        return;
    }

    globalDevicesData = data;
    const now = Math.floor(Date.now() / 1000);

    Object.keys(data).forEach(mac => {
        const device = data[mac];
        const info = device.info || {};
        const stats = device.stats || {};

        // Calcular Estado (Si el último ping fue hace menos de 120 segundos = Online)
        const isOnline = (now - (info.last_seen || 0)) < 120;
        const statusClass = isOnline ? 'online' : 'offline';
        const statusText = isOnline ? 'Online' : 'Offline';

        const card = document.createElement('div');
        card.className = 'device-card glass-panel';
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <h2>${info.name || 'Dispositivo Nuevo'}</h2>
                    <small style="color: var(--text-secondary)">MAC: ${mac}</small>
                </div>
                <div class="status-badge ${statusClass}">
                    <div class="status-indicator"></div>
                    ${statusText}
                </div>
            </div>
            <div class="card-body">
                <div class="stat-row">
                    <span class="stat-label"><i class="fa-solid fa-sack-dollar"></i> Recaudación QR</span>
                    <span class="stat-value">$${(stats.monto_total_qr || 0).toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label"><i class="fa-solid fa-qrcode"></i> Usos QR</span>
                    <span class="stat-value">${stats.usos_qr || 0}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label"><i class="fa-solid fa-power-off"></i> Inicios Totales</span>
                    <span class="stat-value">${stats.inicios || 0}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label"><i class="fa-solid fa-wifi"></i> IP Local</span>
                    <span class="stat-value">${info.ip || '---'}</span>
                </div>
            </div>
            <button class="btn btn-primary" onclick="openConfig('${mac}')">
                <i class="fa-solid fa-gear"></i> Configurar Máquina
            </button>
        `;
        grid.appendChild(card);
    });
}, (error) => {
    console.error("Error al leer Firebase:", error);
    grid.innerHTML = `<div class="loading-state"><p style="color:var(--danger-color)">Error de conexión. Verificá las credenciales de Firebase en app.js.</p></div>`;
});

// Lógica del Modal
window.openConfig = function (mac) {
    const device = globalDevicesData[mac];
    if (!device) return;

    const info = device.info || {};
    const cfg = device.config || {};
    const stats = device.stats || {};

    // Cargar datos al formulario
    document.getElementById('edit-mac').value = mac;
    document.getElementById('cfg_name').value = info.name || '';
    document.getElementById('cfg_piso').value = cfg.piso || 1;
    document.getElementById('cfg_precio_pulso').value = cfg.precio_pulso || 100;
    document.getElementById('cfg_pesos_1h').value = cfg.pesos_1h || 10;

    document.getElementById('cfg_demo_qr').checked = cfg.demo_qr || false;
    document.getElementById('cfg_max_usos').value = cfg.max_usos_demo || 100;

    const horas = cfg.horas || [0, 0, 0, 0];
    const pesos = cfg.pesos || [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
        document.getElementById(`cfg_h${i}`).value = horas[i];
        document.getElementById(`cfg_p${i}`).value = pesos[i];
    }

    const salas = cfg.salas || Array(20).fill(0);
    for (let i = 0; i < 20; i++) {
        const input = document.getElementById(`cfg_s${i}`);
        if (input) input.value = salas[i];
    }

    // --- Pestaña Historial ---
    // Billetes
    const billetes = stats.billetes || [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
        const el = document.getElementById(`hist_bill${i}`);
        if (el) el.textContent = (billetes[i] || 0).toLocaleString();
    }

    // Últimas 5 transacciones
    const historial = stats.historial || [];
    const tbody = document.getElementById('hist_table_body');
    if (tbody) {
        if (historial.length === 0 || historial.every(t => (t.sala || 0) === 0 && (t.hora || 0) === 0)) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--text-secondary);">Sin datos aún</td></tr>';
        } else {
            tbody.innerHTML = '';
            historial.forEach((t, idx) => {
                const sala = t.sala || 0;
                const hora = t.hora || 0;
                if (sala === 0 && hora === 0) return; // Saltar vacíos
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${idx + 1}</td><td>${sala}</td><td>${hora}h</td>`;
                tbody.appendChild(tr);
            });
            if (tbody.children.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--text-secondary);">Sin datos aún</td></tr>';
            }
        }
    }

    modal.classList.add('show');
};

closeModal.onclick = () => modal.classList.remove('show');
window.onclick = (e) => { if (e.target === modal) modal.classList.remove('show'); };

// Pestañas (Tabs)
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Remover activos
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        // Agregar activo al seleccionado
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// Mostrar/Ocultar input de usos máximos según toggle
const toggleDemo = document.getElementById('cfg_demo_qr');
const groupUsos = document.getElementById('group_max_usos');
toggleDemo.addEventListener('change', (e) => {
    groupUsos.style.opacity = e.target.checked ? '1' : '0.5';
    document.getElementById('cfg_max_usos').disabled = !e.target.checked;
});

// Guardar Configuración
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mac = document.getElementById('edit-mac').value;

    // Recolectar datos
    const horas = [], pesos = [], salas = [];
    for (let i = 0; i < 4; i++) {
        horas.push(parseInt(document.getElementById(`cfg_h${i}`).value) || 0);
        pesos.push(parseInt(document.getElementById(`cfg_p${i}`).value) || 0);
    }
    for (let i = 0; i < 20; i++) {
        salas.push(parseInt(document.getElementById(`cfg_s${i}`).value) || 0);
    }

    const updates = {};
    // Update Info
    updates[`devices/${mac}/info/name`] = document.getElementById('cfg_name').value;

    // Update Config
    const configPath = `devices/${mac}/config`;
    updates[`${configPath}/piso`] = parseInt(document.getElementById('cfg_piso').value) || 1;
    updates[`${configPath}/precio_pulso`] = parseInt(document.getElementById('cfg_precio_pulso').value) || 100;
    updates[`${configPath}/pesos_1h`] = parseInt(document.getElementById('cfg_pesos_1h').value) || 10;
    updates[`${configPath}/demo_qr`] = document.getElementById('cfg_demo_qr').checked;
    updates[`${configPath}/max_usos_demo`] = parseInt(document.getElementById('cfg_max_usos').value) || 100;
    updates[`${configPath}/horas`] = horas;
    updates[`${configPath}/pesos`] = pesos;
    updates[`${configPath}/salas`] = salas;

    try {
        await update(ref(db), updates);
        showToast('Configuración guardada exitosamente.', 'success');
        modal.classList.remove('show');
    } catch (error) {
        console.error("Error guardando:", error);
        showToast('Error al guardar configuración.', 'error');
    }
});

// Botón Reiniciar
document.getElementById('btn-reboot').addEventListener('click', async () => {
    const mac = document.getElementById('edit-mac').value;
    if (confirm('¿Estás seguro que querés forzar el reinicio de este ESP32? Interrumpirá transacciones en curso.')) {
        try {
            await update(ref(db), { [`devices/${mac}/info/reboot`]: true });
            showToast('Comando de reinicio enviado.', 'success');
            modal.classList.remove('show');
        } catch (error) {
            showToast('Error al enviar reinicio.', 'error');
        }
    }
});

// Sistema de Alertas
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-circle-xmark'}"></i> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        if (container.contains(toast)) container.removeChild(toast);
    }, 3000);
}
