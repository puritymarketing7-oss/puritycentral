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
        div.innerHTML = `<label>S${i + 1}</label><input type="number" id="cfg_s${i}" value="0">`;
        salasContainer.appendChild(div);
    }
}
initSalasInputs();

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
                    <span class="stat-label"><i class="fa-solid fa-sack-dollar"></i> Recaudacion QR</span>
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

    const billetes = stats.billetes || [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
        const el = document.getElementById(`hist_bill${i}`);
        if (el) el.textContent = (billetes[i] || 0).toLocaleString();
    }

    const historial = stats.historial || [];
    const tbody = document.getElementById('hist_table_body');
    if (tbody) {
        if (historial.length === 0 || historial.every(t => (t.sala || 0) === 0 && (t.hora || 0) === 0)) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--text-secondary);">Sin datos aun</td></tr>';
        } else {
            tbody.innerHTML = '';
            historial.forEach((t, idx) => {
                const sala = t.sala || 0;
                const hora = t.hora || 0;
                if (sala === 0 && hora === 0) return;
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${idx + 1}</td><td>${sala}</td><td>${hora}h</td>`;
                tbody.appendChild(tr);
            });
            if (tbody.children.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--text-secondary);">Sin datos aun</td></tr>';
            }
        }
    }

    applyRoleBasedConfigUI(isAdmin);
    modal.classList.add('show');
};

function applyRoleBasedConfigUI(isAdmin) {
    document.querySelectorAll('.modal-tabs .tab-btn').forEach(btn => btn.style.display = '');

    if (!isAdmin) {
        document.querySelectorAll('.tab-btn[data-tab="tab-salas"]').forEach(b => b.style.display = 'none');
        document.querySelectorAll('.tab-btn[data-tab="tab-qr"]').forEach(b => b.style.display = 'none');

        document.querySelectorAll('.modal-tabs .tab-btn').forEach(b => {
            if (!b.classList.contains('active') && b.style.display === 'none') {
                b.classList.remove('active');
            }
        });

        const activeTab = document.querySelector('.tab-btn.active');
        if (!activeTab || activeTab.style.display === 'none') {
            const firstVisible = document.querySelector('.tab-btn:not([style*="display: none"])');
            if (firstVisible) {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                firstVisible.classList.add('active');
                document.getElementById(firstVisible.dataset.tab).classList.add('active');
            }
        }
    }

    const formGroups = document.querySelectorAll('#tab-general .form-group');
    formGroups.forEach(group => {
        if (!isAdmin && group.querySelector('#cfg_name')) {
            const input = group.querySelector('input');
            if (input) input.readOnly = true;
        }
    });

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

    const updates = {};

    if (isAdmin) {
        updates[`devices/${mac}/info/name`] = document.getElementById('cfg_name').value;

        const horas = [], pesos = [], salas = [];
        for (let i = 0; i < 4; i++) {
            horas.push(parseInt(document.getElementById(`cfg_h${i}`).value) || 0);
            pesos.push(parseInt(document.getElementById(`cfg_p${i}`).value) || 0);
        }
        for (let i = 0; i < 20; i++) {
            salas.push(parseInt(document.getElementById(`cfg_s${i}`).value) || 0);
        }

        const configPath = `devices/${mac}/config`;
        updates[`${configPath}/piso`] = parseInt(document.getElementById('cfg_piso').value) || 1;
        updates[`${configPath}/precio_pulso`] = parseInt(document.getElementById('cfg_precio_pulso').value) || 100;
        updates[`${configPath}/pesos_1h`] = parseInt(document.getElementById('cfg_pesos_1h').value) || 10;
        updates[`${configPath}/demo_qr`] = document.getElementById('cfg_demo_qr').checked;
        updates[`${configPath}/max_usos_demo`] = parseInt(document.getElementById('cfg_max_usos').value) || 100;
        updates[`${configPath}/horas`] = horas;
        updates[`${configPath}/pesos`] = pesos;
        updates[`${configPath}/salas`] = salas;
    } else {
        const horas = [], pesos = [];
        for (let i = 0; i < 4; i++) {
            horas.push(parseInt(document.getElementById(`cfg_h${i}`).value) || 0);
            pesos.push(parseInt(document.getElementById(`cfg_p${i}`).value) || 0);
        }
        const configPath = `devices/${mac}/config`;
        updates[`${configPath}/piso`] = parseInt(document.getElementById('cfg_piso').value) || 1;
        updates[`${configPath}/precio_pulso`] = parseInt(document.getElementById('cfg_precio_pulso').value) || 100;
        updates[`${configPath}/pesos_1h`] = parseInt(document.getElementById('cfg_pesos_1h').value) || 10;
        updates[`${configPath}/horas`] = horas;
        updates[`${configPath}/pesos`] = pesos;
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

// Reiniciar (ambos roles)
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
