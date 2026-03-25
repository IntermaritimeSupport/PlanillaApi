// src/controllers/DecimoController.ts
import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { resolveCompanyAccess } from '../middlewares/authGuards.js';

export class DecimoController {

  // GET /api/payroll/decimo/history?companyId=&year=
  async getHistory(req: Request, res: Response) {
    try {
      const { companyId, year } = req.query;

      if (!companyId) {
        return res.status(400).json({ error: 'companyId es requerido.' });
      }

      const yearNum = year ? parseInt(year as string) : new Date().getFullYear();

      const payments = await prisma.decimoPayment.findMany({
        where: {
          companyId: companyId as string,
          year: yearNum,
        },
        orderBy: { partida: 'asc' },
      });

      // Construir resumen de las 3 partidas
      const partidas = [1, 2, 3].map((n) => {
        const pago = payments.find((p) => p.partida === n);
        return {
          partida: n,
          label: n === 1 ? '1ra Partida (Abril)' : n === 2 ? '2da Partida (Agosto)' : '3ra Partida (Diciembre)',
          status: pago ? 'PAID' : 'PENDING',
          paymentId: pago?.id || null,
          paymentDate: pago?.paymentDate || null,
          totalAmount: pago ? Number(pago.totalAmount) : 0,
          notes: pago?.notes || null,
        };
      });

      return res.status(200).json({
        companyId,
        year: yearNum,
        partidas,
        totalPaid: payments.reduce((sum, p) => sum + Number(p.totalAmount), 0),
        paidCount: payments.length,
      });
    } catch (error: any) {
      console.error('Error fetching decimo history:', error);
      return res.status(500).json({
        error: 'Error al obtener historial del décimo.',
        details: error.message,
      });
    }
  }

  // POST /api/payroll/decimo/pay
  // Body: { companyId, year, partida, totalAmount, paymentDate?, notes? }
  async registerPayment(req: Request, res: Response) {
    try {
      const { companyId, year, partida, totalAmount, paymentDate, notes } = req.body;

      if (!companyId || !year || !partida) {
        return res.status(400).json({ error: 'companyId, year y partida son obligatorios.' });
      }

      if (!resolveCompanyAccess(req as any, res, companyId)) return;

      if (![1, 2, 3].includes(Number(partida))) {
        return res.status(400).json({ error: 'partida debe ser 1, 2 o 3.' });
      }

      // Verificar que no exista ya
      const existing = await prisma.decimoPayment.findUnique({
        where: {
          companyId_year_partida: {
            companyId,
            year: Number(year),
            partida: Number(partida),
          },
        },
      });

      if (existing) {
        return res.status(409).json({
          error: `La ${partida}ra partida del décimo del año ${year} ya fue registrada.`,
          payment: existing,
        });
      }

      const payment = await prisma.decimoPayment.create({
        data: {
          companyId,
          year: Number(year),
          partida: Number(partida),
          totalAmount: Number(totalAmount) || 0,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          notes: notes || null,
        },
      });

      return res.status(201).json(payment);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Este pago de décimo ya existe.' });
      }
      console.error('Error registering decimo payment:', error);
      return res.status(500).json({
        error: 'Error al registrar el pago del décimo.',
        details: error.message,
      });
    }
  }

  // GET /api/payroll/decimo/history/all?companyId=
  async getAllYearsHistory(req: Request, res: Response) {
    try {
      const { companyId } = req.query;
      if (!companyId) return res.status(400).json({ error: 'companyId es requerido.' });

      const payments = await prisma.decimoPayment.findMany({
        where: { companyId: companyId as string },
        orderBy: [{ year: 'desc' }, { partida: 'asc' }],
      });

      // Agrupar por año
      const byYear: Record<number, typeof payments> = {};
      for (const p of payments) {
        if (!byYear[p.year]) byYear[p.year] = [];
        byYear[p.year].push(p);
      }

      const years = Object.keys(byYear)
        .map(Number)
        .sort((a, b) => b - a)
        .map((y) => {
          const yPayments = byYear[y];
          const partidas = [1, 2, 3].map((n) => {
            const pago = yPayments.find((p) => p.partida === n);
            return {
              partida: n,
              status: pago ? 'PAID' : 'PENDING',
              paymentId: pago?.id ?? null,
              paymentDate: pago?.paymentDate ?? null,
              totalAmount: pago ? Number(pago.totalAmount) : null,
              notes: pago?.notes ?? null,
            };
          });
          const paidCount = yPayments.length;
          const totalPaid = yPayments.reduce((s, p) => s + Number(p.totalAmount), 0);
          return { year: y, partidas, paidCount, totalPaid };
        });

      return res.status(200).json({ companyId, years });
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Error al obtener historial de décimos.', details: error instanceof Error ? error.message : String(error) });
    }
  }

  // DELETE /api/payroll/decimo/pay/:id
  async deletePayment(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const payment = await prisma.decimoPayment.findUnique({ where: { id } });
      if (!payment) {
        return res.status(404).json({ error: 'Pago de décimo no encontrado.' });
      }

      if (!resolveCompanyAccess(req as any, res, payment.companyId)) return;

      await prisma.decimoPayment.delete({ where: { id } });

      return res.status(200).json({ message: 'Pago de décimo anulado correctamente.', id });
    } catch (error: any) {
      console.error('Error deleting decimo payment:', error);
      return res.status(500).json({
        error: 'Error al anular el pago del décimo.',
        details: error.message,
      });
    }
  }
}
