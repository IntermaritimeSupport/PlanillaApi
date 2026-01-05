import { Router } from 'express'
import { LegalParameterController } from '../controllers/LegalParameterController'

const legalParameterRouter = Router()
const controller = new LegalParameterController()

// GET - Obtener todos los parámetros legales (con filtros)
legalParameterRouter.get('/legal-parameters', (req, res) =>
  controller.getAll(req, res)
)

// GET - Obtener parámetros por categoría
legalParameterRouter.get('/legal-parameters/category/:category', (req, res) =>
  controller.getByCategory(req, res)
)

// GET - Obtener tasas de ISR
legalParameterRouter.get('/legal-parameters/isr/rates', (req, res) =>
  controller.getISRRates(req, res)
)

// GET - Obtener tasas de SSS
legalParameterRouter.get('/legal-parameters/sss/rates', (req, res) =>
  controller.getSSSRates(req, res)
)

// GET - Obtener parámetro por ID
legalParameterRouter.get('/legal-parameters/:id', (req, res) =>
  controller.getById(req, res)
)

// POST - Crear parámetro legal
legalParameterRouter.post('/legal-parameters', (req, res) =>
  controller.create(req, res)
)

// PUT - Actualizar parámetro legal
legalParameterRouter.put('/legal-parameters/:id', (req, res) =>
  controller.update(req, res)
)

// DELETE - Eliminar parámetro legal
legalParameterRouter.delete('/legal-parameters/:id', (req, res) =>
  controller.delete(req, res)
)

export default legalParameterRouter