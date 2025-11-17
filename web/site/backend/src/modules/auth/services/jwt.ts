import crypto from 'crypto';
import jwt from 'jsonwebtoken';
const { sign, verify } = jwt;

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is not set.');
  console.error('Please set a strong, random JWT_SECRET in your environment variables.');
  process.exit(1);
}

// Type assertion after validation - JWT_SECRET is guaranteed to be a string here
const VALIDATED_JWT_SECRET: string = JWT_SECRET!;

interface TokenPayload {
  username: string;
  name: string;
  adminId: string;
  id: string;
  jti: string;
  iat: number;
  exp: number;
}

/**
 * Generates a secure JWT token for authentication
 */
export function generateSecureToken(username: string, name: string, admin: any) {
  const tokenId = crypto.randomBytes(16).toString('hex');
  const now = Math.floor(Date.now() / 1000);
  const expiryTime = now + (24 * 60 * 60); // 24 hours in seconds

  const payload = {
    id: admin.id,
    username,
    name,
    displayName: name, // Add displayName field for frontend compatibility
    adminId: admin.id,
    jti: tokenId,
    iat: now,
    exp: expiryTime
  };

  const token = sign(payload, VALIDATED_JWT_SECRET, { 
    algorithm: 'HS256',
    issuer: 'bovisgl-backend',
    audience: 'bovisgl-admin-panel'
  });

  return {
    token,
    tokenId,
    expiryTime: expiryTime * 1000 // Return milliseconds for frontend
  };
}

/**
 * Verifies a JWT token and returns the decoded payload
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = verify(token, VALIDATED_JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'bovisgl-backend',
      audience: 'bovisgl-admin-panel'
    });
    
    // Type assertion after successful verification - we know the shape matches our TokenPayload
    return decoded as unknown as TokenPayload;
  } catch (error) {
    return null;
  }
} 