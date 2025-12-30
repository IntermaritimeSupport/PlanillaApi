// src/middlewares/errorHandler.ts
import { NextFunction, Request, Response } from 'express';

export function errorMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
  // 🔹 Evita "headers already sent"
  if (res.headersSent) {
    return next(err);
  }

  console.error("⚠️ Error capturado:", err.code);

  if (err) {
    switch (err.code) {
      case "P2002":
        console.error("Registro duplicado");
        return res.status(409).json({ error: "Registro duplicado." });
      case "P2025":
        console.error("Registro no encontrado");
        return res.status(404).json({ error: "Registro no encontrado." });
      case "P5010":
        console.error("No hay conexión con la base de datos. Intenta más tarde.");
        return res.status(503).json({ error: "No hay conexión con la base de datos. Intenta más tarde." });
      default:
                console.error("Error de base de datos desconocido.");
        return res.status(500).json({ error: "Error de base de datos desconocido." });
    }
  }

  return res.status(500).json({ error: "Error interno del servidor." });
}
