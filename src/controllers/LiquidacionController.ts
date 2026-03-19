import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';

export class LiquidacionController {
  async create(req: Request, res: Response) {
    const {
      employeeId,
      companyId,
      tipoTerminacion,
      fechaTerminacion,
      previousStatus,
      salarioMensual,
      anosTrabajados,
      mesesTrabajados,
      diasTrabajados,
      primaAntiguedad,
      preaviso,
      vacaciones,
      decimo,
      indemnizacion,
      salariosPendientes,
      totalBruto,
      ss,
      se,
      isr,
      totalDeducciones,
      totalNeto,
      notes,
    } = req.body;

    try {
      if (!employeeId || !companyId || !tipoTerminacion || !fechaTerminacion || !previousStatus) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
      }

      // Guardar snapshot y actualizar estado del empleado en transacción
      const [liquidacion] = await prisma.$transaction([
        prisma.liquidacion.create({
          data: {
            employeeId,
            companyId,
            tipoTerminacion,
            fechaTerminacion: new Date(fechaTerminacion),
            previousStatus,
            salarioMensual: salarioMensual ?? 0,
            anosTrabajados: anosTrabajados ?? 0,
            mesesTrabajados: mesesTrabajados ?? 0,
            diasTrabajados: diasTrabajados ?? 0,
            primaAntiguedad: primaAntiguedad ?? 0,
            preaviso: preaviso ?? 0,
            vacaciones: vacaciones ?? 0,
            decimo: decimo ?? 0,
            indemnizacion: indemnizacion ?? 0,
            salariosPendientes: salariosPendientes ?? 0,
            totalBruto: totalBruto ?? 0,
            ss: ss ?? 0,
            se: se ?? 0,
            isr: isr ?? 0,
            totalDeducciones: totalDeducciones ?? 0,
            totalNeto: totalNeto ?? 0,
            notes: notes ?? null,
          },
        }),
        prisma.employee.update({
          where: { id: employeeId },
          data: { status: 'TERMINATED' },
        }),
      ]);

      return res.status(201).json(liquidacion);
    } catch (error: unknown) {
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }

  async getAll(req: Request, res: Response) {
    const { companyId } = req.query;

    try {
      if (!companyId) {
        return res.status(400).json({ error: 'companyId es requerido' });
      }

      const liquidaciones = await prisma.liquidacion.findMany({
        where: { companyId: String(companyId) },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, cedula: true, position: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.json(liquidaciones);
    } catch (error: unknown) {
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }

  async revert(req: Request, res: Response) {
    const { id } = req.params;
    const userId = (req as Request & { userId?: string }).userId;

    try {
      const liquidacion = await prisma.liquidacion.findUnique({ where: { id } });

      if (!liquidacion) {
        return res.status(404).json({ error: 'Liquidación no encontrada' });
      }

      if (liquidacion.revertedAt) {
        return res.status(400).json({ error: 'Esta liquidación ya fue revertida' });
      }

      await prisma.$transaction([
        prisma.employee.update({
          where: { id: liquidacion.employeeId },
          data: { status: liquidacion.previousStatus as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'MATERNITY_LEAVE' },
        }),
        prisma.liquidacion.update({
          where: { id },
          data: {
            revertedAt: new Date(),
            revertedBy: userId ?? null,
          },
        }),
      ]);

      return res.json({ message: 'Liquidación revertida exitosamente' });
    } catch (error: unknown) {
      return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
}
