import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';

export class AttendanceController {
  async recordAttendance(req: Request, res: Response) {
    const { employeeId, date, checkInTime, checkOutTime, status, notes } =
      req.body;

    try {
      if (!employeeId || !date) {
        return res.status(400).json({
          error: 'Empleado y fecha son obligatorios.',
        });
      }

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        return res.status(404).json({ error: 'Empleado no encontrado.' });
      }

      // Verificar si ya existe registro para esa fecha
      const existingRecord = await prisma.attendanceRecord.findUnique({
        where: {
          employeeId_date: {
            employeeId,
            date: new Date(date),
          },
        },
      });

      let hoursWorked = null;
      if (checkInTime && checkOutTime) {
        const checkIn = new Date(checkInTime);
        const checkOut = new Date(checkOutTime);
        hoursWorked = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
      }

      if (existingRecord) {
        // Actualizar registro existente
        const updated = await prisma.attendanceRecord.update({
          where: {
            employeeId_date: {
              employeeId,
              date: new Date(date),
            },
          },
          data: {
            checkInTime: checkInTime ? new Date(checkInTime) : undefined,
            checkOutTime: checkOutTime ? new Date(checkOutTime) : undefined,
            hoursWorked,
            status: status || 'PRESENT',
            notes,
          },
          include: {
            employee: {
              select: {
                cedula: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });
        return res.status(200).json(updated);
      }

      const newRecord = await prisma.attendanceRecord.create({
        data: {
          employeeId,
          companyId: employee.companyId,
          date: new Date(date),
          checkInTime: checkInTime ? new Date(checkInTime) : null,
          checkOutTime: checkOutTime ? new Date(checkOutTime) : null,
          hoursWorked,
          status: status || 'PRESENT',
          notes,
        },
        include: {
          employee: {
            select: {
              cedula: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return res.status(201).json(newRecord);
    } catch (error: any) {
      console.error('Error recording attendance:', error);
      return res.status(500).json({
        error: 'Error al registrar la asistencia.',
        details: error.message,
      });
    }
  }

  async getAttendanceByEmployee(req: Request, res: Response) {
    try {
      const { employeeId } = req.params;
      const { startDate, endDate } = req.query;

      const where: any = { employeeId };

      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate as string);
        if (endDate) where.date.lte = new Date(endDate as string);
      }

      const records = await prisma.attendanceRecord.findMany({
        where,
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
        orderBy: { date: 'desc' },
      });

      return res.status(200).json(records);
    } catch (error: any) {
      console.error('Error fetching attendance records:', error);
      return res.status(500).json({
        error: 'Error al obtener registros de asistencia.',
        details: error.message,
      });
    }
  }

  async getCompanyAttendance(req: Request, res: Response) {
    try {
      const { companyId } = req.params;
      const { date } = req.query;

      const where: any = { companyId };

      if (date) {
        const targetDate = new Date(date as string);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);

        where.date = {
          gte: targetDate,
          lt: nextDay,
        };
      }

      const records = await prisma.attendanceRecord.findMany({
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
        },
        orderBy: [{ date: 'desc' }, { employee: { lastName: 'asc' } }],
      });

      return res.status(200).json(records);
    } catch (error: any) {
      console.error('Error fetching company attendance:', error);
      return res.status(500).json({
        error: 'Error al obtener asistencia de la compañía.',
        details: error.message,
      });
    }
  }

  async getMonthlyAttendanceSummary(req: Request, res: Response) {
    try {
      const { employeeId, year, month } = req.query;

      const startDate = new Date(
        parseInt(year as string),
        parseInt(month as string) - 1,
        1
      );
      const endDate = new Date(
        parseInt(year as string),
        parseInt(month as string),
        0
      );

      const records = await prisma.attendanceRecord.findMany({
        where: {
          employeeId: employeeId as string,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { date: 'asc' },
      });

      const summary = {
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        excused: 0,
        totalHours: 0,
      };

      records.forEach((record) => {
        switch (record.status) {
          case 'PRESENT':
            summary.present++;
            break;
          case 'ABSENT':
            summary.absent++;
            break;
          case 'LATE':
            summary.late++;
            break;
          case 'HALF_DAY':
            summary.halfDay++;
            break;
          case 'EXCUSED':
            summary.excused++;
            break;
        }
        if (record.hoursWorked) {
          summary.totalHours += record.hoursWorked;
        }
      });

      return res.status(200).json({
        month: `${year}-${String(month).padStart(2, '0')}`,
        summary,
        records,
      });
    } catch (error: any) {
      console.error('Error fetching monthly summary:', error);
      return res.status(500).json({
        error: 'Error al obtener resumen mensual.',
        details: error.message,
      });
    }
  }
}
