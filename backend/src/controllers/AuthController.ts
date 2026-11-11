import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User, Organization, OrganizationMember, Session, AuditLog } from '../models';
import {
  generateAccessToken,
  generateRandomToken,
  hashToken,
  getRefreshTokenExpiry,
} from '../utils/token';
import { AuthRequest } from '../middleware/auth';

export class AuthController {
  /**
   * POST /api/auth/register
   * Registers a new global user and simultaneously provisions their initial organization as ORGANIZATION_OWNER.
   */
  static async register(req: Request, res: Response) {
    try {
      const { firstName, lastName, email, password, organizationName, organizationSlug } = req.body;

      if (!email || !password || !firstName || !lastName || !organizationName) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_FAILED', message: 'All registration fields are required.' },
        });
      }

      // Check existing email
      const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: { code: 'EMAIL_ALREADY_EXISTS', message: 'A user with this email address already exists.' },
        });
      }

      // Generate slug if not provided
      const slug = (organizationSlug || organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-')).trim();
      const existingOrg = await Organization.findOne({ slug });
      if (existingOrg) {
        return res.status(409).json({
          success: false,
          error: { code: 'SLUG_TAKEN', message: 'Organization slug is already in use by another carrier.' },
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create Organization
      const org = await Organization.create({
        name: organizationName.trim(),
        slug,
        plan: 'GROWTH',
        status: 'ACTIVE',
      });

      // Create User
      const user = await User.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        status: 'ACTIVE',
        isEmailVerified: true,
        lastActiveOrganizationId: org._id,
      });

      // Create Organization Membership as ORGANIZATION_OWNER
      await OrganizationMember.create({
        organizationId: org._id,
        userId: user._id,
        role: 'ORGANIZATION_OWNER',
        status: 'ACTIVE',
      });

      // Issue Refresh Token & Session
      const { rawToken: refreshToken, tokenHash } = generateRandomToken();
      const familyId = crypto.randomUUID();

      await Session.create({
        userId: user._id,
        refreshTokenHash: tokenHash,
        familyId,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        expiresAt: getRefreshTokenExpiry(),
      });

      // Issue Access Token
      const accessToken = generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        activeOrganizationId: org._id.toString(),
        role: 'ORGANIZATION_OWNER',
      });

      // Audit Log
      await AuditLog.create({
        organizationId: org._id,
        actorId: user._id,
        actorEmail: user.email,
        action: 'USER_REGISTERED',
        entity: 'USER',
        entityId: user._id.toString(),
        ipAddress: req.ip,
      });

      // Set HttpOnly Cookies
      res.cookie('fleetos_access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('fleetos_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.status(201).json({
        success: true,
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
          },
          organization: {
            id: org._id,
            name: org.name,
            slug: org.slug,
            role: 'ORGANIZATION_OWNER',
          },
          accessToken,
        },
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'REGISTRATION_ERROR', message: 'Failed to complete registration.' },
      });
    }
  }

  /**
   * POST /api/auth/login
   * Authenticates user, verifies membership, and issues rotating token pair.
   */
  static async login(req: Request, res: Response) {
    try {
      const { email, password, organizationSlug } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Email and password are required.' },
        });
      }

      const user = await User.findOne({ email: email.toLowerCase().trim() });
      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
        });
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
        });
      }

      // Determine active organization
      let activeOrgId = user.lastActiveOrganizationId;
      if (organizationSlug) {
        const org = await Organization.findOne({ slug: organizationSlug });
        if (org) activeOrgId = org._id;
      }

      // Fetch active membership
      const membership = await OrganizationMember.findOne({
        userId: user._id,
        status: 'ACTIVE',
        ...(activeOrgId ? { organizationId: activeOrgId } : {}),
      }).populate('organizationId');

      if (!membership || !membership.organizationId) {
        return res.status(403).json({
          success: false,
          error: { code: 'NO_ACTIVE_MEMBERSHIP', message: 'User has no active organization memberships.' },
        });
      }

      const activeOrg = membership.organizationId as any;

      // Issue rotating session & tokens
      const { rawToken: refreshToken, tokenHash } = generateRandomToken();
      const familyId = crypto.randomUUID();

      await Session.create({
        userId: user._id,
        refreshTokenHash: tokenHash,
        familyId,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        expiresAt: getRefreshTokenExpiry(),
      });

      const accessToken = generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        activeOrganizationId: activeOrg._id.toString(),
        role: membership.role,
      });

      // Update user lastLogin
      user.lastLoginAt = new Date();
      user.lastActiveOrganizationId = activeOrg._id;
      await user.save();

      // Audit Log
      await AuditLog.create({
        organizationId: activeOrg._id,
        actorId: user._id,
        actorEmail: user.email,
        action: 'USER_LOGIN',
        entity: 'SESSION',
        ipAddress: req.ip,
      });

      res.cookie('fleetos_access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('fleetos_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
          },
          organization: {
            id: activeOrg._id,
            name: activeOrg.name,
            slug: activeOrg.slug,
            role: membership.role,
          },
          accessToken,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        success: false,
        error: { code: 'LOGIN_FAILED', message: 'Internal authentication error.' },
      });
    }
  }

  /**
   * POST /api/auth/refresh
   * Rotates refresh tokens and detects token reuse attacks.
   */
  static async refresh(req: Request, res: Response) {
    try {
      const incomingRefreshToken = req.cookies?.fleetos_refresh_token || req.body?.refreshToken;

      if (!incomingRefreshToken) {
        return res.status(401).json({
          success: false,
          error: { code: 'TOKEN_REQUIRED', message: 'Refresh token required.' },
        });
      }

      const tokenHash = hashToken(incomingRefreshToken);
      const session = await Session.findOne({ refreshTokenHash: tokenHash });

      if (!session) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_SESSION', message: 'Session expired or invalid.' },
        });
      }

      // Token Reuse Detection
      if (session.isRevoked) {
        // Invalidate entire token family if reused token is presented
        await Session.updateMany({ familyId: session.familyId }, { isRevoked: true });
        res.clearCookie('fleetos_access_token');
        res.clearCookie('fleetos_refresh_token');

        return res.status(403).json({
          success: false,
          error: {
            code: 'TOKEN_REUSE_DETECTED',
            message: 'Security alert: Refresh token reuse detected. All sessions in family revoked.',
          },
        });
      }

      // Mark current session as rotated/revoked
      session.isRevoked = true;
      await session.save();

      // Issue new token in same family
      const { rawToken: newRefreshToken, tokenHash: newTokenHash } = generateRandomToken();

      await Session.create({
        userId: session.userId,
        refreshTokenHash: newTokenHash,
        familyId: session.familyId,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        expiresAt: getRefreshTokenExpiry(),
      });

      const user = await User.findById(session.userId);
      if (!user) throw new Error('User not found.');

      const membership = await OrganizationMember.findOne({
        userId: user._id,
        organizationId: user.lastActiveOrganizationId,
        status: 'ACTIVE',
      });

      const newAccessToken = generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        activeOrganizationId: user.lastActiveOrganizationId?.toString(),
        role: membership?.role,
      });

      res.cookie('fleetos_access_token', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('fleetos_refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.status(200).json({
        success: true,
        data: { accessToken: newAccessToken },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'REFRESH_ERROR', message: 'Failed to refresh authentication session.' },
      });
    }
  }

  /**
   * POST /api/auth/logout
   */
  static async logout(req: Request, res: Response) {
    try {
      const incomingRefreshToken = req.cookies?.fleetos_refresh_token || req.body?.refreshToken;
      if (incomingRefreshToken) {
        const tokenHash = hashToken(incomingRefreshToken);
        await Session.updateOne({ refreshTokenHash: tokenHash }, { isRevoked: true });
      }

      res.clearCookie('fleetos_access_token');
      res.clearCookie('fleetos_refresh_token');

      return res.status(200).json({
        success: true,
        data: { message: 'Successfully logged out.' },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'LOGOUT_ERROR', message: 'Error during session termination.' },
      });
    }
  }

  /**
   * GET /api/auth/me
   */
  static async getProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
      }

      const user = await User.findById(req.user.id).select('-passwordHash');
      const memberships = await OrganizationMember.find({
        userId: req.user.id,
        status: 'ACTIVE',
      }).populate('organizationId', 'name slug plan status');

      return res.status(200).json({
        success: true,
        data: {
          user,
          memberships,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: { code: 'PROFILE_ERROR', message: 'Failed to load profile.' },
      });
    }
  }
}
