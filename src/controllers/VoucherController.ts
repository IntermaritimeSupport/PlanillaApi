// ─────────────────────────────────────────────────────────────────────────────
// VoucherController.ts
// Envío de comprobantes de pago por email (individual y masivo)
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { sendPayrollVoucher, generateVoucherPDF } from '../services/VoucherService.js';

export class VoucherController {

  // ── Envío individual ──────────────────────────────────────────────────────
  // POST /api/payroll/voucher/send
  // Body: { payrollId: string }
  async sendSingle(req: Request, res: Response) {
    const { payrollId } = req.body;

    if (!payrollId) {
      return res.status(400).json({ error: 'payrollId es requerido.' });
    }

    try {
      const payroll = await prisma.payroll.findUnique({
        where: { id: payrollId },
        include: {
          employee: true,
          company: true,
          deductions: true,
          allowances: true,
          payrollRun: true,
        },
      });

      if (!payroll) {
        return res.status(404).json({ error: 'Nómina no encontrada.' });
      }

      if (!payroll.employee.email) {
        return res.status(422).json({
          error: `El empleado ${payroll.employee.firstName} ${payroll.employee.lastName} no tiene email registrado.`,
        });
      }

      const result = await sendPayrollVoucher(
        {
          payrollNumber: payroll.payrollNumber,
          payPeriod: payroll.payPeriod,
          paymentDate: payroll.paymentDate,
          payrollType: payroll.payrollType,
          quincena: payroll.payrollRun?.quincena,
          baseSalary: Number(payroll.baseSalary),
          grossSalary: Number(payroll.grossSalary),
          incomeTax: Number(payroll.incomeTax),
          sss: Number(payroll.sss),
          privateInsurance: Number(payroll.privateInsurance),
          customDeductions: Number(payroll.customDeductions),
          totalDeductions: Number(payroll.totalDeductions),
          netSalary: Number(payroll.netSalary),
          thirteenthMonthAmount: payroll.thirteenthMonthAmount ? Number(payroll.thirteenthMonthAmount) : null,
          deductions: payroll.deductions.map(d => ({ description: d.description, amount: Number(d.amount) })),
          allowances: payroll.allowances.map(a => ({ allowanceType: a.allowanceType, amount: Number(a.amount) })),
        },
        {
          id: payroll.employee.id,
          cedula: payroll.employee.cedula,
          firstName: payroll.employee.firstName,
          lastName: payroll.employee.lastName,
          email: payroll.employee.email!,
          position: payroll.employee.position || undefined,
          department: payroll.employee.department || undefined,
          bankAccount: (payroll.employee as any).bankAccount || undefined,
          bankName: (payroll.employee as any).bankName || undefined,
          salaryType: payroll.employee.salaryType,
        },
        {
          name: payroll.company.name,
          ruc: payroll.company.ruc || undefined,
          address: payroll.company.address || undefined,
          phone: payroll.company.phone || undefined,
          email: payroll.company.email || undefined,
        }
      );

      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Error enviando el email.' });
      }

      return res.status(200).json({
        success: true,
        message: `Comprobante enviado a ${payroll.employee.email}`,
        messageId: result.messageId,
      });
    } catch (error: any) {
      console.error('Error en sendSingle:', error);
      return res.status(500).json({ error: 'Error interno del servidor.', details: error.message });
    }
  }

  // ── Envío masivo ──────────────────────────────────────────────────────────
  // POST /api/payroll/voucher/send-bulk
  // Body: { payrollRunId?: string, companyId?: string, payrollIds?: string[] }
  async sendBulk(req: Request, res: Response) {
    const { payrollRunId, companyId, payrollIds } = req.body;

    if (!payrollRunId && !companyId && (!payrollIds || payrollIds.length === 0)) {
      return res.status(400).json({ error: 'Debe proporcionar payrollRunId, companyId o payrollIds.' });
    }

    try {
      const where: any = {};
      if (payrollIds?.length)  where.id = { in: payrollIds };
      else if (payrollRunId)   where.payrollRunId = payrollRunId;
      else if (companyId)      where.companyId = companyId;

      const payrolls = await prisma.payroll.findMany({
        where,
        include: {
          employee: true,
          company: true,
          deductions: true,
          allowances: true,
          payrollRun: true,
        },
      });

      if (payrolls.length === 0) {
        return res.status(404).json({ error: 'No se encontraron nóminas con los criterios dados.' });
      }

      const results = {
        total: payrolls.length,
        sent: 0,
        failed: 0,
        skipped: 0,
        errors: [] as Array<{ employee: string; email: string | null; error: string }>,
      };

      // Enviar en lotes de 5 para no saturar el servidor SMTP
      const BATCH = 5;
      for (let i = 0; i < payrolls.length; i += BATCH) {
        const batch = payrolls.slice(i, i + BATCH);

        await Promise.allSettled(
          batch.map(async (payroll) => {
            const empName = `${payroll.employee.firstName} ${payroll.employee.lastName}`;

            if (!payroll.employee.email) {
              results.skipped++;
              results.errors.push({ employee: empName, email: null, error: 'Sin email registrado' });
              return;
            }

            const result = await sendPayrollVoucher(
              {
                payrollNumber: payroll.payrollNumber,
                payPeriod: payroll.payPeriod,
                paymentDate: payroll.paymentDate,
                payrollType: payroll.payrollType,
                quincena: payroll.payrollRun?.quincena,
                baseSalary: Number(payroll.baseSalary),
                grossSalary: Number(payroll.grossSalary),
                incomeTax: Number(payroll.incomeTax),
                sss: Number(payroll.sss),
                privateInsurance: Number(payroll.privateInsurance),
                customDeductions: Number(payroll.customDeductions),
                totalDeductions: Number(payroll.totalDeductions),
                netSalary: Number(payroll.netSalary),
                thirteenthMonthAmount: payroll.thirteenthMonthAmount ? Number(payroll.thirteenthMonthAmount) : null,
                deductions: payroll.deductions.map(d => ({ description: d.description, amount: Number(d.amount) })),
                allowances: payroll.allowances.map(a => ({ allowanceType: a.allowanceType, amount: Number(a.amount) })),
              },
              {
                id: payroll.employee.id,
                cedula: payroll.employee.cedula,
                firstName: payroll.employee.firstName,
                lastName: payroll.employee.lastName,
                email: payroll.employee.email!,
                position: payroll.employee.position || undefined,
                department: payroll.employee.department || undefined,
                bankAccount: (payroll.employee as any).bankAccount || undefined,
                bankName: (payroll.employee as any).bankName || undefined,
                salaryType: payroll.employee.salaryType,
              },
              {
                name: payroll.company.name,
                ruc: payroll.company.ruc || undefined,
                address: payroll.company.address || undefined,
                phone: payroll.company.phone || undefined,
                email: payroll.company.email || undefined,
              }
            );

            if (result.success) {
              results.sent++;
            } else {
              results.failed++;
              results.errors.push({ employee: empName, email: payroll.employee.email!, error: result.error || 'Error desconocido' });
            }
          })
        );

        // Pausa entre lotes para evitar rate limits del SMTP
        if (i + BATCH < payrolls.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      return res.status(200).json({
        success: true,
        ...results,
        message: `Proceso completado. Enviados: ${results.sent}, Fallidos: ${results.failed}, Sin email: ${results.skipped}`,
      });
    } catch (error: any) {
      console.error('Error en sendBulk:', error);
      return res.status(500).json({ error: 'Error interno del servidor.', details: error.message });
    }
  }

  // ── Preview PDF ───────────────────────────────────────────────────────────
  // GET /api/payroll/voucher/preview/:payrollId
  async previewPDF(req: Request, res: Response) {
    const { payrollId } = req.params;

    try {
      const payroll = await prisma.payroll.findUnique({
        where: { id: payrollId },
        include: { employee: true, company: true, deductions: true, allowances: true, payrollRun: true },
      });

      if (!payroll) return res.status(404).json({ error: 'Nómina no encontrada.' });

      const pdfBuffer = await generateVoucherPDF(
        {
          payrollNumber: payroll.payrollNumber,
          payPeriod: payroll.payPeriod,
          paymentDate: payroll.paymentDate,
          payrollType: payroll.payrollType,
          quincena: payroll.payrollRun?.quincena,
          baseSalary: Number(payroll.baseSalary),
          grossSalary: Number(payroll.grossSalary),
          incomeTax: Number(payroll.incomeTax),
          sss: Number(payroll.sss),
          privateInsurance: Number(payroll.privateInsurance),
          customDeductions: Number(payroll.customDeductions),
          totalDeductions: Number(payroll.totalDeductions),
          netSalary: Number(payroll.netSalary),
          thirteenthMonthAmount: payroll.thirteenthMonthAmount ? Number(payroll.thirteenthMonthAmount) : null,
          deductions: payroll.deductions.map(d => ({ description: d.description, amount: Number(d.amount) })),
          allowances: payroll.allowances.map(a => ({ allowanceType: a.allowanceType, amount: Number(a.amount) })),
        },
        {
          id: payroll.employee.id,
          cedula: payroll.employee.cedula,
          firstName: payroll.employee.firstName,
          lastName: payroll.employee.lastName,
          email: payroll.employee.email || '',
          position: payroll.employee.position || undefined,
          department: payroll.employee.department || undefined,
          bankAccount: (payroll.employee as any).bankAccount || undefined,
          bankName: (payroll.employee as any).bankName || undefined,
        },
        {
          name: payroll.company.name,
          ruc: payroll.company.ruc || undefined,
          address: payroll.company.address || undefined,
          phone: payroll.company.phone || undefined,
        }
      );

      const filename = `Comprobante_${payroll.employee.cedula}_${new Date(payroll.payPeriod).toISOString().slice(0, 7)}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.end(pdfBuffer);
    } catch (error: any) {
      return res.status(500).json({ error: 'Error generando PDF.', details: error.message });
    }
  }
}
