import 'dotenv/config'
import prisma from '../lib/prisma.js'
import bcrypt from 'bcryptjs'
import { Decimal } from '@prisma/client/runtime/client.js';

async function main() {
  console.time('⏱️ Tiempo total de Seed');
  console.log('🚀 Iniciando Seed Ultra-Rápido...');

  // 1. Hashear contraseñas en paralelo ANTES de tocar la DB
  // Hacer esto antes evita bloquear el event loop durante las consultas
  const hashedPw = await bcrypt.hash('password123', 10);

  // 2. PARÁMETROS LEGALES (Uso de createMany para 1 sola transacción)
  // Nota: createMany con skipDuplicates es lo más rápido que existe en Prisma
  const legalParameters = [
    { key: 'legal_parameters_sss_employee', value: JSON.stringify({ percentage: 8.75, category: 'social_security' }), description: 'Aporte SSS Empleado' },
    { key: 'legal_parameters_sss_employer', value: JSON.stringify({ percentage: 12.25, category: 'social_security' }), description: 'Aporte SSS Patrono' },
    { key: 'legal_parameters_educational', value: JSON.stringify({ percentage: 1.25, category: 'educational_insurance' }), description: 'Seguro Educativo' },
    { key: 'legal_parameters_isr_tramo1', value: JSON.stringify({ percentage: 0, range: { min: 0, max: 12000 } }), description: 'ISR Tramo 1' },
    { key: 'legal_parameters_isr_tramo2', value: JSON.stringify({ percentage: 15, range: { min: 12001, max: 36000 } }), description: 'ISR Tramo 2' },
    { key: 'legal_parameters_isr_tramo3', value: JSON.stringify({ percentage: 20, range: { min: 36001, max: 60000 } }), description: 'ISR Tramo 3' },
    { key: 'legal_parameters_isr_tramo4', value: JSON.stringify({ percentage: 25, range: { min: 60001, max: 999999 } }), description: 'ISR Tramo 4' }
  ];

  console.log('📦 Sincronizando parámetros...');
  await prisma.systemConfig.createMany({
    data: legalParameters,
    skipDuplicates: true, // Si ya existen, no hace nada (muy rápido)
  });

  // 3. COMPAÑÍAS Y DEPARTAMENTOS
  // Usamos upsert pero los disparamos todos juntos
  const companyData = [
    { name: 'Intermaritime', code: 'COMP-IM', ruc: '8-111-1111' },
    { name: 'PMTS', code: 'COMP-PM', ruc: '8-222-2222' }
  ];

  const results = await Promise.all(companyData.map(c => 
    prisma.company.upsert({
      where: { name: c.name },
      update: { code: c.code },
      create: { ...c, isActive: true }
    })
  ));

  // 4. CREACIÓN DE USUARIOS Y EMPLEADOS
  // Para ir lo más rápido posible, creamos los registros base
  const employeesData = [
    { cedula: '8-123-4567', firstName: 'Carlos', lastName: 'Sanchez', email: 'david@intermaritime.org', salary: 2500, companyId: results[0].id },
    { cedula: '8-999-0000', firstName: 'Maria', lastName: 'Sosa', email: 'maria.sosa@test.com', salary: 3000, companyId: results[1].id }
  ];

  for (const emp of employeesData) {
    // Upsert de Usuario
    const user = await prisma.user.upsert({
      where: { email: emp.email },
      update: {},
      create: {
        email: emp.email,
        username: `${emp.firstName.toLowerCase()}${Math.floor(Math.random() * 99)}`,
        password: hashedPw,
        role: 'SUPER_ADMIN',
        isActive: true,
      }
    });

    // Upsert de Empleado
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
        companyId: emp.companyId,
        status: 'ACTIVE',
        hireDate: new Date(),
        position: 'Analista'
      }
    });
  }

  console.timeEnd('⏱️ Tiempo total de Seed');
  console.log('🎉 Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });