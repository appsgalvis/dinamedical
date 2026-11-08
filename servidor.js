const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const { obtenerConexion, cerrarConexion } = require('./configuracion/baseDatos');
const rutasAuth = require('./rutas/auth');
const rutasUsuarios = require('./rutas/usuarios');
const rutasRoles = require('./rutas/roles');
const rutasPermisos = require('./rutas/permisos');
const rutasIps = require('./rutas/ips');
const rutasCatalogos = require('./rutas/catalogos');
const rutasPersonas = require('./rutas/personas');
const rutasUbicacion = require('./rutas/ubicacion');
const rutasCitas = require('./rutas/citas');
const rutasConsultas = require('./rutas/consultas');
const rutasHistorias = require('./rutas/historias');
const rutasFichaDatosBasicos = require('./rutas/ficha-datos-basicos');
const rutasDetallesEventos = require('./rutas/detalles-eventos');

// Crear aplicación Express
const app = express();
const PUERTO = process.env.PUERTO || 3002;

// Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan(':method :url :status :response-time ms'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir frontend estático (carpeta interna front)
const rutaFrontend = path.join(__dirname, 'front');
app.use(express.static(rutaFrontend));

// Ruta de salud de la API
app.get('/api/salud', async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const resultado = await pool.request().query('SELECT 1 AS ok');
        const ok = resultado.recordset[0]?.ok;
        res.json({
            estado: 'ok',
            mensaje: 'Dinamedical API funcionando',
            baseDatos: ok === 1 ? 'conectada' : 'error'
        });
    } catch (error) {
        res.status(500).json({
            estado: 'error',
            mensaje: error.message,
            baseDatos: 'desconectada'
        });
    }
});

// Ruta de configuración (ejemplo)
app.get('/api/configuracion', async (req, res) => {
    try {
        const pool = await obtenerConexion();
        const resultado = await pool.request().query(
            'SELECT clave, valor FROM configuracion ORDER BY clave'
        );
        const config = {};
        (resultado.recordset || []).forEach(row => { config[row.clave] = row.valor; });
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rutas de autenticación y administración
app.use('/api/auth', rutasAuth);
app.use('/api/usuarios', rutasUsuarios);
app.use('/api/roles', rutasRoles);
app.use('/api/permisos', rutasPermisos);
app.use('/api/ips', rutasIps);
app.use('/api/catalogos', rutasCatalogos);
app.use('/api/personas', rutasPersonas);
app.use('/api/ubicacion', rutasUbicacion);
app.use('/api/citas', rutasCitas);
app.use('/api/consultas', rutasConsultas);
app.use('/api/historias', rutasHistorias);
app.use('/api/ficha-datos-basicos', rutasFichaDatosBasicos);
app.use('/api/detalles-eventos', rutasDetallesEventos);

// SPA: rutas del frontend van al index; API desconocida = 404
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        res.status(404).json({ error: 'Ruta no encontrada', ruta: req.path });
    } else {
        res.sendFile(path.join(rutaFrontend, 'index.html'));
    }
});

// Iniciar servidor
app.listen(PUERTO, '0.0.0.0', () => {
    console.log(`✓ Dinamedical API en http://0.0.0.0:${PUERTO}`);
});

// Cerrar conexión al terminar
process.on('SIGTERM', cerrarConexion);
