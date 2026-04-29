import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

// =========================================================================
// CONFIGURACIÓN DE FIREBASE (¡Completar con los datos del Paso 2 y 4!)
// =========================================================================
const firebaseConfig = {
    apiKey: "PEGAR_AQUI_TU_API_KEY",
    databaseURL: "https://PEGAR-AQUI-TU-URL.firebaseio.com",
    projectId: "PEGAR-AQUI-TU-PROJECT-ID",
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
window.openConfig = function(mac) {
    const device = globalDevicesData[mac];
    if (!device) return;

    const info = device.info || {};
    const cfg = device.config || {};

    // Cargar datos al formulario
    document.getElementById('edit-mac').value = mac;
    document.getElementById('cfg_name').value = info.name || '';
    document.getElementById('cfg_piso').value = cfg.piso || 1;
    document.getElementById('cfg_precio_pulso').value = cfg.precio_pulso || 100;
    document.getElementById('cfg_pesos_1h').value = cfg.pesos_1h || 10;
    
    document.getElementById('cfg_demo_qr').checked = cfg.demo_qr || false;
    document.getElementById('cfg_max_usos').value = cfg.max_usos_demo || 100;

    const horas = cfg.horas || [0,0,0,0];
    const pesos = cfg.pesos || [0,0,0,0];
    for(let i=0; i<4; i++){
        document.getElementById(`cfg_h${i}`).value = horas[i];
        document.getElementById(`cfg_p${i}`).value = pesos[i];
    }

    const salas = cfg.salas || Array(20).fill(0);
    for(let i=0; i<20; i++){
        const input = document.getElementById(`cfg_s${i}`);
        if(input) input.value = salas[i];
    }

    modal.classList.add('show');
};

closeModal.onclick = () => modal.classList.remove('show');
window.onclick = (e) => { if(e.target === modal) modal.classList.remove('show'); };

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
    for(let i=0; i<4; i++){
        horas.push(parseInt(document.getElementById(`cfg_h${i}`).value) || 0);
        pesos.push(parseInt(document.getElementById(`cfg_p${i}`).value) || 0);
    }
    for(let i=0; i<20; i++){
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
    if(confirm('¿Estás seguro que querés forzar el reinicio de este ESP32? Interrumpirá transacciones en curso.')){
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
        if(container.contains(toast)) container.removeChild(toast);
    }, 3000);
}
