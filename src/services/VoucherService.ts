// ─────────────────────────────────────────────────────────────────────────────
// VoucherService.ts
// Genera el PDF del comprobante de pago y lo envía por email al empleado
// ─────────────────────────────────────────────────────────────────────────────

import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface VoucherPayroll {
  payrollNumber: string;
  payPeriod: Date | string;
  paymentDate: Date | string;
  payrollType: string;
  baseSalary: number;
  grossSalary: number;
  incomeTax: number;
  sss: number;
  privateInsurance: number;
  customDeductions: number;
  totalDeductions: number;
  netSalary: number;
  thirteenthMonthAmount?: number | null;
  deductions?: Array<{ description: string; amount: number }>;
  allowances?: Array<{ description?: string; allowanceType?: string; amount: number }>;
  quincena?: number;
}

export interface VoucherEmployee {
  id: string;
  cedula: string;
  firstName: string;
  lastName: string;
  email: string;
  position?: string;
  department?: string;
  bankAccount?: string;
  bankName?: string;
  salaryType?: string;
}

export interface VoucherCompany {
  name: string;
  ruc?: string;
  address?: string;
  phone?: string;
  email?: string;
}

// ─── Helpers de formato ───────────────────────────────────────────────────────
const fmt = (n: number) =>
  `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric' });

// ─── Generador de PDF ─────────────────────────────────────────────────────────
export const generateVoucherPDF = (
  payroll: VoucherPayroll,
  employee: VoucherEmployee,
  company: VoucherCompany
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const ML = 40;
    const MR = W - 40;

    // ── CABECERA ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, W, 80).fill('#1e3a8a');
    doc.fill('white').fontSize(18).font('Helvetica-Bold')
      .text(company.name, ML, 18, { width: W - 80, align: 'center' });
    doc.fontSize(9).font('Helvetica')
      .text('COMPROBANTE DE PAGO', ML, 42, { width: W - 80, align: 'center' })
      .text(`RUC: ${company.ruc || 'N/A'}   Tel: ${company.phone || 'N/A'}`, ML, 58, { width: W - 80, align: 'center' });

    // ── DATOS DEL PERÍODO ─────────────────────────────────────────────────────
    let y = 100;
    doc.fill('#1e3a8a').rect(ML, y, W - 80, 20).fill();
    doc.fill('white').fontSize(9).font('Helvetica-Bold')
      .text('DATOS DEL PERÍODO', ML + 6, y + 5);

    y += 25;
    doc.fill('#1e293b').fontSize(8.5).font('Helvetica');

    const q = payroll.quincena;
    const tipoLabel =
      payroll.payrollType === 'MONTHLY' ? 'Mensual' :
      payroll.payrollType === 'THIRTEEN_MONTH' ? 'Décimo Tercer Mes' :
      q === 1 ? 'Quincenal 1ra' : 'Quincenal 2da';

    const periodInfo: [string, string][] = [
      ['No. Comprobante:', payroll.payrollNumber],
      ['Período:', fmtDate(payroll.payPeriod)],
      ['Fecha de Pago:', fmtDate(payroll.paymentDate)],
      ['Tipo de Nómina:', tipoLabel],
    ];

    periodInfo.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(label, ML, y, { continued: true })
         .font('Helvetica').text(` ${value}`, { continued: false });
      y += 16;
    });

    // ── DATOS DEL EMPLEADO ────────────────────────────────────────────────────
    y += 10;
    doc.fill('#1e3a8a').rect(ML, y, W - 80, 20).fill();
    doc.fill('white').fontSize(9).font('Helvetica-Bold')
      .text('DATOS DEL EMPLEADO', ML + 6, y + 5);

    y += 25;
    doc.fill('#1e293b').fontSize(8.5);

    const empInfo: [string, string][] = [
      ['Nombre:', `${employee.firstName} ${employee.lastName}`],
      ['Cédula:', employee.cedula],
      ['Cargo:', employee.position || 'N/A'],
      ['Departamento:', employee.department || 'N/A'],
      ['Banco:', employee.bankName || 'N/A'],
      ['No. Cuenta:', employee.bankAccount || 'N/A'],
    ];

    const colW = (W - 80) / 2 - 10;
    let leftY = y;
    let rightY = y;

    empInfo.forEach(([label, value], i) => {
      const colX = i % 2 === 0 ? ML : ML + colW + 20;
      if (i % 2 === 0) leftY += (i > 0 ? 16 : 0);
      else rightY += 16;
      const rowY = i % 2 === 0 ? leftY : rightY;
      doc.font('Helvetica-Bold').text(label, colX, rowY, { continued: true, width: colW })
         .font('Helvetica').text(` ${value}`);
    });

    y = Math.max(leftY, rightY) + 22;

    // ── INGRESOS ──────────────────────────────────────────────────────────────
    doc.fill('#1e3a8a').rect(ML, y, W - 80, 20).fill();
    doc.fill('white').fontSize(9).font('Helvetica-Bold')
      .text('INGRESOS', ML + 6, y + 5);
    y += 25;

    doc.fill('#f1f5f9').rect(ML, y - 3, W - 80, 16).fill();
    doc.fill('#475569').fontSize(8).font('Helvetica-Bold')
      .text('Concepto', ML + 4, y)
      .text('Monto', MR - 60, y, { width: 60, align: 'right' });
    y += 18;

    doc.fill('#1e293b').font('Helvetica').fontSize(8.5);

    const incomeLines: [string, number][] = [['Salario Base', payroll.baseSalary]];
    if (payroll.allowances?.length) {
      payroll.allowances.forEach(a => {
        incomeLines.push([a.description || a.allowanceType || 'Bonificación', Number(a.amount)]);
      });
    }
    if (payroll.thirteenthMonthAmount && Number(payroll.thirteenthMonthAmount) > 0) {
      incomeLines.push(['Décimo Tercer Mes', Number(payroll.thirteenthMonthAmount)]);
    }

    incomeLines.forEach(([label, amount], i) => {
      if (i % 2 === 0) doc.fill('#f8fafc').rect(ML, y - 2, W - 80, 14).fill();
      doc.fill('#1e293b').text(label, ML + 4, y)
         .text(fmt(amount), MR - 60, y, { width: 60, align: 'right' });
      y += 16;
    });

    doc.fill('#dbeafe').rect(ML, y - 2, W - 80, 18).fill();
    doc.fill('#1e3a8a').font('Helvetica-Bold')
      .text('TOTAL INGRESOS BRUTOS', ML + 4, y + 2)
      .text(fmt(payroll.grossSalary), MR - 60, y + 2, { width: 60, align: 'right' });
    y += 26;

    // ── DEDUCCIONES ───────────────────────────────────────────────────────────
    doc.fill('#7f1d1d').rect(ML, y, W - 80, 20).fill();
    doc.fill('white').fontSize(9).font('Helvetica-Bold')
      .text('DEDUCCIONES', ML + 6, y + 5);
    y += 25;

    doc.fill('#f1f5f9').rect(ML, y - 3, W - 80, 16).fill();
    doc.fill('#475569').fontSize(8).font('Helvetica-Bold')
      .text('Concepto', ML + 4, y)
      .text('Monto', MR - 60, y, { width: 60, align: 'right' });
    y += 18;

    doc.fill('#1e293b').font('Helvetica').fontSize(8.5);

    const deductionLines: [string, number][] = [
      ['Seguro Social (9.75%)', payroll.sss],
      ['Impuesto Sobre la Renta (ISR)', payroll.incomeTax],
    ];
    if (payroll.privateInsurance > 0) {
      deductionLines.push(['Seguro Privado', payroll.privateInsurance]);
    }
    if (payroll.deductions?.length) {
      payroll.deductions.forEach(d => deductionLines.push([d.description, Number(d.amount)]));
    }

    deductionLines.forEach(([label, amount], i) => {
      if (i % 2 === 0) doc.fill('#fff7f7').rect(ML, y - 2, W - 80, 14).fill();
      doc.fill('#1e293b').text(label, ML + 4, y)
         .text(fmt(amount), MR - 60, y, { width: 60, align: 'right' });
      y += 16;
    });

    doc.fill('#fee2e2').rect(ML, y - 2, W - 80, 18).fill();
    doc.fill('#7f1d1d').font('Helvetica-Bold')
      .text('TOTAL DEDUCCIONES', ML + 4, y + 2)
      .text(fmt(payroll.totalDeductions), MR - 60, y + 2, { width: 60, align: 'right' });
    y += 28;

    // ── NETO A RECIBIR ────────────────────────────────────────────────────────
    doc.fill('#14532d').rect(ML, y, W - 80, 36).fill();
    doc.fill('white').fontSize(13).font('Helvetica-Bold')
      .text('NETO A RECIBIR', ML + 8, y + 9)
      .text(fmt(payroll.netSalary), MR - 90, y + 9, { width: 90, align: 'right' });
    y += 50;

    // ── PIE DE PÁGINA ─────────────────────────────────────────────────────────
    doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(ML, y).lineTo(MR, y).stroke();
    y += 10;
    doc.fill('#94a3b8').fontSize(7.5).font('Helvetica')
      .text(
        `Este comprobante fue generado automáticamente por el Sistema de Planilla de ${company.name}. ` +
        `Fecha de emisión: ${new Date().toLocaleDateString('es-PA')}.`,
        ML, y, { width: W - 80, align: 'center' }
      );

    doc.end();
  });
};

// ─── Transporter de email ─────────────────────────────────────────────────────
const createTransporter = () => {
  const service = process.env.EMAIL_SERVICE || 'gmail';

  if (service === 'smtp') {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER!,
        pass: process.env.EMAIL_PASS!,
      },
    } as any);
  }

  return nodemailer.createTransport({
    service,
    auth: {
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_PASS!,
    },
  } as any);
};

// ─── Envío de comprobante ─────────────────────────────────────────────────────
export const sendPayrollVoucher = async (
  payroll: VoucherPayroll,
  employee: VoucherEmployee,
  company: VoucherCompany
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    const pdfBuffer = await generateVoucherPDF(payroll, employee, company);
    const transporter = createTransporter();

    const period = fmtDate(payroll.payPeriod);
    const fileName = `Comprobante_${employee.cedula}_${new Date(payroll.payPeriod).toISOString().slice(0, 7)}.pdf`;

    const mailOptions = {
      from: `"${company.name}" <${process.env.EMAIL_USER}>`,
      to: employee.email,
      subject: `Comprobante de Pago — ${period} | ${company.name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
          <div style="background:#1e3a8a;padding:24px 32px;border-radius:8px 8px 0 0">
            <h1 style="color:white;margin:0;font-size:20px">${company.name}</h1>
            <p style="color:#93c5fd;margin:6px 0 0;font-size:13px">Comprobante de Pago</p>
          </div>
          <div style="background:#f8fafc;padding:28px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0">
            <p style="margin:0 0 16px">Estimado/a <strong>${employee.firstName} ${employee.lastName}</strong>,</p>
            <p style="margin:0 0 16px;color:#475569">
              Adjunto encontrará su comprobante de pago correspondiente al período de <strong>${period}</strong>.
            </p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;background:white;border-radius:6px;overflow:hidden;border:1px solid #e2e8f0">
              <tr style="background:#eff6ff">
                <td style="padding:10px 16px;font-weight:bold;color:#1e3a8a;width:50%">Salario Bruto</td>
                <td style="padding:10px 16px;text-align:right;font-weight:bold">${fmt(payroll.grossSalary)}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#475569">Total Deducciones</td>
                <td style="padding:10px 16px;text-align:right;color:#dc2626">(${fmt(payroll.totalDeductions)})</td>
              </tr>
              <tr style="background:#f0fdf4;border-top:2px solid #16a34a">
                <td style="padding:12px 16px;font-weight:bold;color:#15803d;font-size:15px">NETO A RECIBIR</td>
                <td style="padding:12px 16px;text-align:right;font-weight:bold;color:#15803d;font-size:15px">${fmt(payroll.netSalary)}</td>
              </tr>
            </table>
            <p style="color:#64748b;font-size:12px;margin:16px 0 0">
              El PDF adjunto contiene el detalle completo de ingresos y deducciones.
              Si tiene alguna duda, comuníquese con el departamento de Recursos Humanos.
            </p>
          </div>
          <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:16px">
            Este correo fue generado automáticamente. Por favor no responda a este mensaje.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Error enviando comprobante:', error);
    return { success: false, error: error.message };
  }
};
