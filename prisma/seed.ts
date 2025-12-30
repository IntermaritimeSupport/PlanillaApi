import 'dotenv/config'
import prisma from '../lib/prisma.js'
import bcrypt from 'bcryptjs'
import { Decimal } from '@prisma/client/runtime/client.js';

export function generateNextUserCode(): string {
  return `USR-${Math.floor(100000 + Math.random() * 900000)}`;
}

async function hashPassword(password: string) {
  return await bcrypt.hash(password, 10);
}

async function getAvailableUserForEmployee(
  email: string, 
  firstName: string, 
  lastName: string, 
  companyId: string, 
  role: any = 'USER'
) {
  const hashedPassword = await hashPassword('password123');
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
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

async function seedLegalParameters() {
  console.log('📋 Inicializando parámetros legales...');

  const legalParameters = [
    {
      key: 'legal_parameters_sss_employee',
      value: JSON.stringify({
        name: 'Aporte del Empleado al SSS',
        type: 'employee',
        percentage: 8.75,
        effectiveDate: new Date().toISOString().split('T')[0],
        status: 'active',
        category: 'social_security',
      }),
      description: 'Aporte obligatorio del empleado al Seguro Social',
    },
    {
      key: 'legal_parameters_sss_employer',
      value: JSON.stringify({
        name: 'Aporte del Patrono al SSS',
        type: 'employer',
        percentage: 12.25,
        effectiveDate: new Date().toISOString().split('T')[0],
        status: 'active',
        category: 'social_security',
      }),
      description: 'Aporte obligatorio del patrono al Seguro Social',
    },
    {
      key: 'legal_parameters_educational',
      value: JSON.stringify({
        name: 'Seguro Educativo',
        type: 'employer',
        percentage: 1.25,
        effectiveDate: new Date().toISOString().split('T')[0],
        status: 'active',
        category: 'educational_insurance',
      }),
      description: 'Aporte del patrono para seguro educativo',
    },
    {
      key: 'legal_parameters_isr_tramo1',
      value: JSON.stringify({
        name: 'Tramo 1: Exento',
        type: 'employee',
        percentage: 0,
        range: { min: 0, max: 12000 },
        effectiveDate: new Date().toISOString().split('T')[0],
        status: 'active',
        category: 'isr',
      }),
      description: 'Rango exento de ISR en Panamá',
    },
    {
      key: 'legal_parameters_isr_tramo2',
      value: JSON.stringify({
        name: 'Tramo 2: 15%',
        type: 'employee',
        percentage: 15,
        range: { min: 12001, max: 36000 },
        effectiveDate: new Date().toISOString().split('T')[0],
        status: 'active',
        category: 'isr',
      }),
      description: 'Rango 15% de ISR en Panamá',
    },
    {
      key: 'legal_parameters_isr_tramo3',
      value: JSON.stringify({
        name: 'Tramo 3: 20%',
        type: 'employee',
        percentage: 20,
        range: { min: 36001, max: 60000 },
        effectiveDate: new Date().toISOString().split('T')[0],
        status: 'active',
        category: 'isr',
      }),
      description: 'Rango 20% de ISR en Panamá',
    },
    {
      key: 'legal_parameters_isr_tramo4',
      value: JSON.stringify({
        name: 'Tramo 4: 25%',
        type: 'employee',
        percentage: 25,
        range: { min: 60001, max: 999999 },
        effectiveDate: new Date().toISOString().split('T')[0],
        status: 'active',
        category: 'isr',
      }),
      description: 'Rango 25% de ISR en Panamá',
    },
  ];

  let createdCount = 0;
  for (const param of legalParameters) {
    const existing = await prisma.systemConfig.findUnique({
      where: { key: param.key },
    });

    if (!existing) {
      await prisma.systemConfig.create({
        data: param,
      });
      createdCount++;
    }
  }

  console.log(`✅ ${createdCount} parámetros legales inicializados.`);
}

async function main() {
  console.log('🚀 Iniciando Seed...');

  /* ============================
      1. PARÁMETROS LEGALES
  ============================ */
  await seedLegalParameters();

  /* ============================
      2. COMPAÑÍAS Y DEPARTAMENTOS
  ============================ */
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

    // Crear un departamento por defecto para cada empresa
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

  /* ============================
      3. EMPLEADOS Y PERSONAS (Con Dept)
  ============================ */
  const employeesData = [
    {
      cedula: '8-123-4567',
      firstName: 'Carlos',
      lastName: 'Sanchez',
      email: 'david@intermaritime.org',
      salary: 2500,
      companyName: 'Intermaritime',
      role: 'SUPER_ADMIN'
    },
    {
      cedula: '8-999-0000',
      firstName: 'Maria',
      lastName: 'Sosa',
      email: 'maria.sosa@test.com',
      salary: 3000,
      companyName: 'PMTS',
      role: 'MODERATOR'
    }
  ];

  for (const emp of employeesData) {
    const targetCompany = companies[emp.companyName];
    const targetDept = departments[emp.companyName];

    const user = await getAvailableUserForEmployee(emp.email, emp.firstName, emp.lastName, targetCompany.id, emp.role);

    // Crear/Actualizar Employee
    await prisma.employee.upsert({
      where: { cedula: emp.cedula },
      update: { companyId: targetCompany.id },
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

    // Crear/Actualizar Person con departmentId
    await prisma.person.upsert({
      where: { userId: user.id },
      update: { 
        companyId: targetCompany.id,
        departmentId: targetDept.id 
      },
      create: {
        userId: user.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        fullName: `${emp.firstName} ${emp.lastName}`,
        userCode: generateNextUserCode(),
        status: 'Activo',
        companyId: targetCompany.id,
        departmentId: targetDept.id,
        position: 'Analista de Operaciones'
      }
    });
    console.log(`✅ ${emp.firstName} vinculado a ${emp.companyName} en Dept: ${targetDept.name}`);
  }

  console.log('\n🎉 Seed finalizado correctamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });