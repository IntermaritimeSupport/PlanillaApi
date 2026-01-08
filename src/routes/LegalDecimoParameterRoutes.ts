import { Router } from 'express'
import { LegalDecimoParameterController } from '../controllers/LegalDecimoParameterController.js'

const legalDecimoParameterRouter = Router()
const controller = new LegalDecimoParameterController()

/**
 * NOTA: El orden de las rutas es importante. 
 * Las rutas específicas deben ir ANTES de las rutas con parámetros dinámicos (:id).
 */

// --- CONSULTAS (GET) ---

// Obtener tasas específicas de ISR por empresa (Usa query param ?companyId=...)
legalDecimoParameterRouter.get('/legal-decimo-parameters/isr/rates', (req, res) =>
  controller.getISRRates(req, res)
)

// Obtener tasas específicas de Seguro Social por empresa (Usa query param ?companyId=...)
legalDecimoParameterRouter.get('/legal-decimo-parameters/sss/rates', (req, res) =>
  controller.getSSSRates(req, res)
)

// Obtener parámetros por categoría y empresa (Usa query param ?companyId=...)
legalDecimoParameterRouter.get('/legal-decimo-parameters/category/:category', (req, res) =>
  controller.getByCategory(req, res)
)

// Obtener todos los parámetros de una empresa (Filtros opcionales: category, status)
// Requiere ?companyId=...
legalDecimoParameterRouter.get('/legal-decimo-parameters', (req, res) =>
  controller.getAll(req, res)
)

legalDecimoParameterRouter.get('/legal-parameters/keys', (req, res) => 
  controller.getAvailableKeys(req, res)
);

// Obtener un parámetro específico por su ID único
legalDecimoParameterRouter.get('/legal-decimo-parameters/:id', (req, res) =>
  controller.getById(req, res)
)

// --- ACCIONES (POST, PUT, DELETE) ---

// Crear un nuevo parámetro (El companyId debe venir en el body)
legalDecimoParameterRouter.post('/legal-decimo-parameters', (req, res) =>
  controller.create(req, res)
)

// Actualizar un parámetro existente por su ID
legalDecimoParameterRouter.put('/legal-decimo-parameters/:id', (req, res) =>
  controller.update(req, res)
)

// Eliminar un parámetro legal
legalDecimoParameterRouter.delete('/legal-decimo-parameters/:id', (req, res) =>
  controller.delete(req, res)
)


export default legalDecimoParameterRouter