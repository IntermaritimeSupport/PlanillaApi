import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { Decimal } from '@prisma/client/runtime/client.js';

export class SeedController {
  
  private generateNextUserCode(): string {
    return `USR-${Math.floor(100000 + Math.random() * 900000)}`;
  }

  private async hashPassword(password: string) {
    // Usar rounds bajos (10) es suficiente y rápido para serverless
    return await bcrypt.hash(password, 10);
  }

  private async getAvailableUserForEmployee(
    email: string,
    firstName: string,
    lastName: string,
    companyId: string,
    role: any = 'USER'
  ) {
    const hashedPassword = await this.hashPassword('password123');
    const user = await prisma.user.upsert({
      where: { email },
      update: { role }, // Actualizar rol si ya existe
      create: {
        email,
        username: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 100)}`,
        password: hashedPassword,
        role: role,
        isActive: true,
      },
    });

    await prisma.userCompany.upsert({
      where: { userId_companyId: { userId: user.id, companyId } },
      update: {},
      create: { userId: user.id, companyId }
    });

    return user;
  }

  /* ============================
      MÉTODO PRINCIPAL (HANDLER)
     ============================ */

  async runSeed(req: Request, res: Response) {
    const auth = req.headers.authorization;
    const SECRET = process.env.SEED_SECRET || 'mi-seed-key';

    if (auth !== `Bearer ${SECRET}`) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
      console.log('🚀 Iniciando Seed Optimizado...');

      // --- 1. PARÁMETROS LEGALES (EJECUCIÓN PARALELA) ---
      const legalParameters = [
        { key: 'legal_parameters_sss_employee', value: JSON.stringify({ name: 'Aporte del Empleado al SSS', type: 'employee', percentage: 8.75, effectiveDate: new Date().toISOString().split('T')[0], status: 'active', category: 'social_security' }), description: 'Aporte obligatorio del empleado al Seguro Social' },
        { key: 'legal_parameters_sss_employer', value: JSON.stringify({ name: 'Aporte del Patrono al SSS', type: 'employer', percentage: 12.25, effectiveDate: new Date().toISOString().split('T')[0], status: 'active', category: 'social_security' }), description: 'Aporte obligatorio del patrono al Seguro Social' },
        { key: 'legal_parameters_educational', value: JSON.stringify({ name: 'Seguro Educativo', type: 'employer', percentage: 1.25, effectiveDate: new Date().toISOString().split('T')[0], status: 'active', category: 'educational_insurance' }), description: 'Aporte del patrono para seguro educativo' },
        { key: 'legal_parameters_isr_tramo1', value: JSON.stringify({ name: 'Tramo 1: Exento', type: 'employee', percentage: 0, range: { min: 0, max: 12000 }, effectiveDate: new Date().toISOString().split('T')[0], status: 'active', category: 'isr' }), description: 'Rango exento de ISR en Panamá' },
        { key: 'legal_parameters_isr_tramo2', value: JSON.stringify({ name: 'Tramo 2: 15%', type: 'employee', percentage: 15, range: { min: 12001, max: 36000 }, effectiveDate: new Date().toISOString().split('T')[0], status: 'active', category: 'isr' }), description: 'Rango 15% de ISR en Panamá' },
        { key: 'legal_parameters_isr_tramo3', value: JSON.stringify({ name: 'Tramo 3: 20%', type: 'employee', percentage: 20, range: { min: 36001, max: 60000 }, effectiveDate: new Date().toISOString().split('T')[0], status: 'active', category: 'isr' }), description: 'Rango 20% de ISR en Panamá' },
        { key: 'legal_parameters_isr_tramo4', value: JSON.stringify({ name: 'Tramo 4: 25%', type: 'employee', percentage: 25, range: { min: 60001, max: 999999 }, effectiveDate: new Date().toISOString().split('T')[0], status: 'active', category: 'isr' }), description: 'Rango 25% de ISR en Panamá' }
      ];

      await Promise.all(legalParameters.map(param => 
        prisma.systemConfig.upsert({
          where: { key: param.key },
          update: { value: param.value, description: param.description },
          create: param,
        })
      ));

      // --- 2. COMPAÑÍAS Y DEPARTAMENTOS ---
      const companyData = [
        { name: 'Intermaritime', code: 'COMP-IM', ruc: '8-111-1111' },
        { name: 'PMTS', code: 'COMP-PM', ruc: '8-222-2222' }
      ];

      const companies: Record<string, any> = {};
      const departments: Record<string, any> = {};

      for (const data of companyData) {
        const company = await prisma.company.upsert({
          where: { name: data.name },
          update: { code: data.code, ruc: data.ruc },
          create: { name: data.name, code: data.code, ruc: data.ruc, isActive: true }
        });
        companies[data.name] = company;

        const dept = await prisma.department.upsert({
          where: { id: `dept-gen-${company.id}` },
          update: {},
          create: {
            id: `dept-gen-${company.id}`,
            name: 'Administración',
            description: `Departamento general de ${company.name}`,
            companyId: company.id,
            isActive: true
          }
        });
        departments[company.name] = dept;
      }

      // --- 3. EMPLEADOS Y PERSONAS (PROCESO SECUENCIAL PARA EVITAR BLOQUEOS) ---
      const employeesData = [
        { cedula: '8-123-4567', firstName: 'Carlos', lastName: 'Sanchez', email: 'david@intermaritime.org', salary: 2500, companyName: 'Intermaritime', role: 'SUPER_ADMIN' },
        { cedula: '8-999-0000', firstName: 'Maria', lastName: 'Sosa', email: 'maria.sosa@test.com', salary: 3000, companyName: 'PMTS', role: 'MODERATOR' }
      ];

      for (const emp of employeesData) {
        const targetCompany = companies[emp.companyName];
        const targetDept = departments[emp.companyName];
        const user = await this.getAvailableUserForEmployee(emp.email, emp.firstName, emp.lastName, targetCompany.id, emp.role);

        await prisma.employee.upsert({
          where: { cedula: emp.cedula },
          update: { 
            companyId: targetCompany.id,
            salary: new Decimal(emp.salary)
          },
          create: {
            cedula: emp.cedula,
            firstName: emp.firstName,
            lastName: emp.lastName,
            email: emp.email,
            position: 'Analista',
            hireDate: new Date(),
            salary: new Decimal(emp.salary),
            userId: user.id,
            companyId: targetCompany.id,
            status: 'ACTIVE'
          }
        });

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

      return res.status(200).json({ message: '🎉 Seed ejecutado con éxito' });

    } catch (err: any) {
      console.error('❌ Error fatal en Seed:', err);
      return res.status(500).json({ 
        error: 'Error al ejecutar seed', 
        details: err.message,
        code: err.code // Útil para debuggear timeouts de base de datos
      });
    }
  }
}