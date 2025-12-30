import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { Decimal } from '@prisma/client/runtime/client.js';


export class SeedController {
  
  async runSeed(req: Request, res: Response) {
    const auth = req.headers.authorization;
    const SECRET = process.env.SEED_SECRET || 'mi-seed-key';

    if (auth !== `Bearer ${SECRET}`) return res.status(401).json({ error: 'No autorizado' });

    try {
      console.log('📡 Intentando despertar la base de datos...');
      // 1. PING DE CALENTAMIENTO: Una consulta ultra simple para abrir el túnel
      await prisma.$executeRawUnsafe('SELECT 1');
      
      const commonHashedPassword = await bcrypt.hash('password123', 10);

      // 2. PARÁMETROS LEGALES (SECUENCIAL): 
      // Usamos un bucle for tradicional. Es un poco más lento pero evita el ETIMEDOUT.
      const legalParameters = [
        { key: 'legal_parameters_sss_employee', value: JSON.stringify({ percentage: 8.75 }), description: 'SSS Empleado' },
        { key: 'legal_parameters_sss_employer', value: JSON.stringify({ percentage: 12.25 }), description: 'SSS Patrono' },
        { key: 'legal_parameters_educational', value: JSON.stringify({ percentage: 1.25 }), description: 'Seguro Educativo' },
        { key: 'legal_parameters_isr_tramo1', value: JSON.stringify({ percentage: 0, range: { min: 0, max: 12000 } }), description: 'ISR 1' },
        { key: 'legal_parameters_isr_tramo2', value: JSON.stringify({ percentage: 15, range: { min: 12001, max: 36000 } }), description: 'ISR 2' },
        { key: 'legal_parameters_isr_tramo3', value: JSON.stringify({ percentage: 20, range: { min: 36001, max: 60000 } }), description: 'ISR 3' },
        { key: 'legal_parameters_isr_tramo4', value: JSON.stringify({ percentage: 25, range: { min: 60001, max: 999999 } }), description: 'ISR 4' }
      ];

      console.log('📦 Sincronizando parámetros legalmente...');
      for (const param of legalParameters) {
        await prisma.systemConfig.upsert({
          where: { key: param.key },
          update: { value: param.value },
          create: param
        });
      }

      // 3. COMPAÑÍAS
      const companyData = [
        { name: 'Intermaritime', code: 'COMP-IM', ruc: '8-111-1111' },
        { name: 'PMTS', code: 'COMP-PM', ruc: '8-222-2222' }
      ];

      for (const c of companyData) {
        const company = await prisma.company.upsert({
          where: { name: c.name },
          update: { code: c.code },
          create: { ...c, isActive: true }
        });

        const dept = await prisma.department.upsert({
          where: { id: `dept-gen-${company.id}` },
          update: {},
          create: {
            id: `dept-gen-${company.id}`,
            name: 'Administración',
            companyId: company.id,
            isActive: true
          }
        });

        // Datos específicos por compañía
        const isIM = c.name === 'Intermaritime';
        const empData = isIM 
          ? { cedula: '8-123-4567', firstName: 'Carlos', lastName: 'Sanchez', email: 'david@intermaritime.org', role: 'SUPER_ADMIN' }
          : { cedula: '8-999-0000', firstName: 'Maria', lastName: 'Sosa', email: 'maria.sosa@test.com', role: 'MODERATOR' };

        const user = await prisma.user.upsert({
          where: { email: empData.email },
          update: { role: empData.role as any },
          create: {
            email: empData.email,
            username: `${empData.firstName.toLowerCase()}.${empData.lastName.toLowerCase()}`,
            password: commonHashedPassword,
            role: empData.role as any,
            isActive: true,
          }
        });

        await prisma.userCompany.upsert({
          where: { userId_companyId: { userId: user.id, companyId: company.id } },
          update: {},
          create: { userId: user.id, companyId: company.id }
        });

        await prisma.employee.upsert({
          where: { cedula: empData.cedula },
          update: { companyId: company.id },
          create: {
            cedula: empData.cedula,
            firstName: empData.firstName,
            lastName: empData.lastName,
            email: empData.email,
            salary: new Decimal(isIM ? 2500 : 3000),
            userId: user.id,
            companyId: company.id,
            status: 'ACTIVE',
            hireDate: new Date(),
            position: 'Analista'
          }
        });

        await prisma.person.upsert({
          where: { userId: user.id },
          update: { companyId: company.id, departmentId: dept.id },
          create: {
            userId: user.id,
            firstName: empData.firstName,
            lastName: empData.lastName,
            fullName: `${empData.firstName} ${empData.lastName}`,
            userCode: `USR-${Math.floor(100000 + Math.random() * 900000)}`,
            status: 'Activo',
            companyId: company.id,
            departmentId: dept.id,
            position: 'Analista de Operaciones'
          }
        });
      }

      return res.status(200).json({ message: '🎉 Seed finalizado (Modo Seguro)' });

    } catch (err: any) {
      return res.status(500).json({ 
        error: 'Timeout o error de conexión', 
        message: err.message,
        code: err.code 
      });
    }
  }
}