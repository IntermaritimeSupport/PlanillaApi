// lib/prisma.ts
import 'dotenv/config'
import pg from 'pg'
import { PrismaClient } from '../generated/prisma/client.js'

const connectionString = process.env.DATABASE_URL

const pool = new pg.Pool({ connectionString })
// Singleton de PrismaClient
const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Test de conexión (opcional - solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
  prisma.$connect()
    .then(() => {
      console.log('✅ Conectado a PostgreSQL (via Prisma Accelerate)')
    })
    .catch((error) => {
      console.error('❌ Error conectando a PostgreSQL:', error.message)
    })
}

export default prisma