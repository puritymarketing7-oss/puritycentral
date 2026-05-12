import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

// =========================================================================
// CONFIGURACION DE FIREBASE
// =========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyDTyBkvph-yN6BdyL-k3o5X7bjYDRLKRq8",
    databaseURL: "https://tvcentralpurity-default-rtdb.firebaseio.com",
    projectId: "tvcentralpurity",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// =========================================================================
// REFERENCIAS DOM
// =========================================================================
const grid = document.getElementById('devices-grid');
const modal = document.getElementById('config-modal');
const closeModal = document.getElementById('close-modal');
const form = document.getElementById('config-form');
const salasContainer = document.getElementById('salas-inputs-container');
let globalDevicesData = {};

const loginScreen = document.getElementById('login-screen');
const devicesGridContainer = document.getElementById('devices-grid');
const btnLogin = document.getElementById('btn-login');
const userInput = document.getElementById('login-user');
const passInput = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const btnLogout = document.getElementById('btn-logout');
const btnChangeCreds = document.getElementById('btn-change-creds');
const credsModal = document.getElementById('creds-modal');
const adminActions = document.getElementById('admin-actions');
const userInfoBar = document.getElementById('user-info-bar');

// =========================================================================
// INICIALIZAR SALAS (1-20)
// =========================================================================
function initSalasInputs() {
    salasContainer.innerHTML = '';
    for (let i = 0; i < 20; i++) {
        const div = document.createElement('div');
        div.className = 'sala-input-wrap';
        div.innerHTML = `
            <label>S${i + 1}</label>
            <input type="number" id="cfg_s${i}" min="0" max="31" value="0" oninput="this.value=Math.max(0,Math.min(31,parseInt(this.value)||0))">
        `;
        salasContainer.appendChild(div);
    }
}
initSalasInputs();

// =========================================================================
// AUTO-COMPLETAR TARIFAS PROPORCIONALES
// =========================================================================
let tariffSyncLock = false;
function setupTariffSync() {
    const basePesos = document.getElementById('cfg_pesos_1h');
    for (let i = 0; i < 4; i++) {
        const hInput = document.getElementById(`cfg_h${i}`);
        const pInput = document.getElementById(`cfg_p${i}`);
        if (!hInput || !pInput) continue;

        // Horas cambia -> actualizar Pulsos
        hInput.addEventListener('input', () => {
            if (tariffSyncLock) return;
            tariffSyncLock = true;
            const horas = parseInt(hInput.value) || 0;
            const base = parseInt(basePesos.value) || 0;
            pInput.value = horas * base;
            validarJerarquiaTarifas();
            tariffSyncLock = false;
        });

        // Pulsos cambia -> actualizar Horas
        pInput.addEventListener('input', () => {
            if (tariffSyncLock) return;
            tariffSyncLock = true;
            let pulsos = parseInt(pInput.value) || 0;
            // Clamp pulsos para que sea > promo anterior
            if (i > 0) {
                const prevP = parseInt(document.getElementById(`cfg_p${i-1}`).value) || 0;
                const prevH = parseInt(document.getElementById(`cfg_h${i-1}`).value) || 0;
                if (prevH > 0 && prevP > 0 && pulsos > 0 && pulsos <= prevP) {
                    pulsos = prevP + 1;
                    pInput.value = pulsos;
                }
            }
            const base = parseInt(basePesos.value) || 1;
            hInput.value = Math.floor(pulsos / base);
            validarJerarquiaTarifas();
            tariffSyncLock = false;
        });

        // Horas cambia -> clamp a >= promo anterior
        hInput.addEventListener('change', () => {
            let horas = parseInt(hInput.value) || 0;
            if (i > 0 && horas > 0) {
                const prevH = parseInt(document.getElementById(`cfg_h${i-1}`).value) || 0;
                if (prevH > 0 && horas <= prevH) {
                    horas = prevH + 1;
                    hInput.value = horas;
                    tariffSyncLock = true;
                    const base = parseInt(basePesos.value) || 0;
                    document.getElementById(`cfg_p${i}`).value = horas * base;
                    tariffSyncLock = false;
                }
            }
            validarJerarquiaTarifas();
        });
    }
}

function validarJerarquiaTarifas() {
    let lastH = -1, lastP = -1;
    for (let i = 0; i < 4; i++) {
        const h = parseInt(document.getElementById(`cfg_h${i}`).value) || 0;
        const p = parseInt(document.getElementById(`cfg_p${i}`).value) || 0;
        const hInput = document.getElementById(`cfg_h${i}`);
        const pInput = document.getElementById(`cfg_p${i}`);

        if (h === 0 && p === 0) continue; // promo deshabilitada (saltar)

        let error = false;
        if (h > 0 && p > 0) {
            if (h <= lastH) error = true;
            if (p <= lastP) error = true;
        }

        if (h > 0 && p === 0) error = true;
        if (p > 0 && h === 0) error = true;

        hInput.style.borderColor = error ? 'var(--danger-color)' : '';
        pInput.style.borderColor = error ? 'var(--danger-color)' : '';

        if (h > 0 && p > 0) {
            lastH = h;
            lastP = p;
        }
    }
}

function obtenerErroresTarifas() {
    let lastH = -1, lastP = -1;
    const errores = [];
    for (let i = 0; i < 4; i++) {
        const h = parseInt(document.getElementById(`cfg_h${i}`).value) || 0;
        const p = parseInt(document.getElementById(`cfg_p${i}`).value) || 0;
        if (h === 0 && p === 0) continue;
        if (h === 0 && p > 0) { errores.push(`Opcion ${i+1}: tiene Pulsos pero Horas=0`); continue; }
        if (p === 0 && h > 0) { errores.push(`Opcion ${i+1}: tiene Horas pero Pulsos=0`); continue; }
        if (h <= lastH) errores.push(`Opcion ${i+1}: Horas (${h}) debe ser > Horas Opcion anterior (${lastH})`);
        if (p <= lastP) errores.push(`Opcion ${i+1}: Pulsos (${p}) debe ser > Pulsos Opcion anterior (${lastP})`);
        lastH = h;
        lastP = p;
    }
    return errores;
}
setupTariffSync();

// =========================================================================
// UTILIDADES DE HASH Y SEGURIDAD
// =========================================================================
async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getLockoutTime() { return parseInt(localStorage.getItem('lockoutTime')) || 0; }
function getFailedAttempts() { return parseInt(localStorage.getItem('failedAttempts')) || 0; }
function setLockout(attempts, time) {
    localStorage.setItem('failedAttempts', attempts);
    localStorage.setItem('lockoutTime', time);
}

// =========================================================================
// DATOS DE SESION
// =========================================================================
function getLoggedUser() { return sessionStorage.getItem('loggedUser') || ''; }
function getLoggedRole() { return sessionStorage.getItem('userRole') || ''; }
function getAllowedDevices() {
    try { return JSON.parse(sessionStorage.getItem('allowedDevices')) || []; }
    catch(e) { return []; }
}

// =========================================================================
// CARGA DE USUARIOS DESDE FIREBASE
// =========================================================================
let allUsersData = {};
let allUsersLoaded = false;

const usersRef = ref(db, 'users');
let usersFirstLoad = true;
onValue(usersRef, (snapshot) => {
    const data = snapshot.val();
    allUsersData = data || {};
    allUsersLoaded = true;

    if (!data || !data.admin) {
        initializeDefaultAdmin();
    }

    if (usersFirstLoad) {
        usersFirstLoad = false;
        checkLogin();
    }
}, (error) => {
    loginError.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Firebase fallo. Reintente.`;
    loginError.style.display = 'block';
});

async function initializeDefaultAdmin() {
    const defaultHash = await hashPassword("777888999");
    try {
        await update(ref(db), {
            'users/admin': {
                password_hash: defaultHash,
                role: 'admin',
                created_at: Date.now()
            }
        });
    } catch(e) {
        console.warn("No se pudo crear el admin por defecto:", e);
    }
}

// =========================================================================
// SISTEMA DE LOGIN
// =========================================================================
function checkLogin() {
    const isLogged = sessionStorage.getItem('isLogged') === 'true';
    const role = getLoggedRole();
    const username = getLoggedUser();

    if (isLogged) {
        loginScreen.style.display = 'none';
        devicesGridContainer.style.display = 'grid';
        if (adminActions) adminActions.style.display = 'flex';
        if (userInfoBar) {
            userInfoBar.style.display = 'flex';
            document.getElementById('ui-username').textContent = username;
            document.getElementById('ui-role').textContent = role === 'admin' ? 'Admin' : 'Usuario';
        }
        if (btnChangeCreds) btnChangeCreds.style.display = 'inline-flex';
        renderUserManagementButton();
        renderDevices();
    } else {
        loginScreen.style.display = 'block';
        devicesGridContainer.style.display = 'none';
        if (adminActions) adminActions.style.display = 'none';
        if (userInfoBar) userInfoBar.style.display = 'none';
        if (btnChangeCreds) btnChangeCreds.style.display = 'none';
        closeUsersModal();
    }
}

function renderUserManagementButton() {
    const container = document.getElementById('btn-users-container');
    if (!container) return;
    if (getLoggedRole() === 'admin') {
        container.innerHTML = `<button id="btn-manage-users" class="btn" style="width:auto;padding:0.75rem 2rem;"><i class="fa-solid fa-users"></i> Gestionar Usuarios</button>`;
        document.getElementById('btn-manage-users').addEventListener('click', openUsersModal);
    } else {
        container.innerHTML = '';
    }
}

btnLogin.addEventListener('click', async () => {
    const now = Date.now();
    const lockoutTime = getLockoutTime();
    const username = userInput.value.trim().toLowerCase();

    if (!username) {
        loginError.innerHTML = 'Ingresá un usuario.';
        loginError.style.display = 'block';
        return;
    }

    if (now < lockoutTime) {
        const waitMinutes = Math.ceil((lockoutTime - now) / 60000);
        loginError.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Bloqueado. Intentá en ${waitMinutes} min.`;
        loginError.style.display = 'block';
        return;
    }

    const inputHash = await hashPassword(passInput.value);
    const userData = allUsersData[username];

    if (userData && userData.password_hash === inputHash) {
        sessionStorage.setItem('isLogged', 'true');
        sessionStorage.setItem('loggedUser', username);
        sessionStorage.setItem('userRole', userData.role || 'user');
        if (userData.role === 'user' && userData.allowed_devices) {
            sessionStorage.setItem('allowedDevices', JSON.stringify(Object.keys(userData.allowed_devices)));
        } else {
            sessionStorage.setItem('allowedDevices', '[]');
        }
        setLockout(0, 0);
        loginError.style.display = 'none';
        passInput.value = '';
        userInput.value = '';
        checkLogin();
    } else {
        let attempts = getFailedAttempts() + 1;
        if (attempts >= 3) {
            setLockout(attempts, now + 5 * 60 * 1000);
            loginError.innerHTML = `<i class="fa-solid fa-shield"></i> Limite excedido. Bloqueo de 5 minutos.`;
        } else {
            setLockout(attempts, 0);
            loginError.innerHTML = `Usuario o clave incorrecta. Te quedan ${3 - attempts} intentos.`;
        }
        loginError.style.display = 'block';
    }
});

passInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') btnLogin.click(); });
userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') passInput.focus(); });
btnLogout.addEventListener('click', () => {
    sessionStorage.clear();
    checkLogin();
});

// =========================================================================
// CAMBIO DE USUARIO Y CLAVE (AMBOS ROLES)
// =========================================================================
btnChangeCreds.onclick = () => credsModal.classList.add('show');
document.getElementById('close-creds-modal').onclick = () => credsModal.classList.remove('show');

document.getElementById('btn-save-creds').addEventListener('click', async () => {
    const oldPass = document.getElementById('old-pass').value;
    const newUsername = document.getElementById('new-username').value.trim().toLowerCase();
    const newPass = document.getElementById('new-pass').value;
    const newPassRepeat = document.getElementById('new-pass-repeat').value;
    const currentUser = getLoggedUser();

    if (!oldPass) {
        showToast('Ingresá tu clave actual', 'error');
        return;
    }

    const oldHash = await hashPassword(oldPass);
    const currentUserData = allUsersData[currentUser];
    if (!currentUserData || currentUserData.password_hash !== oldHash) {
        showToast('La clave actual es incorrecta', 'error');
        return;
    }

    const updates = {};
    let usernameChanged = false;
    let newUserKey = currentUser;

    if (newUsername && newUsername !== currentUser) {
        if (newUsername.length < 3) {
            showToast('El nuevo usuario debe tener al menos 3 caracteres', 'error');
            return;
        }
        if (allUsersData[newUsername] && newUsername !== currentUser) {
            showToast('Ese nombre de usuario ya existe', 'error');
            return;
        }
        usernameChanged = true;
        newUserKey = newUsername;
    }

    if (newPass && newPass.length < 6) {
        showToast('La nueva clave debe tener minimo 6 caracteres', 'error');
        return;
    }

    if (newPass && newPass !== newPassRepeat) {
        showToast('Las claves nuevas no coinciden', 'error');
        return;
    }

    const finalHash = newPass ? await hashPassword(newPass) : currentUserData.password_hash;

    try {
        if (usernameChanged) {
            updates[`users/${newUserKey}`] = {
                password_hash: finalHash,
                role: currentUserData.role,
                created_at: currentUserData.created_at || Date.now()
            };
            if (currentUserData.allowed_devices) {
                updates[`users/${newUserKey}/allowed_devices`] = currentUserData.allowed_devices;
            }
            updates[`users/${currentUser}`] = null;
        } else {
            updates[`users/${currentUser}/password_hash`] = finalHash;
        }

        await update(ref(db), updates);
        sessionStorage.setItem('loggedUser', newUserKey);
        showToast('Datos actualizados correctamente', 'success');
        credsModal.classList.remove('show');
        document.getElementById('old-pass').value = '';
        document.getElementById('new-username').value = '';
        document.getElementById('new-pass').value = '';
        document.getElementById('new-pass-repeat').value = '';
        checkLogin();
    } catch(e) {
        showToast('Error al actualizar', 'error');
    }
});

// =========================================================================
// GESTION DE USUARIOS (SOLO ADMIN)
// =========================================================================
const usersModal = document.getElementById('users-modal');

function openUsersModal() {
    if (getLoggedRole() !== 'admin') return;
    renderUsersList();
    usersModal.classList.add('show');
}

function closeUsersModal() {
    usersModal.classList.remove('show');
}

document.getElementById('close-users-modal').onclick = closeUsersModal;

function renderUsersList() {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    let hasUsers = false;
    Object.keys(allUsersData).forEach(username => {
        if (username === 'admin') return;
        hasUsers = true;
        const user = allUsersData[username];
        const allowed = user.allowed_devices || {};
        const allowedList = Object.keys(allowed);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${username}</strong></td>
            <td>${allowedList.length > 0 ? allowedList.map(m => `<span class="device-tag">${m.slice(-6)}</span>`).join(' ') : '<span style="color:var(--text-secondary)">Sin equipos</span>'}</td>
            <td>
                <button class="btn btn-sm btn-primary edit-user-devices" data-user="${username}"><i class="fa-solid fa-gear"></i> Equipos</button>
                <button class="btn btn-sm btn-danger delete-user" data-user="${username}"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (!hasUsers) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-secondary)">No hay usuarios adicionales</td></tr>';
    }

    document.querySelectorAll('.delete-user').forEach(btn => {
        btn.addEventListener('click', async () => {
            const username = btn.dataset.user;
            if (confirm(`¿Eliminar definitivamente al usuario "${username}"?`)) {
                try {
                    await update(ref(db), { [`users/${username}`]: null });
                    showToast(`Usuario "${username}" eliminado`, 'success');
                } catch(e) {
                    showToast('Error al eliminar usuario', 'error');
                }
            }
        });
    });

    document.querySelectorAll('.edit-user-devices').forEach(btn => {
        btn.addEventListener('click', () => openDeviceAssignmentModal(btn.dataset.user));
    });
}

document.getElementById('btn-add-user').addEventListener('click', async () => {
    const newUsername = document.getElementById('new-user-name').value.trim().toLowerCase();
    const newPassword = document.getElementById('new-user-pass').value;

    if (!newUsername || newUsername.length < 3) {
        showToast('El usuario debe tener al menos 3 caracteres', 'error');
        return;
    }
    if (newUsername === 'admin') {
        showToast('"admin" es un nombre reservado', 'error');
        return;
    }
    if (allUsersData[newUsername]) {
        showToast('Ese usuario ya existe', 'error');
        return;
    }
    if (!newPassword || newPassword.length < 4) {
        showToast('La clave debe tener al menos 4 caracteres', 'error');
        return;
    }

    const passHash = await hashPassword(newPassword);
    try {
        await update(ref(db), {
            [`users/${newUsername}`]: {
                password_hash: passHash,
                role: 'user',
                allowed_devices: {},
                created_at: Date.now()
            }
        });
        showToast(`Usuario "${newUsername}" creado`, 'success');
        document.getElementById('new-user-name').value = '';
        document.getElementById('new-user-pass').value = '';
    } catch(e) {
        showToast('Error al crear usuario', 'error');
    }
});

// =========================================================================
// ASIGNACION DE EQUIPOS A USUARIO
// =========================================================================
const deviceAssignModal = document.getElementById('device-assign-modal');
let currentAssignUser = '';

function openDeviceAssignmentModal(username) {
    currentAssignUser = username;
    const checkboxesContainer = document.getElementById('device-checkboxes');
    checkboxesContainer.innerHTML = '';

    const userData = allUsersData[username];
    const allowed = userData && userData.allowed_devices ? userData.allowed_devices : {};

    if (!globalDevicesData || Object.keys(globalDevicesData).length === 0) {
        checkboxesContainer.innerHTML = '<p style="color:var(--text-secondary)">No hay equipos registrados. Espera que aparezcan en el panel.</p>';
    } else {
        Object.keys(globalDevicesData).forEach(mac => {
            const info = globalDevicesData[mac].info || {};
            const label = document.createElement('label');
            label.className = 'device-checkbox-label';
            label.innerHTML = `
                <input type="checkbox" value="${mac}" ${allowed[mac] ? 'checked' : ''}>
                <span>${info.name || 'Sin nombre'} <small>(${mac.slice(-8)})</small></span>
            `;
            checkboxesContainer.appendChild(label);
        });
    }

    document.getElementById('assign-username-display').textContent = username;
    deviceAssignModal.classList.add('show');
}

document.getElementById('close-assign-modal').onclick = () => deviceAssignModal.classList.remove('show');

document.getElementById('btn-save-devices').addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('#device-checkboxes input[type="checkbox"]');
    const allowedDevices = {};
    checkboxes.forEach(cb => {
        if (cb.checked) allowedDevices[cb.value] = true;
    });

    try {
        await update(ref(db), {
            [`users/${currentAssignUser}/allowed_devices`]: allowedDevices
        });
        showToast(`Equipos asignados a "${currentAssignUser}"`, 'success');
        deviceAssignModal.classList.remove('show');
    } catch(e) {
        showToast('Error al guardar asignaciones', 'error');
    }
});

// =========================================================================
// ESCUCHAR DISPOSITIVOS (REALTIME)
// =========================================================================
const devicesRef = ref(db, 'devices');
onValue(devicesRef, (snapshot) => {
    const data = snapshot.val();
    globalDevicesData = data || {};

    if (!data || Object.keys(data).length === 0) {
        grid.innerHTML = '<div class="loading-state"><p>No se encontraron dispositivos registrados.</p></div>';
        return;
    }

    renderDevices();
}, (error) => {
    console.error("Error al leer Firebase:", error);
    grid.innerHTML = `<div class="loading-state"><p style="color:var(--danger-color)">Error de conexion.</p></div>`;
});

function renderDevices() {
    grid.innerHTML = '';

    const data = globalDevicesData;
    if (!data || Object.keys(data).length === 0) {
        grid.innerHTML = '<div class="loading-state"><p>No se encontraron dispositivos registrados.</p></div>';
        return;
    }

    const now = Math.floor(Date.now() / 1000);
    const role = getLoggedRole();
    const allowedDevices = getAllowedDevices();
    const isAdmin = role === 'admin';
    let anyRendered = false;

    Object.keys(data).forEach(mac => {
        if (!isAdmin && !allowedDevices.includes(mac)) return;

        anyRendered = true;
        const device = data[mac];
        const info = device.info || {};
        const stats = device.stats || {};
        const cfg = device.config || {};

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
                    <span class="stat-label"><i class="fa-solid fa-layer-group"></i> Piso</span>
                    <span class="stat-value">${cfg.piso || 1}</span>
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
                <i class="fa-solid fa-gear"></i> ${isAdmin ? 'Configurar Maquina' : 'Ver Maquina'}
            </button>
        `;
        grid.appendChild(card);
    });

    if (!anyRendered) {
        if (isAdmin) {
            grid.innerHTML = '<div class="loading-state"><p>No hay dispositivos registrados en Firebase.</p></div>';
        } else {
            grid.innerHTML = '<div class="loading-state"><p>No tenes equipos asignados. Contacta al administrador.</p></div>';
        }
    }
}

// =========================================================================
// MODAL DE CONFIGURACION
// =========================================================================
window.openConfig = function (mac) {
    const device = globalDevicesData[mac];
    if (!device) return;

    const info = device.info || {};
    const cfg = device.config || {};
    const stats = device.stats || {};
    const isAdmin = getLoggedRole() === 'admin';

    document.getElementById('edit-mac').value = mac;
    document.getElementById('cfg_name').value = info.name || '';
    document.getElementById('cfg_piso').value = cfg.piso || 1;
    document.getElementById('cfg_precio_pulso').value = cfg.precio_pulso || 100;
    document.getElementById('cfg_pesos_1h').value = cfg.pesos_1h || 10;
    document.getElementById('cfg_demo_qr').checked = cfg.demo_qr || false;
    document.getElementById('cfg_max_usos').value = cfg.max_usos_demo || 110;
    
    const cfgAlerta = document.getElementById('cfg_alerta_70');
    if (cfgAlerta) cfgAlerta.checked = cfg.alerta_70_billetes || false;

    const cfgAutoQR = document.getElementById('cfg_auto_100_qr');
    if (cfgAutoQR) cfgAutoQR.checked = cfg.auto_100_qr || false;

    const cfgAutoBilletero = document.getElementById('cfg_auto_100_billetero');
    if (cfgAutoBilletero) cfgAutoBilletero.checked = cfg.auto_100_billetero || false;

    // Stats QR (solo lectura en pestaña Promo QR)
    const qrRec = document.getElementById('qr_recaudacion');
    if (qrRec) qrRec.value = '$' + ((stats.monto_total_qr || 0).toLocaleString());
    const qrUsos = document.getElementById('qr_usos');
    if (qrUsos) qrUsos.value = stats.usos_qr || 0;

    const horas = cfg.horas || [0, 0, 0, 0];
    const pesos = cfg.pesos || [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
        document.getElementById(`cfg_h${i}`).value = horas[i];
        document.getElementById(`cfg_p${i}`).value = pesos[i];
    }

    const salas = (cfg.salas || Array(20).fill(0)).map(v => Math.max(0, Math.min(31, parseInt(v) || 0)));
    for (let i = 0; i < 20; i++) {
        const input = document.getElementById(`cfg_s${i}`);
        if (input) input.value = salas[i];
    }

    const billetes = stats.billetes || [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
        const el = document.getElementById(`hist_bill${i}`);
        if (el) el.textContent = (billetes[i] || 0).toLocaleString();
    }

    let historial = [];
    if (stats.historial) {
        if (Array.isArray(stats.historial)) {
            historial = stats.historial;
        } else {
            const entries = Object.entries(stats.historial);
            entries.sort((a, b) => a[0].localeCompare(b[0]));
            historial = entries.map(e => e[1]);
        }
    }
    historial = historial.slice(-100).reverse();
    const tbody = document.getElementById('hist_table_body');
    if (tbody) {
        if (historial.length === 0 || historial.every(t => (t.sala || 0) === 0 && (t.hora || 0) === 0)) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color: var(--text-secondary);">Sin datos aun</td></tr>';
        } else {
            tbody.innerHTML = '';
            historial.forEach((t, idx) => {
                const sala = t.sala || 0;
                const hora = t.hora || 0;
                if (sala === 0 && hora === 0) return;
                
                const fecha = t.fecha || '---';
                const b500 = t.b500 || 0;
                const b1000 = t.b1000 || 0;
                const b2000 = t.b2000 || 0;
                const b10000 = t.b10000 || 0;
                const total = t.total || 0;
                
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${idx + 1}</td><td>${fecha}</td><td>${sala}</td><td>${hora}h</td><td>${b500}</td><td>${b1000}</td><td>${b2000}</td><td>${b10000}</td><td>$${total}</td>`;
                tbody.appendChild(tr);
            });
            if (tbody.children.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color: var(--text-secondary);">Sin datos aun</td></tr>';
            }
        }
    }

    let historial_qr = [];
    if (stats.historial_qr) {
        if (Array.isArray(stats.historial_qr)) {
            historial_qr = stats.historial_qr;
        } else {
            const entries = Object.entries(stats.historial_qr);
            entries.sort((a, b) => a[0].localeCompare(b[0]));
            historial_qr = entries.map(e => e[1]);
        }
    }
    historial_qr = historial_qr.slice(-100).reverse();
    const qrTbody = document.getElementById('qr_table_body');
    if (qrTbody) {
        if (historial_qr.length === 0 || historial_qr.every(t => (t.sala || 0) === 0 && (t.horas || t.hora || 0) === 0 && (t.total || 0) === 0)) {
            qrTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-secondary);">Sin datos aun</td></tr>';
        } else {
            qrTbody.innerHTML = '';
            historial_qr.forEach((t, idx) => {
                const fecha = t.fecha || '---';
                const sala = t.sala || 0;
                const horas = t.horas || t.hora || 0;
                const total = t.total || 0;
                if (sala === 0 && horas === 0 && total === 0) return;
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${idx + 1}</td><td>${fecha}</td><td>${sala}</td><td>${horas}h</td><td>$${total}</td>`;
                qrTbody.appendChild(tr);
            });
            if (qrTbody.children.length === 0) {
                qrTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-secondary);">Sin datos aun</td></tr>';
            }
        }
    }

    applyRoleBasedConfigUI(isAdmin);
    modal.classList.add('show');
};

function applyRoleBasedConfigUI(isAdmin) {
    document.querySelectorAll('.modal-tabs .tab-btn').forEach(btn => btn.style.display = '');

    // Reset visibilidad de botones admin
    ['btn-reset-inicios', 'btn-reset-billetes', 'btn-reset-historial', 'btn-reset-qr'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.style.display = isAdmin ? '' : 'none';
    });

    if (!isAdmin) {
        // En vez de ocultar pestañas, deshabilitamos campos.
        // Ocultar elementos especificos de QR
        const groupMaxUsos = document.getElementById('group_max_usos');
        if (groupMaxUsos) groupMaxUsos.style.display = 'none';
        
        const demoQrToggle = document.getElementById('cfg_demo_qr');
        if (demoQrToggle) {
            demoQrToggle.disabled = true;
            demoQrToggle.closest('.toggle-group').style.display = 'none';
        }

        // Bloquear Piso
        const pisoInput = document.getElementById('cfg_piso');
        if (pisoInput) pisoInput.readOnly = true;

        // Bloquear Nombre
        const nameInput = document.getElementById('cfg_name');
        if (nameInput) nameInput.readOnly = true;

        // Bloquear Tarifas
        document.querySelectorAll('#tab-tarifas input').forEach(input => {
            input.readOnly = true;
        });

        // Bloquear Salas
        document.querySelectorAll('#tab-salas input').forEach(input => {
            input.readOnly = true;
        });
    } else {
        // Revertir para admin
        const groupMaxUsos = document.getElementById('group_max_usos');
        if (groupMaxUsos) groupMaxUsos.style.display = '';
        
        const demoQrToggle = document.getElementById('cfg_demo_qr');
        if (demoQrToggle) {
            demoQrToggle.disabled = false;
            demoQrToggle.closest('.toggle-group').style.display = '';
        }

        const pisoInput = document.getElementById('cfg_piso');
        if (pisoInput) pisoInput.readOnly = false;

        const nameInput = document.getElementById('cfg_name');
        if (nameInput) nameInput.readOnly = false;

        document.querySelectorAll('#tab-tarifas input').forEach(input => input.readOnly = false);
        document.querySelectorAll('#tab-salas input').forEach(input => input.readOnly = false);
    }

    const tariffsInputs = document.querySelectorAll('#tab-tarifas input');
    tariffsInputs.forEach(input => {
        if (!isAdmin) {
            input.readOnly = false;
            input.style.opacity = '1';
        } else {
            input.readOnly = false;
            input.style.opacity = '1';
        }
    });

    const saveBtn = document.querySelector('.form-actions .btn-primary');
    if (saveBtn) {
        saveBtn.style.display = '';
        saveBtn.innerHTML = isAdmin
            ? '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios'
            : '<i class="fa-solid fa-floppy-disk"></i> Guardar Piso y Tarifas';
    }
}

closeModal.onclick = () => modal.classList.remove('show');
window.onclick = (e) => {
    if (e.target === modal) modal.classList.remove('show');
    if (e.target === usersModal) closeUsersModal();
    if (e.target === deviceAssignModal) deviceAssignModal.classList.remove('show');
    if (e.target === credsModal) credsModal.classList.remove('show');
};

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// Toggle demo QR
const toggleDemo = document.getElementById('cfg_demo_qr');
const groupUsos = document.getElementById('group_max_usos');
if (toggleDemo) {
    toggleDemo.addEventListener('change', (e) => {
        groupUsos.style.opacity = e.target.checked ? '1' : '0.5';
        document.getElementById('cfg_max_usos').disabled = !e.target.checked;
    });
}

// Guardar configuracion (admin siempre; para usuarios solo piso y reboot)
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mac = document.getElementById('edit-mac').value;
    const isAdmin = getLoggedRole() === 'admin';

    if (isAdmin) {
        const errores = obtenerErroresTarifas();
        if (errores.length > 0) {
            showToast('Corregi las tarifas: ' + errores[0], 'error');
            return;
        }
    }

    const updates = {};

    const configPath = `devices/${mac}/config`;
    
    // Todos pueden guardar Billetero y ciertas partes de QR
    const cfgAlerta = document.getElementById('cfg_alerta_70');
    if (cfgAlerta) updates[`${configPath}/alerta_70_billetes`] = cfgAlerta.checked;

    const cfgAutoQR = document.getElementById('cfg_auto_100_qr');
    if (cfgAutoQR) updates[`${configPath}/auto_100_qr`] = cfgAutoQR.checked;

    const cfgAutoBilletero = document.getElementById('cfg_auto_100_billetero');
    if (cfgAutoBilletero) updates[`${configPath}/auto_100_billetero`] = cfgAutoBilletero.checked;

    if (isAdmin) {
        updates[`devices/${mac}/info/name`] = document.getElementById('cfg_name').value;

        const horas = [], pesos = [], salas = [];
        for (let i = 0; i < 4; i++) {
            horas.push(parseInt(document.getElementById(`cfg_h${i}`).value) || 0);
            pesos.push(parseInt(document.getElementById(`cfg_p${i}`).value) || 0);
        }
        for (let i = 0; i < 20; i++) {
            const v = parseInt(document.getElementById(`cfg_s${i}`).value) || 0;
            salas.push(Math.max(0, Math.min(31, v)));
        }

        updates[`${configPath}/piso`] = parseInt(document.getElementById('cfg_piso').value) || 1;
        updates[`${configPath}/precio_pulso`] = Math.max(0, parseInt(document.getElementById('cfg_precio_pulso').value) || 100);
        updates[`${configPath}/pesos_1h`] = Math.max(0, parseInt(document.getElementById('cfg_pesos_1h').value) || 10);
        updates[`${configPath}/demo_qr`] = document.getElementById('cfg_demo_qr').checked;
        updates[`${configPath}/max_usos_demo`] = parseInt(document.getElementById('cfg_max_usos').value) || 110;
        
        updates[`${configPath}/horas`] = horas.map(v => Math.max(0, v));
        updates[`${configPath}/pesos`] = pesos.map(v => Math.max(0, v));
        updates[`${configPath}/salas`] = salas;
    }

    try {
        await update(ref(db), updates);
        showToast('Configuracion guardada exitosamente.', 'success');
        modal.classList.remove('show');
    } catch (error) {
        console.error("Error guardando:", error);
        showToast('Error al guardar configuracion.', 'error');
    }
});

// Reiniciar (admin + usuarios limitados)
document.getElementById('btn-reboot').addEventListener('click', async () => {
    const mac = document.getElementById('edit-mac').value;
    if (confirm('¿Estas seguro que queres forzar el reinicio de este ESP32? Interrumpira transacciones en curso.')) {
        try {
            await update(ref(db), { [`devices/${mac}/info/reboot`]: true });
            showToast('Comando de reinicio enviado.', 'success');
            modal.classList.remove('show');
        } catch (error) {
            showToast('Error al enviar reinicio.', 'error');
        }
    }
});

// Boton Reset Inicios (admin solo)
document.getElementById('btn-reset-inicios').addEventListener('click', async () => {
    if (getLoggedRole() !== 'admin') return;
    const mac = document.getElementById('edit-mac').value;
    if (confirm('¿Resetear el contador de inicios a 0?')) {
        try {
            await update(ref(db), { [`devices/${mac}/config/reset_inicios`]: true });
            showToast('Contador de inicios reseteado.', 'success');
        } catch (error) {
            showToast('Error al resetear inicios.', 'error');
        }
    }
});

// Boton Reset Billetes (admin solo)
document.getElementById('btn-reset-billetes').addEventListener('click', async () => {
    if (getLoggedRole() !== 'admin') return;
    const mac = document.getElementById('edit-mac').value;
    if (confirm('¿Resetear el contador de billetes a 0?')) {
        try {
            await update(ref(db), { [`devices/${mac}/config/reset_billetes`]: true });
            showToast('Contador de billetes reseteado.', 'success');
        } catch (error) {
            showToast('Error al resetear billetes.', 'error');
        }
    }
});

// Boton Reset Historial (admin solo)
document.getElementById('btn-reset-historial').addEventListener('click', async () => {
    if (getLoggedRole() !== 'admin') return;
    const mac = document.getElementById('edit-mac').value;
    if (confirm('¿Resetear el historial de transacciones?')) {
        try {
            await update(ref(db), { [`devices/${mac}/config/reset_historial`]: true });
            showToast('Historial de transacciones reseteado.', 'success');
        } catch (error) {
            showToast('Error al resetear historial.', 'error');
        }
    }
});

// Boton Reset Usos QR (admin solo)
document.getElementById('btn-reset-qr').addEventListener('click', async () => {
    if (getLoggedRole() !== 'admin') return;
    const mac = document.getElementById('edit-mac').value;
    if (confirm('¿Resetear el contador de usos QR y el historial a 0?')) {
        try {
            await update(ref(db), { 
                [`devices/${mac}/config/reset_usos_qr`]: true,
                [`devices/${mac}/config/reset_historial_qr`]: true 
            });
            showToast('Contador e historial QR reseteados.', 'success');
        } catch (error) {
            showToast('Error al resetear usos QR.', 'error');
        }
    }
});

// Botones de Email
document.getElementById('btn-config-email-alerta').addEventListener('click', async () => {
    const mac = document.getElementById('edit-mac').value;
    const device = globalDevicesData[mac];
    if (!device) return;
    const currentEmail = (device.config && device.config.email_aviso) || '';
    const newEmail = prompt('Ingresa el correo electronico para la Alerta de 70 Billetes (puedes usar multiples correos separandolos por comas):', currentEmail);
    if (newEmail !== null) {
        try {
            await update(ref(db), { [`devices/${mac}/config/email_aviso`]: newEmail });
            showToast('Email de Alerta configurado.', 'success');
        } catch (error) {
            showToast('Error al guardar el email.', 'error');
        }
    }
});

document.getElementById('btn-config-email-historial').addEventListener('click', async () => {
    const mac = document.getElementById('edit-mac').value;
    const device = globalDevicesData[mac];
    if (!device) return;
    const currentEmail = (device.config && device.config.email_billetero) || '';
    const newEmail = prompt('Ingresa el correo electronico para reportes del Billetero (puedes usar multiples correos separandolos por comas):', currentEmail);
    if (newEmail !== null) {
        try {
            await update(ref(db), { [`devices/${mac}/config/email_billetero`]: newEmail });
            showToast('Email de Billetero configurado.', 'success');
        } catch (error) {
            showToast('Error al guardar el email.', 'error');
        }
    }
});

document.getElementById('btn-config-email-qr').addEventListener('click', async () => {
    const mac = document.getElementById('edit-mac').value;
    const device = globalDevicesData[mac];
    if (!device) return;
    const currentEmail = (device.config && device.config.email_qr) || '';
    const newEmail = prompt('Ingresa el correo electronico para reportes de Promo QR (puedes usar multiples correos separandolos por comas):', currentEmail);
    if (newEmail !== null) {
        try {
            await update(ref(db), { [`devices/${mac}/config/email_qr`]: newEmail });
            showToast('Email de QR configurado.', 'success');
        } catch (error) {
            showToast('Error al guardar el email.', 'error');
        }
    }
});

document.getElementById('btn-send-table').addEventListener('click', async () => {
    const mac = document.getElementById('edit-mac').value;
    const device = globalDevicesData[mac];
    if (!device) return;
    const email = (device.config && device.config.email_billetero) || '';
    if (!email) {
        showToast('Primero debes configurar el email de Billetero.', 'error');
        return;
    }
    let historial = [];
    if (device.stats && device.stats.historial) {
        if (Array.isArray(device.stats.historial)) historial = device.stats.historial;
        else {
            const entries = Object.entries(device.stats.historial);
            entries.sort((a, b) => a[0].localeCompare(b[0]));
            historial = entries.map(e => e[1]);
        }
    }
    historial = historial.slice(-100).reverse();
    let tableText = 'Historial de Transacciones (Billetero):\n\n';
    tableText += 'N | Fecha | Sala | Horas | $500 | $1k | $2k | $10k | Total\n';
    tableText += '-----------------------------------------------------------\n';
    historial.forEach((t, i) => {
        if ((t.sala || 0) === 0 && (t.hora || 0) === 0) return;
        tableText += `${i+1} | ${t.fecha || '---'} | ${t.sala || 0} | ${t.hora || 0}h | ${t.b500 || 0} | ${t.b1000 || 0} | ${t.b2000 || 0} | ${t.b10000 || 0} | $${t.total || 0}\n`;
    });
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwC60E2OLbqbO7qpXej22xwkTnn15GQzrUObd76D8bGmPG8n0qwhbLE41zbF8TYrHEf/exec";
    const btn = document.getElementById('btn-send-table');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
    
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                email: email,
                asunto: 'Reporte de Historial - Billetero',
                mensaje: tableText
            })
        });
        const result = await response.text();
        if (result.includes('Exito')) showToast('Tabla enviada exitosamente por email.', 'success');
        else showToast('Error al enviar la tabla: ' + result, 'error');
    } catch (error) {
        showToast('Error de conexion al enviar email.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-envelope-open-text"></i> Enviar Tabla por Email';
    }
});

document.getElementById('btn-send-table-qr').addEventListener('click', async () => {
    const mac = document.getElementById('edit-mac').value;
    const device = globalDevicesData[mac];
    if (!device) return;
    const email = (device.config && device.config.email_qr) || '';
    if (!email) {
        showToast('Primero debes configurar el email de QR.', 'error');
        return;
    }
    let historial_qr = [];
    if (device.stats && device.stats.historial_qr) {
        if (Array.isArray(device.stats.historial_qr)) historial_qr = device.stats.historial_qr;
        else {
            const entries = Object.entries(device.stats.historial_qr);
            entries.sort((a, b) => a[0].localeCompare(b[0]));
            historial_qr = entries.map(e => e[1]);
        }
    }
    historial_qr = historial_qr.slice(-100).reverse();
    let tableText = 'Historial de Transacciones (Promo QR):\n\n';
    tableText += 'N | Fecha | Sala | Horas | Total\n';
    tableText += '----------------------------------------\n';
    historial_qr.forEach((t, i) => {
        const fecha = t.fecha || '---';
        const sala = t.sala || 0;
        const horas = t.horas || t.hora || 0;
        const total = t.total || 0;
        if (sala === 0 && horas === 0 && total === 0) return;
        tableText += `${i+1} | ${fecha} | ${sala} | ${horas}h | $${total}\n`;
    });
    
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwC60E2OLbqbO7qpXej22xwkTnn15GQzrUObd76D8bGmPG8n0qwhbLE41zbF8TYrHEf/exec";
    const btn = document.getElementById('btn-send-table-qr');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
    
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                email: email,
                asunto: 'Reporte de Historial - Promo QR',
                mensaje: tableText
            })
        });
        const result = await response.text();
        if (result.includes('Exito')) showToast('Tabla enviada exitosamente por email.', 'success');
        else showToast('Error al enviar la tabla: ' + result, 'error');
    } catch (error) {
        showToast('Error de conexion al enviar email.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-envelope-open-text"></i> Enviar Tabla por Email';
    }
});

// =========================================================================
// TOASTS
// =========================================================================
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
