import { createSuperAdminSeed } from "../seed/createSuperAdmin.js";
import { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  // Protección básica con token secreto (opcional pero recomendado)
  const auth = req.headers.authorization;
  const SECRET = process.env.SEED_SECRET || 'mi-seed-key';

  if (auth !== `Bearer ${SECRET}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const result = await createSuperAdminSeed();
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Error al ejecutar seed', details: err });
  }
}
