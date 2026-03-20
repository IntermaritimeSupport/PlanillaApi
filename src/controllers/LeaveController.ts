import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';

export class LeaveController {
  async requestLeave(req: Request, res: Response) {
    const {
      employeeId,
      leaveType,
      startDate,
      endDate,
      daysRequested,
      reason,
    } = req.body;

    try {
      if (
        !employeeId ||
        !leaveType ||
        !startDate ||
        !endDate ||
        !daysRequested
      ) {
        return res.status(400).json({
          error: 'Todos los campos son obligatorios.',
        });
      }

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        return res.status(404).json({ error: 'Empleado no encontrado.' });
      }

      // Validar solapamiento de fechas (excluye canceladas y rechazadas)
      const overlap = await prisma.leave.findFirst({
        where: {
          employeeId,
          status: { notIn: ['CANCELLED', 'REJECTED'] },
          startDate: { lte: new Date(endDate) },
          endDate:   { gte: new Date(startDate) },
        },
      });

      if (overlap) {
        return res.status(409).json({
          error: `Ya existe una solicitud de permiso que se superpone con las fechas indicadas (${overlap.startDate.toISOString().slice(0, 10)} — ${overlap.endDate.toISOString().slice(0, 10)}).`,
        });
      }

      const newLeave = await prisma.leave.create({
        data: {
          employeeId,
          companyId: employee.companyId,
          leaveType,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          daysRequested: parseInt(daysRequested),
          reason,
          status: 'PENDING',
        },
        include: {
          employee: {
            select: {
              cedula: true,
              firstName: true,
              lastName: true,
              position: true,
            },
          },
        },
      });

      return res.status(201).json(newLeave);
    } catch (error: any) {
      console.error('Error requesting leave:', error);
      return res.status(500).json({
        error: 'Error al solicitar permiso.',
        details: error.message,
      });
    }
  }

  async getLeaveRequests(req: Request, res: Response) {
    try {
      const { employeeId, companyId, status } = req.query;

      const where: any = {};
      if (employeeId) where.employeeId = employeeId;
      if (companyId) where.companyId = companyId;
      if (status) where.status = status;

      const leaves = await prisma.leave.findMany({
        where,
        include: {
          employee: {
            select: {
              cedula: true,
              firstName: true,
              lastName: true,
              position: true,
              department: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { startDate: 'desc' },
      });

      return res.status(200).json(leaves);
    } catch (error: any) {
      console.error('Error fetching leave requests:', error);
      return res.status(500).json({
        error: 'Error al obtener solicitudes de permiso.',
        details: error.message,
      });
    }
  }

  async approveLeave(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { approvedBy, comments, daysApproved } = req.body;

      const leave = await prisma.leave.findUnique({
        where: { id },
      });

      if (!leave) {
        return res.status(404).json({ error: 'Solicitud no encontrada.' });
      }

      const updated = await prisma.leave.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy,
          approvalDate: new Date(),
          daysApproved: daysApproved || leave.daysRequested,
          comments,
        },
        include: {
          employee: true,
        },
      });

      return res.status(200).json(updated);
    } catch (error: any) {
      console.error('Error approving leave:', error);
      return res.status(500).json({
        error: 'Error al aprobar permiso.',
        details: error.message,
      });
    }
  }

  async rejectLeave(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { comments } = req.body;

      const leave = await prisma.leave.findUnique({
        where: { id },
      });

      if (!leave) {
        return res.status(404).json({ error: 'Solicitud no encontrada.' });
      }

      const updated = await prisma.leave.update({
        where: { id },
        data: {
          status: 'REJECTED',
          comments,
        },
        include: {
          employee: true,
        },
      });

      return res.status(200).json(updated);
    } catch (error: any) {
      console.error('Error rejecting leave:', error);
      return res.status(500).json({
        error: 'Error al rechazar permiso.',
        details: error.message,
      });
    }
  }

  async markAsPaid(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { paidAt } = req.body;

      const leave = await prisma.leave.findUnique({ where: { id } });

      if (!leave) {
        return res.status(404).json({ error: 'Solicitud no encontrada.' });
      }

      if (leave.status !== 'APPROVED') {
        return res.status(400).json({ error: 'Solo se pueden marcar como pagados los permisos aprobados.' });
      }

      if (leave.isPaid) {
        return res.status(400).json({ error: 'Este permiso ya fue marcado como pagado.' });
      }

      const resolvedPaidAt = paidAt ? new Date(paidAt) : new Date();
      if (isNaN(resolvedPaidAt.getTime())) {
        return res.status(400).json({ error: 'Fecha de pago inválida.' });
      }

      const updated = await prisma.leave.update({
        where: { id },
        data: { isPaid: true, paidAt: resolvedPaidAt },
        include: { employee: { select: { firstName: true, lastName: true, cedula: true } } },
      });

      return res.status(200).json(updated);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error marking leave as paid:', msg);
      return res.status(500).json({ error: 'Error al marcar permiso como pagado.' });
    }
  }

  async cancelLeave(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { comments } = req.body;

      const leave = await prisma.leave.findUnique({
        where: { id },
      });

      if (!leave) {
        return res.status(404).json({ error: 'Solicitud no encontrada.' });
      }

      const updated = await prisma.leave.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          comments,
        },
        include: {
          employee: true,
        },
      });

      return res.status(200).json(updated);
    } catch (error: any) {
      console.error('Error cancelling leave:', error);
      return res.status(500).json({
        error: 'Error al cancelar permiso.',
        details: error.message,
      });
    }
  }
}