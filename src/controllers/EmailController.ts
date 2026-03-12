// src/controllers/EmailController.ts
import { Request, Response } from 'express';
import nodemailer from 'nodemailer';

interface PayslipData {
  baseSalary: number;
  hoursExtra: number;
  bonifications: number;
  otherIncome: number;
  grossSalary: number;
  sss: number;
  se: number;
  isr: number;
  recurringAmount: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  netSalaryMonthly: number;
  netSalaryBiweekly: number;
  salaryType: string;
  cedula: string;
  thirteenthMonth?: number;
}

interface EmployeePayslip {
  email: string;
  firstName: string;
  lastName: string;
  payslipData: PayslipData;
  companyName: string;
  payPeriod: string;
  payrollType: string;
}

interface SendPayslipBody {
  employees: EmployeePayslip[];
}

interface PayslipResult {
  email: string;
  success: boolean;
  error?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PA', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function buildPayslipHtml(employee: EmployeePayslip): string {
  const { firstName, lastName, payslipData, companyName, payPeriod, payrollType } = employee;
  const d = payslipData;

  const isBiweekly = payrollType?.toLowerCase().includes('quincenal') ||
    payrollType?.toLowerCase().includes('biweekly');

  const netNoteHtml = isBiweekly
    ? `<tr>
        <td colspan="2" style="padding: 6px 12px; font-size: 12px; color: #6b7280; font-style: italic;">
          * Salario neto mensual estimado: <strong>${formatCurrency(d.netSalaryMonthly)}</strong>
        </td>
      </tr>`
    : `<tr>
        <td colspan="2" style="padding: 6px 12px; font-size: 12px; color: #6b7280; font-style: italic;">
          * Salario neto quincenal estimado: <strong>${formatCurrency(d.netSalaryBiweekly)}</strong>
        </td>
      </tr>`;

  const thirteenthRowHtml = d.thirteenthMonth !== undefined && d.thirteenthMonth > 0
    ? `<tr style="background-color: #f9fafb;">
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">Décimo Tercer Mes</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #16a34a;">
          ${formatCurrency(d.thirteenthMonth)}
        </td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recibo de Pago - ${companyName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif; color: #1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

          <!-- ENCABEZADO -->
          <tr>
            <td style="background-color: #1e3a5f; padding: 28px 32px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">${companyName}</h1>
              <p style="margin: 6px 0 0; color: #93c5fd; font-size: 14px;">Recibo de Pago — ${payPeriod}</p>
              <p style="margin: 4px 0 0; color: #93c5fd; font-size: 13px;">Tipo de nómina: ${payrollType}</p>
            </td>
          </tr>

          <!-- DATOS DEL EMPLEADO -->
          <tr>
            <td style="padding: 20px 32px; background-color: #eff6ff; border-bottom: 1px solid #bfdbfe;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 18px; font-weight: 700; color: #1e3a5f;">${firstName} ${lastName}</p>
                    <p style="margin: 4px 0 0; font-size: 13px; color: #4b5563;">Cédula: <strong>${d.cedula}</strong></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- SECCIÓN: INGRESOS -->
          <tr>
            <td style="padding: 24px 32px 8px;">
              <p style="margin: 0 0 10px; font-size: 13px; font-weight: 700; text-transform: uppercase; color: #4b5563; letter-spacing: 0.05em;">Ingresos</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; font-size: 14px;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 10px 12px; text-align: left; font-weight: 600; border-bottom: 1px solid #e5e7eb; color: #374151;">Concepto</th>
                    <th style="padding: 10px 12px; text-align: right; font-weight: 600; border-bottom: 1px solid #e5e7eb; color: #374151;">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">Salario Base</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(d.baseSalary)}</td>
                  </tr>
                  <tr style="background-color: #f9fafb;">
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">Horas Extra</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(d.hoursExtra)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">Bonificaciones</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(d.bonifications)}</td>
                  </tr>
                  <tr style="background-color: #f9fafb;">
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">Otros Ingresos</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(d.otherIncome)}</td>
                  </tr>
                  ${thirteenthRowHtml}
                  <tr style="background-color: #f0fdf4;">
                    <td style="padding: 10px 12px; font-weight: 700; color: #15803d;">Salario Bruto</td>
                    <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #15803d;">${formatCurrency(d.grossSalary)}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <!-- SECCIÓN: DEDUCCIONES -->
          <tr>
            <td style="padding: 16px 32px 8px;">
              <p style="margin: 0 0 10px; font-size: 13px; font-weight: 700; text-transform: uppercase; color: #4b5563; letter-spacing: 0.05em;">Deducciones</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; font-size: 14px;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 10px 12px; text-align: left; font-weight: 600; border-bottom: 1px solid #e5e7eb; color: #374151;">Concepto</th>
                    <th style="padding: 10px 12px; text-align: right; font-weight: 600; border-bottom: 1px solid #e5e7eb; color: #374151;">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">Seguro Social Empleado (9.75%)</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #dc2626;">${formatCurrency(d.sss)}</td>
                  </tr>
                  <tr style="background-color: #f9fafb;">
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">Seguro Educativo (1.25%)</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #dc2626;">${formatCurrency(d.se ?? 0)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">ISR (Impuesto sobre la Renta)</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #dc2626;">${formatCurrency(d.isr)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">Deducciones Fijas</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #dc2626;">${formatCurrency(d.recurringAmount)}</td>
                  </tr>
                  <tr style="background-color: #f9fafb;">
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">Otras Deducciones</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #dc2626;">${formatCurrency(d.otherDeductions)}</td>
                  </tr>
                  <tr style="background-color: #fff1f2;">
                    <td style="padding: 10px 12px; font-weight: 700; color: #b91c1c;">Total Deducciones</td>
                    <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #b91c1c;">${formatCurrency(d.totalDeductions)}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>

          <!-- SALARIO NETO -->
          <tr>
            <td style="padding: 20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1e3a5f; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0; font-size: 13px; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.05em;">Salario Neto a Recibir</p>
                    <p style="margin: 6px 0 0; font-size: 32px; font-weight: 700; color: #ffffff;">${formatCurrency(d.netSalary)}</p>
                  </td>
                </tr>
                ${netNoteHtml}
              </table>
            </td>
          </tr>

          <!-- PIE DE PÁGINA -->
          <tr>
            <td style="padding: 16px 32px 28px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                Este recibo de pago fue generado automáticamente por el sistema FlowPlanilla.<br />
                Por favor, no responda a este correo electrónico.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Si no están configuradas las variables SMTP, usar cuenta Ethereal para desarrollo
  if (!host || !user || !pass) {
    const testAccount = await nodemailer.createTestAccount();
    return {
      transporter: nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      }),
      ethereal: true,
      etherealUser: testAccount.user,
    };
  }

  return {
    transporter: nodemailer.createTransport({
      host,
      port: port ? parseInt(port, 10) : 587,
      secure: port === '465',
      auth: { user, pass },
    }),
    ethereal: false,
    etherealUser: null,
  };
}

export class EmailController {
  async sendPayslip(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as SendPayslipBody;

      if (!body.employees || !Array.isArray(body.employees) || body.employees.length === 0) {
        res.status(400).json({ error: 'Se requiere al menos un empleado en el arreglo employees.' });
        return;
      }

      const { transporter, ethereal, etherealUser } = await createTransporter();

      const fromAddress = process.env.SMTP_FROM ?? etherealUser ?? 'noreply@flowplanilla.com';

      const results: PayslipResult[] = [];
      let sent = 0;
      let failed = 0;

      for (const employee of body.employees) {
        try {
          if (!employee.email || !employee.firstName || !employee.lastName || !employee.payslipData) {
            throw new Error('Datos de empleado incompletos: se requieren email, firstName, lastName y payslipData.');
          }

          const htmlContent = buildPayslipHtml(employee);

          const info = await transporter.sendMail({
            from: `"${employee.companyName ?? 'FlowPlanilla'}" <${fromAddress}>`,
            to: employee.email,
            subject: `Recibo de Pago — ${employee.payPeriod ?? ''} | ${employee.companyName ?? 'FlowPlanilla'}`,
            html: htmlContent,
          });

          if (ethereal) {
            console.log(`[EmailController] Correo de prueba enviado a ${employee.email}. URL: ${nodemailer.getTestMessageUrl(info)}`);
          }

          results.push({ email: employee.email, success: true });
          sent++;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          results.push({ email: employee.email ?? 'desconocido', success: false, error: errorMessage });
          failed++;
        }
      }

      res.status(200).json({ sent, failed, results });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Error al enviar los recibos de pago: ${errorMessage}` });
    }
  }
}
