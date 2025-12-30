import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { Decimal } from '@prisma/client/runtime/client.js';


export class SeedController {
  
  private generateNextUserCode(): string {
    return `USR-${Math.floor(100000 + Math.random() * 900000)}`;
  }

  async runSeed(req: Request, res: Response) {
    // 1. Protección de seguridad rápida
    const auth = req.headers.authorization;
    const SECRET = process.env.SEED_SECRET || 'mi-seed-key';

    if (auth !== `Bearer ${SECRET}`) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    try {
      console.time('🚀 ExecutionTime');
      
      // OPTIMIZACIÓN 1: Hashear la contraseña una sola vez (Bcrypt es lento)
      const commonHashedPassword = await bcrypt.hash('password123', 10);

      // OPTIMIZACIÓN 2: Parámetros legales con createMany (Súper rápido)
      const legalParameters = [
        { key: 'legal_parameters_sss_employee', value: JSON.stringify({ percentage: 8.75, category: 'social_security' }), description: 'SSS Empleado' },
        { key: 'legal_parameters_sss_employer', value: JSON.stringify({ percentage: 12.25, category: 'social_security' }), description: 'SSS Patrono' },
        { key: 'legal_parameters_educational', value: JSON.stringify({ percentage: 1.25, category: 'educational_insurance' }), description: 'Seguro Educativo' },
        { key: 'legal_parameters_isr_tramo1', value: JSON.stringify({ percentage: 0, range: { min: 0, max: 12000 } }), description: 'ISR Tramo 1' },
        { key: 'legal_parameters_isr_tramo2', value: JSON.stringify({ percentage: 15, range: { min: 12001, max: 36000 } }), description: 'ISR Tramo 2' },
        { key: 'legal_parameters_isr_tramo3', value: JSON.stringify({ percentage: 20, range: { min: 36001, max: 60000 } }), description: 'ISR Tramo 3' },
        { key: 'legal_parameters_isr_tramo4', value: JSON.stringify({ percentage: 25, range: { min: 60001, max: 999999 } }), description: 'ISR Tramo 4' }
      ];

      await prisma.systemConfig.createMany({
        data: legalParameters,
        skipDuplicates: true, // Si ya existen, no fallará ni tardará nada
      });

      // OPTIMIZACIÓN 3: Compañías en paralelo
      const companyData = [
        { name: 'Intermaritime', code: 'COMP-IM', ruc: '8-111-1111' },
        { name: 'PMTS', code: 'COMP-PM', ruc: '8-222-2222' }
      ];

      const companyResults = await Promise.all(companyData.map(c => 
        prisma.company.upsert({
          where: { name: c.name },
          update: { code: c.code },
          create: { ...c, isActive: true }
        })
      ));

      // Crear departamentos por defecto rápidamente
      const depts = await Promise.all(companyResults.map(company => 
        prisma.department.upsert({
          where: { id: `dept-gen-${company.id}` },
          update: {},
          create: {
            id: `dept-gen-${company.id}`,
            name: 'Administración',
            companyId: company.id,
            isActive: true
          }
        })
      ));

      // 4. Empleados y Personas
      const employeesData = [
        { cedula: '8-123-4567', firstName: 'Carlos', lastName: 'Sanchez', email: 'david@intermaritime.org', salary: 2500, companyIdx: 0 },
        { cedula: '8-999-0000', firstName: 'Maria', lastName: 'Sosa', email: 'maria.sosa@test.com', salary: 3000, companyIdx: 1 }
      ];

      for (const emp of employeesData) {
        const targetCompany = companyResults[emp.companyIdx];
        const targetDept = depts[emp.companyIdx];

        // Upsert de Usuario (Ya tiene el hash calculado)
        const user = await prisma.user.upsert({
          where: { email: emp.email },
          update: { role: emp.companyIdx === 0 ? 'SUPER_ADMIN' : 'MODERATOR' },
          create: {
            email: emp.email,
            username: `${emp.firstName.toLowerCase()}.${emp.lastName.toLowerCase()}${Math.floor(Math.random() * 99)}`,
            password: commonHashedPassword,
            role: emp.companyIdx === 0 ? 'SUPER_ADMIN' : 'MODERATOR',
            isActive: true,
          }
        });

        // Conectar Usuario con Compañía
        await prisma.userCompany.upsert({
          where: { userId_companyId: { userId: user.id, companyId: targetCompany.id } },
          update: {},
          create: { userId: user.id, companyId: targetCompany.id }
        });

        // Crear Empleado
        await prisma.employee.upsert({
          where: { cedula: emp.cedula },
          update: { salary: new Decimal(emp.salary) },
          create: {
            cedula: emp.cedula,
            firstName: emp.firstName,
            lastName: emp.lastName,
            email: emp.email,
            salary: new Decimal(emp.salary),
            userId: user.id,
            companyId: targetCompany.id,
            status: 'ACTIVE',
            hireDate: new Date(),
            position: 'Analista'
          }
        });

        // Crear registro en Person
        await prisma.person.upsert({
          where: { userId: user.id },
          update: { companyId: targetCompany.id, departmentId: targetDept.id },
          create: {
            userId: user.id,
            firstName: emp.firstName,
            lastName: emp.lastName,
            fullName: `${emp.firstName} ${emp.lastName}`,
            userCode: this.generateNextUserCode(),
            status: 'Activo',
            companyId: targetCompany.id,
            departmentId: targetDept.id,
            position: 'Analista de Operaciones'
          }
        });
      }

      console.timeEnd('🚀 ExecutionTime');
      return res.status(200).json({ message: '🎉 Seed ultra-rápido ejecutado con éxito' });

    } catch (err: any) {
      console.error('❌ Error:', err);
      return res.status(500).json({ error: 'Fallo en la semilla', details: err.message });
    }
  }
}