import { Request, Response } from 'express';
import prisma from '../../lib/prisma';

export class SystemConfigController {
  // Get all system configurations or filter by category
  async getAll(req: Request, res: Response) {
    try {
      const { category } = req.query;

      const where: any = {};
      if (category) {
        where.key = {
          startsWith: category,
        };
      }

      const configs = await prisma.systemConfig.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      // Parse JSON values if they are strings
      const parsedConfigs = configs.map((config) => ({
        ...config,
        value: typeof config.value === 'string' ? JSON.parse(config.value) : config.value,
      }));

      return res.status(200).json(parsedConfigs);
    } catch (error: any) {
      console.error('Error fetching system configs:', error);
      return res.status(500).json({
        error: 'Error al obtener configuraciones del sistema.',
        details: error.message,
      });
    }
  }

  // Get a specific configuration
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const config = await prisma.systemConfig.findUnique({
        where: { id },
      });

      if (!config) {
        return res.status(404).json({ error: 'Configuración no encontrada.' });
      }

      // Parse JSON value if it's a string
      const parsedConfig = {
        ...config,
        value: typeof config.value === 'string' ? JSON.parse(config.value) : config.value,
      };

      return res.status(200).json(parsedConfig);
    } catch (error: any) {
      console.error('Error fetching system config:', error);
      return res.status(500).json({
        error: 'Error al obtener configuración.',
        details: error.message,
      });
    }
  }

  // Create new configuration
  async create(req: Request, res: Response) {
    try {
      const { key, value, description } = req.body;

      if (!key || !value) {
        return res.status(400).json({
          error: 'Key y value son obligatorios.',
        });
      }

      // Check if key already exists
      const existing = await prisma.systemConfig.findUnique({
        where: { key },
      });

      if (existing) {
        return res.status(409).json({
          error: 'Esta clave de configuración ya existe.',
        });
      }

      const config = await prisma.systemConfig.create({
        data: {
          key,
          value: typeof value === 'string' ? value : JSON.stringify(value),
          description,
        },
      });

      // Parse JSON value if it's a string
      const parsedConfig = {
        ...config,
        value: typeof config.value === 'string' ? JSON.parse(config.value) : config.value,
      };

      return res.status(201).json(parsedConfig);
    } catch (error: any) {
      console.error('Error creating system config:', error);
      return res.status(500).json({
        error: 'Error al crear configuración.',
        details: error.message,
      });
    }
  }

  // Update configuration
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { value, description } = req.body;

      const config = await prisma.systemConfig.findUnique({
        where: { id },
      });

      if (!config) {
        return res.status(404).json({ error: 'Configuración no encontrada.' });
      }

      const updated = await prisma.systemConfig.update({
        where: { id },
        data: {
          value: typeof value === 'string' ? value : JSON.stringify(value),
          description: description !== undefined ? description : config.description,
        },
      });

      // Parse JSON value if it's a string
      const parsedConfig = {
        ...updated,
        value: typeof updated.value === 'string' ? JSON.parse(updated.value) : updated.value,
      };

      return res.status(200).json(parsedConfig);
    } catch (error: any) {
      console.error('Error updating system config:', error);
      return res.status(500).json({
        error: 'Error al actualizar configuración.',
        details: error.message,
      });
    }
  }

  // Delete configuration
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const config = await prisma.systemConfig.findUnique({
        where: { id },
      });

      if (!config) {
        return res.status(404).json({ error: 'Configuración no encontrada.' });
      }

      await prisma.systemConfig.delete({
        where: { id },
      });

      return res.status(200).json({
        message: 'Configuración eliminada exitosamente.',
        id,
      });
    } catch (error: any) {
      console.error('Error deleting system config:', error);
      return res.status(500).json({
        error: 'Error al eliminar configuración.',
        details: error.message,
      });
    }
  }
}