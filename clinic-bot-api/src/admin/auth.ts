import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const SECRET = process.env.ADMIN_JWT_SECRET ?? 'admin-secret-change-me';

export function signToken(username: string) {
  return jwt.sign({ username }, SECRET, { expiresIn: '8h' });
}

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  // Suporta token via query param para download direto (ex: export CSV)
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : (req.query.token as string);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}
