// src/middlewares/auth.middleware.ts
import { NextFunction, Request as ExpressRequest, Response as ExpressResponse } from "express";
import session from "express-session";
import jwt from "jsonwebtoken";
import { UserRole } from "../../generated/prisma/index.js";

// ─── Augmentar Express.Request para datos JWT ─────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
      userCompanyId?: string; // Primera empresa activa del usuario autenticado
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    user: {
      userId: string;
      role: UserRole;
      companyId?: string;
      username: string;
    };
  }
}

interface Request extends ExpressRequest {
  session: session.Session & Partial<session.SessionData>;
}
type Response = ExpressResponse;

// ─── Middleware JWT para la API REST ─────────────────────────────────────────
// Verifica el Bearer token y adjunta userId/userRole/userCompanyId al request.
// NO verifica si la empresa está activa aquí — eso lo hace requireActiveCompany
// a nivel de ruta, usando el companyCode de la URL (no el companyId del token).
export const verifyJWT = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticación requerido.' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; roles: string; companyId?: string };
    req.userId = decoded.id;
    req.userRole = decoded.roles;
    req.userCompanyId = decoded.companyId ?? undefined;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado.' });
  }
};

// ─── Middleware de sesión (para vistas EJS) ───────────────────────────────────
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session?.user) {
    return next();
  }
  req.flash('error_msg', 'Por favor, inicia sesión para acceder a esta página.');
  res.redirect('/login');
};

export const authorizeRolesMiddleware = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.user || !allowedRoles.includes(req.session.user.role)) {
      req.flash('error_msg', 'No tienes permisos para acceder a esta sección.');
      return res.status(403).redirect('/dashboard');
    }
    next();
  };
};

export const authorizeCompanyAccessMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.session?.user?.role === UserRole.SUPER_ADMIN) {
    return next();
  }

  const userCompanyId = req.session?.user?.companyId;

  let resourceCompanyId: string | undefined;

  if (req.body?.companyId) {
    resourceCompanyId = req.body.companyId;
  } else if (req.params.companyId) {
    resourceCompanyId = req.params.companyId;
  } else if (req.query.companyId) {
    resourceCompanyId = req.query.companyId as string;
  }

  if (!resourceCompanyId) {
    return next();
  }

  if (userCompanyId !== resourceCompanyId) {
    req.flash('error_msg', 'No tienes permisos para acceder o modificar recursos de esta empresa.');
    return res.status(403).redirect('/dashboard');
  }

  next();
};
