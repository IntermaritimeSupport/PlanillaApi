// src/middlewares/authGuards.ts
// Helper centralizado para control de acceso multi-tenant.
// Usar en controllers — no duplicar esta lógica.

import { NextFunction, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';

type AnyRequest = Request & {
  userId?: string;
  userRole?: string;
  userCompanyId?: string;
};

// Roles con acceso global (ven todas las empresas)
const GLOBAL_ROLES = new Set(['GLOBAL_ADMIN']);

// Roles que administran su propia empresa
const COMPANY_ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);

/**
 * Devuelve true si el usuario autenticado es GLOBAL_ADMIN.
 */
export function isGlobalAdmin(req: AnyRequest): boolean {
  return GLOBAL_ROLES.has(req.userRole ?? '');
}

/**
 * Devuelve true si el usuario puede administrar usuarios/roles dentro de su empresa.
 */
export function isCompanyAdmin(req: AnyRequest): boolean {
  return COMPANY_ADMIN_ROLES.has(req.userRole ?? '') || isGlobalAdmin(req);
}

/**
 * Verifica que el usuario tenga acceso a la empresa solicitada.
 * - GLOBAL_ADMIN: acceso a cualquier empresa.
 * - Resto: solo a su empresa (userCompanyId del JWT).
 *
 * Devuelve el companyId efectivo para usar en queries, o envía 403 y retorna null.
 */
export function resolveCompanyAccess(
  req: AnyRequest,
  res: Response,
  requestedCompanyId: string
): string | null {
  if (!req.userId) {
    res.status(401).json({ error: 'No autenticado.' });
    return null;
  }

  if (isGlobalAdmin(req)) {
    return requestedCompanyId;
  }

  if (!req.userCompanyId) {
    res.status(403).json({ error: 'El usuario no tiene empresa asignada.' });
    return null;
  }

  if (req.userCompanyId !== requestedCompanyId) {
    res.status(403).json({ error: 'Acceso denegado: empresa no permitida.' });
    return null;
  }

  return requestedCompanyId;
}

/**
 * Retorna el filtro de companyId para queries Prisma.
 * - GLOBAL_ADMIN sin companyId en query: no filtra (ve todo).
 * - GLOBAL_ADMIN con companyId: filtra por esa empresa.
 * - Resto: siempre filtra por su propia empresa.
 */
export function getCompanyFilter(
  req: AnyRequest,
  requestedCompanyId?: string
): string | undefined {
  if (isGlobalAdmin(req)) {
    return requestedCompanyId ?? undefined;
  }
  // SUPER_ADMIN puede tener múltiples empresas: respetar el companyId explícito del query
  return requestedCompanyId ?? req.userCompanyId;
}

/**
 * Middleware express que rechaza si el rol no está en la lista permitida.
 * Uso: router.get('/ruta', verifyJWT, requireRole(['SUPER_ADMIN', 'GLOBAL_ADMIN']), handler)
 */
export function requireRole(roles: string[]) {
  return (req: AnyRequest, res: Response, next: () => void): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
      return;
    }
    next();
  };
}

/**
 * Middleware que verifica que la empresa solicitada (por companyCode o companyId en la URL)
 * esté activa. Si no lo está, responde 403 con error COMPANY_INACTIVE.
 *
 * GLOBAL_ADMIN siempre pasa (sin restricción de empresa activa).
 *
 * Prioridad de lookup:
 *   1. req.params.companyCode  → busca por Company.code
 *   2. req.params.companyId    → busca por Company.id
 *   3. req.query.companyId     → busca por Company.id
 *
 * Uso: router.get('/:companyCode/...', verifyJWT, requireActiveCompany, handler)
 */
export function requireActiveCompany(
  req: AnyRequest,
  res: Response,
  next: NextFunction
): void {
  // GLOBAL_ADMIN no está limitado a ninguna empresa
  if (isGlobalAdmin(req)) {
    next();
    return;
  }

  const { companyCode, companyId } = req.params;
  const queryCompanyId = req.query?.companyId as string | undefined;
  const bodyCompanyId = (req as AnyRequest & { body?: Record<string, unknown> }).body?.companyId as string | undefined;

  const runCheck = async () => {
    let company: { isActive: boolean } | null = null;

    if (companyCode) {
      company = await prisma.company.findUnique({
        where: { code: companyCode },
        select: { isActive: true },
      });
    } else if (companyId || queryCompanyId || bodyCompanyId) {
      company = await prisma.company.findUnique({
        where: { id: (companyId || queryCompanyId || bodyCompanyId)! },
        select: { isActive: true },
      });
    }

    // Si no encontramos empresa por params, dejamos pasar (la ruta la validará)
    if (!company) {
      next();
      return;
    }

    if (!company.isActive) {
      res.status(403).json({ error: 'COMPANY_INACTIVE' });
      return;
    }

    next();
  };

  runCheck().catch((err) => {
    console.error('[requireActiveCompany] Error al verificar empresa:', err);
    res.status(500).json({ error: 'Error interno al verificar estado de empresa.' });
  });
}
