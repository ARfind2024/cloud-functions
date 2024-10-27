// functions/empleados/index.js

const express = require('express');
const admin = require('firebase-admin');

// Inicializa el enrutador de Express
const router = express.Router();

/******************************************************************************************************************************************************************
 *                ABM EMPLEADOS                                                                                                                                   *
 *    Módulo para la gestión de empleados en Firestore con acceso restringido a administradores.                                                                  *
 *                                                                                                                                                                *
 *    Contiene rutas:                                                                                                                                             *
 *       - POST /empleados/createEmpleado                                                                                                                         *
 *       - GET /empleados/getEmpleados                                                                                                                            *
 *       - PUT /empleados/updateEmpleado                                                                                                                          *
 *       - DELETE /empleados/deleteEmpleado                                                                                                                       *
 *       - POST /empleados/loginEmpleado                                                                                                                          *
 *    Deploy del módulo:                                                                                                                                          *
 *    firebase deploy --only functions:empleados                                                                                                                  *
 ******************************************************************************************************************************************************************/

// Middleware de autenticación y verificación de rol de administrador en la colección "Empleados"
const authenticateAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const empleadoDoc = await admin.firestore().collection('Empleados').doc(decodedToken.uid).get();
    
    if (!empleadoDoc.exists || !empleadoDoc.data().is_admin) {
      return res.status(403).json({ message: 'Forbidden: Access is allowed only for administrators.' });
    }

    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized', error: error.message });
  }
};

// Crear un nuevo empleado
router.post('/createEmpleado', authenticateAdmin, async (req, res) => {
  const { email, is_admin, nombre, password } = req.body;

  if (typeof email !== 'string' || typeof is_admin !== 'boolean' || typeof nombre !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Datos de empleado inválidos' });
  }

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: nombre,
    });
    
    const newEmpleado = { email, is_admin, nombre, password };
    await admin.firestore().collection('Empleados').doc(userRecord.uid).set(newEmpleado);
    
    return res.status(201).json({ message: 'Empleado creado con éxito', empleado: { id: userRecord.uid, ...newEmpleado } });
  } catch (error) {
    return res.status(500).json({ message: 'Error al crear el empleado', error: error.message });
  }
});

// Obtener todos los empleados
router.get('/getEmpleados', authenticateAdmin, async (req, res) => {
  try {
    const empleadosSnapshot = await admin.firestore().collection('Empleados').get();
    const empleados = empleadosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.status(200).json({ message: 'Empleados obtenidos con éxito', data: empleados });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener empleados', error: error.message });
  }
});

// Actualizar un empleado
router.put('/updateEmpleado', authenticateAdmin, async (req, res) => {
  const { id, email, is_admin, nombre, password } = req.body;

  if (typeof id !== 'string' || typeof email !== 'string' || typeof is_admin !== 'boolean' || typeof nombre !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Datos de empleado inválidos' });
  }

  try {
    const empleadoRef = admin.firestore().collection('Empleados').doc(id);
    await empleadoRef.update({ email, is_admin, nombre, password });
    return res.status(200).json({ message: 'Empleado actualizado con éxito' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al actualizar el empleado', error: error.message });
  }
});

// Eliminar un empleado
router.delete('/deleteEmpleado', authenticateAdmin, async (req, res) => {
  const { id } = req.body;

  if (typeof id !== 'string') {
    return res.status(400).json({ message: 'Se requiere el ID del empleado y debe ser un string' });
  }

  try {
    await admin.firestore().collection('Empleados').doc(id).delete();
    return res.status(200).json({ message: 'Empleado eliminado con éxito' });
  } catch (error) {
    return res.status(500).json({ message: 'Error al eliminar el empleado', error: error.message });
  }
});

// Login de empleado
router.post('/loginEmpleado', async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Email y password son requeridos y deben ser strings' });
  }

  try {
    const empleadosRef = admin.firestore().collection('Empleados');
    const empleadoSnapshot = await empleadosRef.where('email', '==', email).get();

    if (empleadoSnapshot.empty) {
      return res.status(404).json({ message: 'Empleado no encontrado' });
    }

    const empleadoData = empleadoSnapshot.docs[0].data();

    if (empleadoData.password !== password) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    const userRecord = await admin.auth().getUserByEmail(email);
    const token = await admin.auth().createCustomToken(userRecord.uid);

    // Devolver solo el token
    return res.status(200).json({ token });
  } catch (error) {
    return res.status(500).json({ message: 'Error al iniciar sesión', error: error.message });
  }
});

module.exports = router;
