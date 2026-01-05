import { Request, Response } from 'express'
import prisma from '../../lib/prisma.js'

export class LegalParameterController {
  // Get all legal parameters or filter by category
  async getAll(req: Request, res: Response) {
    try {
      const { category, status } = req.query

      const where: any = {}
      if (category) {
        where.category = category
      }
      if (status) {
        where.status = status
      }

      const parameters = await prisma.legalParameter.findMany({
        where,
        orderBy: { category: 'asc' }
      })

      return res.status(200).json(parameters)
    } catch (error: any) {
      console.error('Error fetching legal parameters:', error)
      return res.status(500).json({
        error: 'Error al obtener parámetros legales',
        details: error.message
      })
    }
  }

  // Get a specific legal parameter
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params

      const parameter = await prisma.legalParameter.findUnique({
        where: { id }
      })

      if (!parameter) {
        return res.status(404).json({
          error: 'Parámetro legal no encontrado'
        })
      }

      return res.status(200).json(parameter)
    } catch (error: any) {
      console.error('Error fetching legal parameter:', error)
      return res.status(500).json({
        error: 'Error al obtener parámetro legal',
        details: error.message
      })
    }
  }

  // Get by category
  async getByCategory(req: Request, res: Response) {
    try {
      const { category } = req.params

      const parameters = await prisma.legalParameter.findMany({
        where: { category }
      })

      return res.status(200).json(parameters)
    } catch (error: any) {
      console.error('Error fetching parameters by category:', error)
      return res.status(500).json({
        error: 'Error al obtener parámetros por categoría',
        details: error.message
      })
    }
  }

  // Create new legal parameter
  async create(req: Request, res: Response) {
    try {
      const { key, name, type, category, percentage, minRange, maxRange, description } = req.body

      // Validaciones
      if (!key || !name || !type || !category || percentage === undefined) {
        return res.status(400).json({
          error: 'Key, name, type, category y percentage son obligatorios'
        })
      }

      // Validar tipo
      const validTypes = ['employee', 'employer', 'fixed']
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: 'Type debe ser: employee, employer o fixed'
        })
      }

      // Validar categoría
      const validCategories = ['social_security', 'educational_insurance', 'isr', 'other']
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          error: 'Category debe ser: social_security, educational_insurance, isr o other'
        })
      }

      // Normalizar key (lowercase, sin espacios, solo caracteres permitidos)
      const normalizedKey = key
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')

      if (!normalizedKey) {
        return res.status(400).json({
          error: 'Key debe contener al menos un carácter alfanumérico'
        })
      }

      // Validar porcentaje
      if (typeof percentage !== 'number' || percentage < 0) {
        return res.status(400).json({
          error: 'Percentage debe ser un número positivo'
        })
      }

      // Check if key already exists
      const existing = await prisma.legalParameter.findUnique({
        where: { key: normalizedKey }
      })

      if (existing) {
        return res.status(409).json({
          error: `El parámetro legal con key "${normalizedKey}" ya existe`
        })
      }

      // Validar rangos si existen
      if (minRange !== undefined && maxRange !== undefined) {
        if (minRange > maxRange) {
          return res.status(400).json({
            error: 'minRange no puede ser mayor que maxRange'
          })
        }
      }

      const parameter = await prisma.legalParameter.create({
        data: {
          key: normalizedKey,
          name,
          type,
          category,
          percentage,
          minRange: minRange ? parseInt(minRange) : null,
          maxRange: maxRange ? parseInt(maxRange) : null,
          description: description || null,
          status: 'active',
          effectiveDate: new Date()
        }
      })

      return res.status(201).json(parameter)
    } catch (error: any) {
      console.error('Error creating legal parameter:', error)
      return res.status(500).json({
        error: 'Error al crear parámetro legal',
        details: error.message
      })
    }
  }

  // Update legal parameter
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { name, type, category, percentage, minRange, maxRange, status, description, effectiveDate } = req.body

      const parameter = await prisma.legalParameter.findUnique({
        where: { id }
      })

      if (!parameter) {
        return res.status(404).json({
          error: 'Parámetro legal no encontrado'
        })
      }

      // Validar tipo si se proporciona
      if (type) {
        const validTypes = ['employee', 'employer', 'fixed']
        if (!validTypes.includes(type)) {
          return res.status(400).json({
            error: 'Type debe ser: employee, employer o fixed'
          })
        }
      }

      // Validar categoría si se proporciona
      if (category) {
        const validCategories = ['social_security', 'educational_insurance', 'isr', 'other']
        if (!validCategories.includes(category)) {
          return res.status(400).json({
            error: 'Category debe ser: social_security, educational_insurance, isr o other'
          })
        }
      }

      // Validar porcentaje si se proporciona
      if (percentage !== undefined) {
        if (typeof percentage !== 'number' || percentage < 0) {
          return res.status(400).json({
            error: 'Percentage debe ser un número positivo'
          })
        }
      }

      // Validar status si se proporciona
      if (status) {
        const validStatuses = ['active', 'inactive']
        if (!validStatuses.includes(status)) {
          return res.status(400).json({
            error: 'Status debe ser: active o inactive'
          })
        }
      }

      // Validar rangos si existen
      if (minRange !== undefined && maxRange !== undefined) {
        if (minRange > maxRange) {
          return res.status(400).json({
            error: 'minRange no puede ser mayor que maxRange'
          })
        }
      }

      const updated = await prisma.legalParameter.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(type && { type }),
          ...(category && { category }),
          ...(percentage !== undefined && { percentage }),
          ...(minRange !== undefined && { minRange: minRange ? parseInt(minRange) : null }),
          ...(maxRange !== undefined && { maxRange: maxRange ? parseInt(maxRange) : null }),
          ...(status && { status }),
          ...(description !== undefined && { description: description || null }),
          ...(effectiveDate && { effectiveDate: new Date(effectiveDate) })
        }
      })

      return res.status(200).json(updated)
    } catch (error: any) {
      console.error('Error updating legal parameter:', error)
      return res.status(500).json({
        error: 'Error al actualizar parámetro legal',
        details: error.message
      })
    }
  }

  // Delete legal parameter
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params

      const parameter = await prisma.legalParameter.findUnique({
        where: { id }
      })

      if (!parameter) {
        return res.status(404).json({
          error: 'Parámetro legal no encontrado'
        })
      }

      await prisma.legalParameter.delete({
        where: { id }
      })

      return res.status(200).json({
        message: 'Parámetro legal eliminado exitosamente',
        id
      })
    } catch (error: any) {
      console.error('Error deleting legal parameter:', error)
      return res.status(500).json({
        error: 'Error al eliminar parámetro legal',
        details: error.message
      })
    }
  }

  // Get ISR rates for calculation
  async getISRRates(req: Request, res: Response) {
    try {
      const rates = await prisma.legalParameter.findMany({
        where: {
          category: 'isr',
          status: 'active'
        },
        orderBy: { minRange: 'asc' }
      })

      return res.status(200).json(rates)
    } catch (error: any) {
      console.error('Error fetching ISR rates:', error)
      return res.status(500).json({
        error: 'Error al obtener tasas de ISR',
        details: error.message
      })
    }
  }

  // Get SSS rates
  async getSSSRates(req: Request, res: Response) {
    try {
      const rates = await prisma.legalParameter.findMany({
        where: {
          category: 'social_security',
          status: 'active'
        }
      })

      return res.status(200).json(rates)
    } catch (error: any) {
      console.error('Error fetching SSS rates:', error)
      return res.status(500).json({
        error: 'Error al obtener tasas de SSS',
        details: error.message
      })
    }
  }
}