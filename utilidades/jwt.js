const jwt = require('jsonwebtoken');

const SECRETO = process.env.JWT_SECRETO || 'dinamedical-secreto-cambiar-en-produccion';
const EXPIRACION = process.env.JWT_EXPIRACION || '7d';

function generarToken(payload) {
    return jwt.sign(payload, SECRETO, { expiresIn: EXPIRACION });
}

function verificarToken(token) {
    try {
        return jwt.verify(token, SECRETO);
    } catch {
        return null;
    }
}

module.exports = { generarToken, verificarToken };
