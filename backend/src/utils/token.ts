import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface TokenPayload {
  userId: string;
  email: string;
  activeOrganizationId?: string;
  role?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'fleetos_super_secret_jwt_key_2026_enterprise_grade';
const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access tokens
const REFRESH_TOKEN_DAYS = 7;

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
};

export const generateRandomToken = (): { rawToken: string; tokenHash: string } => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const getRefreshTokenExpiry = (): Date => {
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * REFRESH_TOKEN_DAYS);
};

