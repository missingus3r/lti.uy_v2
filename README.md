# LTI.UY - Plataforma para estudiantes LTI de UTEC

## 📋 Descripción

LTI.UY es una plataforma web no oficial diseñada para estudiantes de la carrera LTI (Licenciatura en Tecnologías de la Información) de UTEC. Proporciona un acceso centralizado a la información académica utilizando las credenciales de Moodle de UTEC.

## 🔐 Seguridad y Privacidad

- **NO se almacena ningún dato personal**
- Las credenciales se utilizan únicamente para autenticación momentánea
- Sesiones temporales con expiración automática (2 horas)
- Todo el tráfico es anónimo y seguro

## 🚀 Instalación

1. Clonar el repositorio:
```bash
git clone https://github.com/tuusuario/lti.uy_v2.git
cd lti.uy_v2
```

2. Instalar dependencias:
```bash
npm install
```

3. Instalar navegador para Playwright:
```bash
npx playwright install chromium
```

4. En sistemas Linux, instalar dependencias del sistema:
```bash
sudo npx playwright install-deps
```

## ⚙️ Configuración

1. Copiar el archivo `.env.example` a `.env` (o crear uno nuevo):
```bash
SESSION_SECRET=tu-clave-secreta-aqui
PORT=3000
```

## 🏃‍♂️ Ejecutar la aplicación

### Modo producción:
```bash
npm start
```

### Modo desarrollo (con auto-reload):
```bash
npm run dev
```

La aplicación estará disponible en: http://localhost:3000

## 🧪 Probar el login

Para verificar que el sistema de autenticación funciona correctamente:

```bash
node test-login.js <tu-usuario-utec> <tu-contraseña>
```

## 📁 Estructura del proyecto

```
lti.uy_v2/
├── server.js           # Servidor Express principal
├── package.json        # Dependencias del proyecto
├── .env               # Variables de entorno (no incluir en git)
├── public/            # Archivos estáticos
│   ├── css/
│   │   └── styles.css # Estilos con colores UTEC
│   └── js/
│       └── main.js    # JavaScript del cliente
├── views/             # Plantillas EJS
│   ├── index.ejs      # Landing page
│   ├── login.ejs      # Página de login
│   ├── welcome.ejs    # Página de bienvenida
│   └── terms.ejs      # Términos y condiciones
├── routes/            # Rutas de Express
│   └── auth.js        # Rutas de autenticación
└── utils/             # Utilidades
    └── moodleAuth.js  # Lógica de Playwright para Moodle
```

## 🛠️ Tecnologías utilizadas

- **Node.js** - Entorno de ejecución
- **Express** - Framework web
- **EJS** - Motor de plantillas
- **Playwright** - Automatización de navegador para autenticación
- **Express-session** - Manejo de sesiones

## 📱 Características

- ✅ Diseño responsive para móviles y escritorio
- ✅ Autenticación con credenciales de UTEC Moodle
- ✅ Interfaz moderna con colores oficiales de UTEC
- ✅ Modal de error para login fallido
- ✅ Página de términos y condiciones
- ✅ Sin almacenamiento de datos personales

## 🔍 Endpoints disponibles

- `GET /` - Landing page
- `GET /login` - Página de inicio de sesión
- `POST /auth/login` - Endpoint de autenticación
- `GET /welcome` - Página de bienvenida (requiere autenticación)
- `GET /logout` - Cerrar sesión
- `GET /terms` - Términos y condiciones
- `GET /health` - Estado del servicio

## ⚠️ Notas importantes

1. Esta es una plataforma **no oficial** y no está afiliada con UTEC
2. Usar únicamente credenciales propias
3. El sistema depende de la disponibilidad del Moodle de UTEC
4. En caso de problemas con Playwright, verificar que las dependencias del sistema estén instaladas

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crea un Pull Request

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia ISC.