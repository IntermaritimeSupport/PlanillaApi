-- ============================================================
-- MIGRACIÓN: Multi-Tenant SaaS — FlowPlanilla
-- Fecha: 2026-03-23
-- Descripción: Documenta el estado final de la arquitectura
--   multi-tenant. El schema fue sincronizado con `prisma db push`
--   durante el desarrollo; esta migración es el registro formal.
-- ============================================================

-- ── 1. GLOBAL_ADMIN en enum UserRole ─────────────────────────
-- Agrega el rol de administrador de plataforma que puede ver
-- TODAS las empresas sin restricción de companyId.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'GLOBAL_ADMIN'
      AND enumtypid = 'public."UserRole"'::regtype
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'GLOBAL_ADMIN';
  END IF;
END
$$;

-- ── 2. ss_decimo_patrono en enum LegalParameterKey ───────────
-- Clave para el parámetro de seguro social patronal del décimo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'ss_decimo_patrono'
      AND enumtypid = 'public."LegalParameterKey"'::regtype
  ) THEN
    ALTER TYPE "LegalParameterKey" ADD VALUE 'ss_decimo_patrono';
  END IF;
END
$$;

-- ── 3. userCompanyId en JWT (no requiere DDL) ─────────────────
-- El campo companyId en el payload JWT se gestiona en código.
-- AuthMiddleware.ts: req.userCompanyId = decoded.companyId

-- ── 4. Índice de companyId en Employee (si no existe) ────────
CREATE INDEX IF NOT EXISTS "Employee_companyId_idx" ON "Employee"("companyId");

-- ── 5. Índice de companyId en Payroll ────────────────────────
CREATE INDEX IF NOT EXISTS "Payroll_companyId_idx" ON "Payroll"("companyId");

-- ── 6. Índice de companyId en PayrollRun ─────────────────────
CREATE INDEX IF NOT EXISTS "PayrollRun_companyId_idx" ON "PayrollRun"("companyId");

-- ── 7. Índice de companyId en LegalParameter ─────────────────
CREATE INDEX IF NOT EXISTS "LegalParameter_companyId_idx" ON "LegalParameter"("companyId");

-- ── 8. Índice de companyId en LegalDecimoParameter ───────────
CREATE INDEX IF NOT EXISTS "LegalDecimoParameter_companyId_idx" ON "LegalDecimoParameter"("companyId");

-- ── 9. Verificar tabla salary_history ────────────────────────
-- Creada por migración 20260310; este índice complementa.
CREATE INDEX IF NOT EXISTS "salary_history_employeeId_idx" ON "salary_history"("employeeId");

-- ── 10. Verificar tabla decimo_payments ──────────────────────
CREATE INDEX IF NOT EXISTS "decimo_payments_companyId_idx" ON "decimo_payments"("companyId");

-- ── NOTAS DE SEGURIDAD MULTI-TENANT ──────────────────────────
-- • TODAS las queries de negocio filtran por companyId
--   excepto cuando req.userRole === 'GLOBAL_ADMIN'.
-- • authGuards.ts provee: resolveCompanyAccess(), getCompanyFilter(),
--   requireRole(), isGlobalAdmin(), isCompanyAdmin()
-- • JWT payload incluye: { id, username, email, roles, companyId }
-- • AdminController (/api/admin/*) accede sin filtro de empresa
--   y está protegido con requireRole(['GLOBAL_ADMIN'])
