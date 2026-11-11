import { Response } from 'express';
import { Organization, OrganizationMember, User, AuditLog, Invitation } from '../models';
import { AuthRequest } from '../middleware/auth';
import { generateAccessToken, generateRandomToken } from '../utils/token';

export class OrganizationController {
  /**
   * GET /api/organizations
   * Lists all organizations where the authenticated user holds active membership.
   */
  static async listUserOrganizations(req: AuthRequest, res: Response) {
    try {
      if (!req.user) return res.status(401).json({ success: false });

      const memberships = await OrganizationMember.find({
        userId: req.user.id,
        status: 'ACTIVE',
      }).populate('organizationId');

      return res.status(200).json({
        success: true,
        data: memberships.map((m) => ({
          membershipId: m._id,
          role: m.role,
          joinedAt: m.joinedAt,
          organization: m.organizationId,
        })),
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: { message: 'Failed to list organizations.' } });
    }
  }

  /**
   * POST /api/organizations/switch
   * Securely changes user's active tenant scope after verifying membership.
   */
  static async switchOrganization(req: AuthRequest, res: Response) {
    try {
      const { organizationId } = req.body;
      if (!req.user || !organizationId) {
        return res.status(400).json({ success: false, error: { message: 'Organization ID required.' } });
      }

      // Verify active membership in target organization
      const membership = await OrganizationMember.findOne({
        organizationId,
        userId: req.user.id,
        status: 'ACTIVE',
      }).populate('organizationId');

      if (!membership || !membership.organizationId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_SWITCH',
            message: 'You do not have active membership in this organization.',
          },
        });
      }

      // Update user's lastActiveOrganizationId
      await User.updateOne({ _id: req.user.id }, { lastActiveOrganizationId: organizationId });

      // Issue new access token scoped to switched organization
      const targetOrg = membership.organizationId as any;
      const newAccessToken = generateAccessToken({
        userId: req.user.id,
        email: req.user.email,
        activeOrganizationId: targetOrg._id.toString(),
        role: membership.role,
      });

      res.cookie('fleetos_access_token', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
      });

      // Audit Log
      await AuditLog.create({
        organizationId: targetOrg._id,
        actorId: req.user.id,
        actorEmail: req.user.email,
        action: 'TENANT_SWITCHED',
        entity: 'ORGANIZATION',
        entityId: targetOrg._id.toString(),
        ipAddress: req.ip,
      });

      return res.status(200).json({
        success: true,
        data: {
          organization: {
            id: targetOrg._id,
            name: targetOrg.name,
            slug: targetOrg.slug,
            role: membership.role,
          },
          accessToken: newAccessToken,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: { message: 'Failed to switch organization.' } });
    }
  }

  /**
   * GET /api/organizations/:organizationId/members
   */
  static async listMembers(req: AuthRequest, res: Response) {
    try {
      const members = await OrganizationMember.find({
        organizationId: req.tenant?.organizationId,
        status: 'ACTIVE',
      }).populate('userId', 'firstName lastName email phone lastLoginAt');

      return res.status(200).json({ success: true, data: members });
    } catch (error) {
      return res.status(500).json({ success: false, error: { message: 'Failed to fetch members.' } });
    }
  }

  /**
   * POST /api/organizations/:organizationId/invitations
   */
  static async inviteMember(req: AuthRequest, res: Response) {
    try {
      const { email, role } = req.body;
      if (!email || !role) {
        return res.status(400).json({ success: false, error: { message: 'Email and role required.' } });
      }

      const orgId = req.tenant?.organizationId;
      const { rawToken, tokenHash } = generateRandomToken();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3); // 3 days expiry

      const invitation = await Invitation.create({
        organizationId: orgId,
        email: email.toLowerCase().trim(),
        role,
        tokenHash,
        invitedBy: req.tenant?.userId,
        expiresAt,
      });

      // Audit Log
      await AuditLog.create({
        organizationId: orgId,
        actorId: req.tenant?.userId,
        actorEmail: req.user?.email || 'system',
        action: 'MEMBER_INVITED',
        entity: 'INVITATION',
        entityId: invitation._id.toString(),
        details: { invitedEmail: email, role },
        ipAddress: req.ip,
      });

      return res.status(201).json({
        success: true,
        data: {
          invitationId: invitation._id,
          email: invitation.email,
          role: invitation.role,
          rawToken, // Safe development token for immediate testing
          expiresAt,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: { message: 'Failed to issue invitation.' } });
    }
  }
}

