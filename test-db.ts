// prisma/seed.ts
import 'dotenv/config'
import { hash } from 'bcryptjs'
import prisma from './lib/prisma.js'


async function main() {
  console.log('🚀 Iniciando seed...')

  try {
    // 1. Crear compañías
    console.log('\n📊 Creando compañías...')
    
    const intermaritime = await prisma.company.upsert({
      where: { code: 'CO001' },
      update: {},
      create: {
        code: 'CO001',
        name: 'Intermaritime',
        address: 'Ciudad de Panamá, Edificio TechHub, Piso 5',
        phone: '+507 800-1234',
        email: 'info@intermaritime.com',
        isActive: true,
      },
    })
    console.log(`✅ Compañía: ${intermaritime.name} (${intermaritime.code})`)

    const pmts = await prisma.company.upsert({
      where: { code: 'CO002' },
      update: {},
      create: {
        code: 'CO002',
        name: 'PMTS',
        address: 'Ciudad de Panamá, Oficina PMTS',
        phone: '+507 300-5678',
        email: 'contact@pmts.com',
        isActive: true,
      },
    })
    console.log(`✅ Compañía: ${pmts.name} (${pmts.code})`)

    // 2. Crear usuarios
    console.log('\n👥 Creando usuarios...')
    
    const passwordModerator = await hash('moderator123', 12)
    const passwordAdmin = await hash('admin123', 12)
    const passwordSuperAdmin = await hash('superadmin123', 12)

    const moderator = await prisma.user.upsert({
      where: { email: 'contador@intermaritime.org' },
      update: {
        password: passwordModerator,
        companyId: pmts.id,
      },
      create: {
        username: 'contador',
        email: 'contador@intermaritime.org',
        password: passwordModerator,
        role: 'MODERATOR',
        isActive: true,
        companyId: pmts.id,
      },
    })
    console.log(`✅ Usuario: ${moderator.email} (${moderator.role})`)

    const admin = await prisma.user.upsert({
      where: { email: 'alex@intermaritime.org' },
      update: {
        password: passwordAdmin,
        companyId: intermaritime.id,
      },
      create: {
        username: 'alex',
        email: 'alex@intermaritime.org',
        password: passwordAdmin,
        role: 'ADMIN',
        isActive: true,
        companyId: intermaritime.id,
      },
    })
    console.log(`✅ Usuario: ${admin.email} (${admin.role})`)

    const superAdmin = await prisma.user.upsert({
      where: { email: 'david@intermaritime.org' },
      update: {
        password: passwordSuperAdmin,
        companyId: intermaritime.id,
      },
      create: {
        username: 'david',
        email: 'david@intermaritime.org',
        password: passwordSuperAdmin,
        role: 'SUPER_ADMIN',
        isActive: true,
        companyId: intermaritime.id,
      },
    })
    console.log(`✅ Usuario: ${superAdmin.email} (${superAdmin.role})`)

    // 3. Crear departamentos para Intermaritime
    console.log('\n🏢 Creando departamentos para Intermaritime...')
    
    const deptIntermaritime = [
      { name: 'IT', description: 'Departamento de Tecnología' },
      { name: 'Recursos Humanos', description: 'Gestión de personal' },
      { name: 'Operaciones', description: 'Operaciones diarias' },
      { name: 'Finanzas', description: 'Gestión financiera' },
    ]

    for (const dept of deptIntermaritime) {
      const existing = await prisma.department.findFirst({
        where: {
          companyId: intermaritime.id,
          name: dept.name,
        },
      })

      if (existing) {
        await prisma.department.update({
          where: { id: existing.id },
          data: dept,
        })
      } else {
        await prisma.department.create({
          data: {
            ...dept,
            companyId: intermaritime.id,
          },
        })
      }
      console.log(`✅ Departamento: ${dept.name}`)
    }

    // 4. Crear departamentos para PMTS
    console.log('\n🏢 Creando departamentos para PMTS...')
    
    const deptPMTS = [
      { name: 'Administración', description: 'Administración general' },
      { name: 'Logística', description: 'Gestión de logística' },
      { name: 'Ventas', description: 'Departamento comercial' },
    ]

    for (const dept of deptPMTS) {
      const existing = await prisma.department.findFirst({
        where: {
          companyId: pmts.id,
          name: dept.name,
        },
      })

      if (existing) {
        await prisma.department.update({
          where: { id: existing.id },
          data: dept,
        })
      } else {
        await prisma.department.create({
          data: {
            ...dept,
            companyId: pmts.id,
          },
        })
      }
      console.log(`✅ Departamento: ${dept.name}`)
    }

    console.log('\n🎉 Seed completado exitosamente!')
  } catch (error) {
    console.error('❌ Error durante el seed:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error('💥 Error fatal:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    console.log('👋 Desconectado de la base de datos')
  })