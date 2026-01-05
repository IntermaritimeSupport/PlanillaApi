import { Request, Response } from 'express'
import prisma from '../../lib/prisma.js'

export class LegalParameterController {
  
  /**
   * Obtener todos los parámetros legales filtrados por compañía.
   * Query params: companyId (obligatorio), category, status.
   */
  async getAll(req: Request, res: Response) {
    try {
      const { category, status, companyId } = req.query

      if (!companyId) {
        return res.status(400).json({
          error: 'El companyId es obligatorio para consultar los parámetros.'
        })
      }

      const where: any = {
        companyId: String(companyId)
      }

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

  /**
   * Obtener un parámetro específico por su ID único (UUID).
   */
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

  /**
   * Obtener parámetros por categoría y compañía.
   */
  async getByCategory(req: Request, res: Response) {
    try {
      const { category } = req.params
      const { companyId } = req.query

      if (!companyId) {
        return res.status(400).json({ error: 'companyId es obligatorio' })
      }

      const parameters = await prisma.legalParameter.findMany({
        where: { 
          category,
          companyId: String(companyId)
        }
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

  /**
   * Crear un nuevo parámetro legal asociado a una compañía.
   */
  async create(req: Request, res: Response) {
    try {
      const { 
        key, name, type, category, percentage, 
        minRange, maxRange, description, companyId 
      } = req.body

      // Validaciones básicas
      if (!companyId || !key || !name || !type || !category || percentage === undefined) {
        return res.status(400).json({
          error: 'Faltan campos obligatorios (key, name, type, category, percentage, companyId)'
        })
      }

      // Normalizar key (lowercase, snake_case)
      const normalizedKey = key
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')

      // Verificar si la combinación UNIQUE(companyId, key) ya existe
      const existing = await prisma.legalParameter.findUnique({
        where: {
          companyId_key: {
            companyId: companyId,
            key: normalizedKey
          }
        }
      })

      if (existing) {
        return res.status(409).json({
          error: `El parámetro con la clave "${normalizedKey}" ya existe para esta compañía.`
        })
      }

      // Validar rangos
      if (minRange !== undefined && maxRange !== undefined) {
        if (Number(minRange) > Number(maxRange)) {
          return res.status(400).json({ error: 'minRange no puede ser mayor que maxRange' })
        }
      }

      const parameter = await prisma.legalParameter.create({
        data: {
          key: normalizedKey,
          name,
          type,
          category,
          percentage: Number(percentage),
          minRange: minRange ? Number(minRange) : null,
          maxRange: maxRange ? Number(maxRange) : null,
          description: description || null,
          companyId: companyId,
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

  /**
   * Actualizar un parámetro legal por ID.
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { 
        name, type, category, percentage, minRange, 
        maxRange, status, description, effectiveDate 
      } = req.body

      const parameter = await prisma.legalParameter.findUnique({
        where: { id }
      })

      if (!parameter) {
        return res.status(404).json({ error: 'Parámetro legal no encontrado' })
      }

      const updated = await prisma.legalParameter.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(type && { type }),
          ...(category && { category }),
          ...(percentage !== undefined && { percentage: Number(percentage) }),
          ...(minRange !== undefined && { minRange: minRange ? Number(minRange) : null }),
          ...(maxRange !== undefined && { maxRange: maxRange ? Number(maxRange) : null }),
          ...(status && { status }),
          ...(description !== undefined && { description }),
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

  /**
   * Eliminar un parámetro legal.
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params

      const parameter = await prisma.legalParameter.findUnique({
        where: { id }
      })

      if (!parameter) {
        return res.status(404).json({ error: 'Parámetro legal no encontrado' })
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

  /**
   * Obtener tasas de ISR por compañía.
   */
  async getISRRates(req: Request, res: Response) {
    try {
      const { companyId } = req.query
      if (!companyId) return res.status(400).json({ error: 'companyId es requerido' })

      const rates = await prisma.legalParameter.findMany({
        where: {
          companyId: String(companyId),
          category: 'isr',
          status: 'active'
        },
        orderBy: { minRange: 'asc' }
      })

      return res.status(200).json(rates)
    } catch (error: any) {
      console.error('Error fetching ISR rates:', error)
      return res.status(500).json({ error: 'Error al obtener tasas de ISR' })
    }
  }

  /**
   * Obtener tasas de Seguridad Social por compañía.
   */
  async getSSSRates(req: Request, res: Response) {
    try {
      const { companyId } = req.query
      if (!companyId) return res.status(400).json({ error: 'companyId es requerido' })

      const rates = await prisma.legalParameter.findMany({
        where: {
          companyId: String(companyId),
          category: 'social_security',
          status: 'active'
        }
      })

      return res.status(200).json(rates)
    } catch (error: any) {
      console.error('Error fetching SSS rates:', error)
      return res.status(500).json({ error: 'Error al obtener tasas de SSS' })
    }
  }
  // Agregar dentro de la clase LegalParameterController
  async getAvailableKeys(req: Request, res: Response) {
    const keys = [
      { key: 'ss_empleado', name: 'Seguro Social - Empleado', category: 'social_security' },
      { key: 'ss_patrono', name: 'Seguro Social - Patrono', category: 'social_security' },
      { key: 'ss_decimo', name: 'Seguro Social - Décimo Tercer Mes', category: 'social_security' },
      { key: 'se_empleado', name: 'Seguro Educativo - Empleado', category: 'educational_insurance' },
      { key: 'se_patrono', name: 'Seguro Educativo - Patrono', category: 'educational_insurance' },
      { key: 'riesgo_profesional', name: 'Riesgos Profesionales', category: 'other' },
      { key: 'isr_r1', name: 'ISR Tramo 1 (Exento)', category: 'isr' },
      { key: 'isr_r2', name: 'ISR Tramo 2 (15%)', category: 'isr' },
      { key: 'isr_r3', name: 'ISR Tramo 3 (25%)', category: 'isr' },
      { key: 'decimo_css', name: 'Décimo Tercer Mes %', category: 'other' }
    ];
    return res.status(200).json(keys);
  }
}