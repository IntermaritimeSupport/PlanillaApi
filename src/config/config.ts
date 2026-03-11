import dotenv from 'dotenv';

// Este módulo debe ser el PRIMERO en importarse en server.ts
// para garantizar que process.env esté poblado antes que cualquier otro módulo
dotenv.config({ path: '.env' });

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'SESSION_SECRET'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[FATAL] Variables de entorno faltantes: ${missing.join(', ')}`);
  process.exit(1);
}

export const env = {
  JWT_SECRET:      process.env.JWT_SECRET!,
  SESSION_SECRET:  process.env.SESSION_SECRET!,
  DATABASE_URL:    process.env.DATABASE_URL!,
  PORT:            process.env.PORT ?? '3000',
  NODE_ENV:        process.env.NODE_ENV ?? 'development',
};
