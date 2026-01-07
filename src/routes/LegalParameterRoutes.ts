import { Router } from 'express'
import { LegalParameterController } from '../controllers/LegalParameterController.js'

const legalParameterRouter = Router()
const controller = new LegalParameterController()

/**
 * NOTA: El orden de las rutas es importante. 
 * Las rutas específicas deben ir ANTES de las rutas con parámetros dinámicos (:id).
 */

// --- CONSULTAS (GET) ---

// Obtener tasas específicas de ISR por empresa (Usa query param ?companyId=...)
legalParameterRouter.get('/legal-parameters/isr/rates', (req, res) =>
  controller.getISRRates(req, res)
)

// Obtener tasas específicas de Seguro Social por empresa (Usa query param ?companyId=...)
legalParameterRouter.get('/legal-parameters/sss/rates', (req, res) =>
  controller.getSSSRates(req, res)
)

// Obtener parámetros por categoría y empresa (Usa query param ?companyId=...)
legalParameterRouter.get('/legal-parameters/category/:category', (req, res) =>
  controller.getByCategory(req, res)
)

// Obtener todos los parámetros de una empresa (Filtros opcionales: category, status)
// Requiere ?companyId=...
legalParameterRouter.get('/legal-parameters', (req, res) =>
  controller.getAll(req, res)
)

legalParameterRouter.get('/legal-parameters/keys', (req, res) => 
  controller.getAvailableKeys(req, res)
);

// Obtener un parámetro específico por su ID único
legalParameterRouter.get('/legal-parameters/:id', (req, res) =>
  controller.getById(req, res)
)

// --- ACCIONES (POST, PUT, DELETE) ---

// Crear un nuevo parámetro (El companyId debe venir en el body)
legalParameterRouter.post('/legal-parameters', (req, res) =>
  controller.create(req, res)
)

// Actualizar un parámetro existente por su ID
legalParameterRouter.put('/legal-parameters/:id', (req, res) =>
  controller.update(req, res)
)

// Eliminar un parámetro legal
legalParameterRouter.delete('/legal-parameters/:id', (req, res) =>
  controller.delete(req, res)
)


export default legalParameterRouter