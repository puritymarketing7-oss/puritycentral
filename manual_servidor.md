# Manual de Montaje del Servidor Central (Firebase)

Este manual te guiará paso a paso para configurar el "cerebro" en la nube de tu sistema de ESP32s. Utilizaremos **Firebase Realtime Database**, un servicio gratuito de Google que permite la comunicación instantánea entre tu Panel Web y todas tus máquinas.

## Requisitos Previos
- **Cuenta de Google:** Sí, es estrictamente necesaria. Podés usar tu cuenta personal de Gmail o crear una nueva específicamente para tu negocio (ej. `tuempresa.sistema@gmail.com`).
- **Navegador Web:** Chrome, Firefox o Edge.

---

## Paso 1: Crear el Proyecto en Firebase

1. Ingresá a [Firebase Console](https://console.firebase.google.com/) e iniciá sesión con la cuenta de Google que elegiste.
2. Hacé clic en el botón gigante **"Agregar proyecto"** (o "Crear un proyecto").
3. Escribí un nombre para tu proyecto, por ejemplo: `Control-ESP32-Central`.
4. Te preguntará si querés habilitar Google Analytics. Podés **deshabilitarlo** (apagar el interruptor) ya que no lo necesitamos para este proyecto. Clic en **"Crear proyecto"**.
5. Esperá un minuto hasta que diga "Tu proyecto nuevo está listo" y hacé clic en **"Continuar"**.

---

## Paso 2: Crear la Base de Datos en Tiempo Real (Realtime Database)

1. En el menú de la izquierda de la consola de Firebase, buscá la sección **"Compilación"** (Build) y hacé clic en **"Realtime Database"**.
2. Hacé clic en el botón **"Crear base de datos"**.
3. **Ubicación:** Elegí la que esté más cerca tuyo (usualmente `us-central1` en Estados Unidos funciona perfecto para toda América). Clic en "Siguiente".
4. **Reglas de seguridad:** Elegí **"Comenzar en modo de prueba"** (Start in test mode). Esto permite que el ESP32 y tu página web puedan leer y escribir sin un sistema complejo de usuarios y contraseñas por ahora.
   > ⚠️ **Nota de seguridad:** El modo de prueba dura 30 días. Más adelante en este manual te explicamos cómo dejar la base de datos abierta permanentemente pero protegida.
5. Clic en **"Habilitar"**.

¡Listo! Vas a ver una pantalla con una URL (un enlace) que se ve algo así como:
`https://control-esp32-central-default-rtdb.firebaseio.com/`
**👉 Copiá y guardá esa URL**, la vamos a necesitar para el código del ESP32.

---

## Paso 3: Configurar el Acceso Permanente (Reglas)

Como el "Modo de Prueba" expira en 30 días, vamos a cambiar las reglas para que el sistema no deje de funcionar repentinamente.

1. En la misma pantalla de "Realtime Database", hacé clic en la pestaña **"Reglas"** (Rules).
2. Vas a ver un código parecido a este:
   ```json
   {
     "rules": {
       ".read": "now < 1720000000000",
       ".write": "now < 1720000000000"
     }
   }
   ```
3. **Borrable todo y cambialo por esto:**
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
4. Hacé clic en el botón azul **"Publicar"**. Te saldrá una advertencia roja diciendo que "Tus reglas de seguridad están definidas como públicas". **Ignorala**, está bien para nuestro caso de uso cerrado donde solo vos tenés la dirección de la página web.

---

## Paso 4: Obtener la "API Key" para el Panel Web

Ahora necesitamos generar una "llave" para que nuestra página web sepa a qué base de datos conectarse.

1. En el menú de la izquierda, arriba de todo, hacé clic en el ícono de la **Rueda de engranaje ⚙️** (Configuración) y elegí **"Configuración del proyecto"**.
2. Bajá hasta la sección que dice "Tus apps". Va a decir que "No hay apps en tu proyecto".
3. Hacé clic en el ícono redondo que tiene los símbolos **`</>`** (Este es el ícono para aplicaciones Web).
4. **Apodo de la app:** Escribí `Panel Web` y hacé clic en **"Registrar app"**.
   *(No marques la casilla de Firebase Hosting por ahora).*
5. Te va a mostrar un bloque de código. Solo nos interesa encontrar una línea específica que dice `apiKey`. Se verá más o menos así:
   `apiKey: "AIzaSyBxxxxxxx_yyyyyyyyyyyyyyy",`
6. **👉 Copiá y guardá ese código alfanumérico largo** (sin las comillas). Esta es tu **API KEY**.

---

## Paso 5: Alojar (Subir a Internet) el Panel Web

Tu carpeta `servercentral` contiene los archivos `index.html`, `style.css` y `app.js`. Para poder abrir el panel desde tu celular en la calle, necesitás subirlos a internet.

La forma más fácil y 100% gratuita es usar **Vercel** o **GitHub Pages**:

### Método Recomendado: Usando GitHub y Vercel (Paso a Paso)

Este es el método más seguro y profesional. Cada vez que actualices tus archivos en la nube (GitHub), tu página (Vercel) se actualizará automáticamente.

**Fase 1: Subir tu código a GitHub**
1. Ve a [github.com](https://github.com/) y crea una cuenta (haz clic en "Sign up").
2. Una vez dentro, haz clic en el botón verde **"New"** (o "Create repository").
3. En **"Repository name"**, ponle un nombre a tu panel (ej. `panel-central-esp32`), déjalo en **Public** y haz clic en el botón verde **"Create repository"**.
4. En la siguiente pantalla, haz clic en el pequeño enlace que dice **"uploading an existing file"**.
5. Arrastra todos los archivos de tu carpeta `servercentral` (que son `index.html`, `style.css` y `app.js`) a esa ventana.
6. Espera que carguen, baja y haz clic en el botón verde **"Commit changes"**. ¡Tu código ya está en internet!

**Fase 2: Conectar y Publicar con Vercel**
1. Ve a [vercel.com](https://vercel.com/) y asegúrate de tener una cuenta iniciada.
2. En el panel principal, haz clic en el botón negro **"Add New..."** (arriba a la derecha) y selecciona **"Project"**.
3. En el panel izquierdo "Import Git Repository", haz clic para conectar con GitHub (suele decir **"Continue with GitHub"**) y acepta los permisos.
4. Ahora verás el repositorio que creaste recién (ej. `panel-central-esp32`). Haz clic en el botón **"Import"** que está a su lado.
5. Te llevará a la pantalla de configuración final. No toques nada, simplemente haz clic en el botón azul **"Deploy"**.
6. ¡Listo! Tras unos segundos de carga, verás la celebración en pantalla y Vercel te dará el enlace web público permanente (ej. `panel-central-esp32.vercel.app`). Guarda ese enlace en tu celular.

## Resumen de Datos que necesitás poner en tu Código

Para que el sistema funcione, vas a tener que abrir el archivo `app.js` (del panel web) y el `esp32nextionqr.ino` (del ESP32) e insertar estos dos datos que acabás de conseguir:

1. **URL DE LA BASE DE DATOS** (Del Paso 2)
2. **API KEY** (Del Paso 4)

¡Eso es todo el montaje del servidor! Firebase se encargará de mantener la conexión viva entre tus páginas web abiertas y todas las máquinas.


# CENTRAL CUENTA DE GOOGLE

puritymarketing7@gmail.com
Marketing777*

apiKey: "AIzaSyDTyBkvph-yN6BdyL-k3o5X7bjYDRLKRq8"
