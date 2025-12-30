import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { Decimal } from '@prisma/client/runtime/client.js';


export class SeedController {
  
  private generateNextUserCode(): string {
    return `USR-${Math.floor(100000 + Math.random() * 900000)}`;
  }

  async runSeed(req: Request, res: Response) {
    const auth = req.headers.authorization;
    const SECRET = process.env.SEED_SECRET || 'mi-seed-key';

    if (auth !== `Bearer ${SECRET}`) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    try {
      console.log('🚀 Iniciando Seed...');

      // 1. Hashear contraseña una sola vez para ahorrar CPU
      const commonHashedPassword = await bcrypt.hash('password123', 10);

      // 2. Parámetros Legales: Usamos Promise.all con upsert para máxima compatibilidad
      const legalParameters = [
        { key: 'legal_parameters_sss_employee', value: JSON.stringify({ percentage: 8.75, category: 'social_security' }), description: 'SSS Empleado' },
        { key: 'legal_parameters_sss_employer', value: JSON.stringify({ percentage: 12.25, category: 'social_security' }), description: 'SSS Patrono' },
        { key: 'legal_parameters_educational', value: JSON.stringify({ percentage: 1.25, category: 'educational_insurance' }), description: 'Seguro Educativo' },
        { key: 'legal_parameters_isr_tramo1', value: JSON.stringify({ percentage: 0, range: { min: 0, max: 12000 } }), description: 'ISR Tramo 1' },
        { key: 'legal_parameters_isr_tramo2', value: JSON.stringify({ percentage: 15, range: { min: 12001, max: 36000 } }), description: 'ISR Tramo 2' },
        { key: 'legal_parameters_isr_tramo3', value: JSON.stringify({ percentage: 20, range: { min: 36001, max: 60000 } }), description: 'ISR Tramo 3' },
        { key: 'legal_parameters_isr_tramo4', value: JSON.stringify({ percentage: 25, range: { min: 60001, max: 999999 } }), description: 'ISR Tramo 4' }
      ];

      await Promise.all(legalParameters.map(param => 
        prisma.systemConfig.upsert({
          where: { key: param.key },
          update: { value: param.value, description: param.description },
          create: param
        })
      ));

      // 3. Compañías y Departamentos
      const companyData = [
        { name: 'Intermaritime', code: 'COMP-IM', ruc: '8-111-1111' },
        { name: 'PMTS', code: 'COMP-PM', ruc: '8-222-2222' }
      ];

      // Creamos compañías
      const companyResults = await Promise.all(companyData.map(c => 
        prisma.company.upsert({
          where: { name: c.name },
          update: { code: c.code, ruc: c.ruc },
          create: { ...c, isActive: true }
        })
      ));

      // Creamos departamentos y empleados de forma secuencial para evitar race conditions
      for (let i = 0; i < companyResults.length; i++) {
        const company = companyResults[i];
        
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

        const empData = i === 0 
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
            salary: new Decimal(2500 + (i * 500)),
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

      return res.status(200).json({ message: '🎉 Seed completado con éxito' });

    } catch (err: any) {
      // LOG DETALLADO para Vercel
      console.error('❌ ERROR EN SEED:', JSON.stringify(err, null, 2));
      return res.status(500).json({ 
        error: 'Fallo en la semilla', 
        message: err.message,
        code: err.code,
        meta: err.meta 
      });
    }
  }
}