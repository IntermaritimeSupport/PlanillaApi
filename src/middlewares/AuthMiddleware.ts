// src/middlewares/auth.middleware.ts
import { NextFunction, Request as ExpressRequest, Response as ExpressResponse } from "express";
import session from "express-session";
import { UserRole } from "../../generated/prisma";


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

// Extend Express Request to include session
interface Request extends ExpressRequest {
  session: session.Session & Partial<session.SessionData>;
}
type Response = ExpressResponse;

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash('error_msg', 'Por favor, inicia sesión para acceder a esta página.');
  res.redirect('/login');
};

// Middleware para autorizar roles
export const authorizeRolesMiddleware = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session || !req.session.user || !allowedRoles.includes(req.session.user.role)) {
      req.flash('error_msg', 'No tienes permisos para acceder a esta sección.');
      return res.status(403).redirect('/dashboard'); // O a una página de "Acceso Denegado"
    }
    next();
  };
};

export const authorizeCompanyAccessMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.session?.user?.role === UserRole.SUPER_ADMIN) {
    return next();
  }

  const userCompanyId = req.session?.user?.companyId;

  // Para peticiones GET (lectura), la companyId puede venir en los query params o no ser necesaria si se lista todo de la empresa del usuario
  // Para peticiones POST/PUT/DELETE, la companyId del recurso debería venir en el body o params
  let resourceCompanyId: string | undefined;

  // Priorizar body para creación/actualización, luego params, luego query para filtros
  if (req.body.companyId) {
    resourceCompanyId = req.body.companyId;
  } else if (req.params.companyId) { // Si la companyId es parte de la URL (ej. /equipments/:companyId/:id)
    resourceCompanyId = req.params.companyId;
  } else if (req.query.companyId) { // Si la companyId es un filtro en la URL (ej. /equipments?companyId=xyz)
    resourceCompanyId = req.query.companyId as string;
  }

  // Si no se especifica companyId en la petición, se asume que se opera sobre la empresa del usuario
  if (!resourceCompanyId) {
    // Si la petición es para crear o listar, y no se especifica companyId, se asume la del usuario.
    // Si la petición es para un recurso específico (GET /equipments/:id, PUT /equipments/:id),
    // la lógica del servicio deberá verificar que el recurso pertenece a la empresa del usuario.
    // Por ahora, permitimos pasar si no hay companyId en la petición, y el servicio se encargará.
    return next();
  }

  // Si se especifica una companyId en la petición, debe coincidir con la del usuario
  if (userCompanyId !== resourceCompanyId) {
    req.flash('error_msg', 'No tienes permisos para acceder o modificar recursos de esta empresa.');
    return res.status(403).redirect('/dashboard'); // Redirigir o enviar JSON de error
  }

  next();
};