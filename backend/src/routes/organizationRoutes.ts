import { Router } from 'express';
import { OrganizationController } from '../controllers/OrganizationController';
import { authenticate, requireTenantMembership, requirePermission } from '../middleware/auth';

const router = Router();

// List all user organizations & switch active tenant
router.get('/', authenticate, OrganizationController.listUserOrganizations);
router.post('/switch', authenticate, OrganizationController.switchOrganization);

// Tenant-scoped member management
router.get(
  '/:organizationId/members',
  authenticate,
  requireTenantMembership,
  requirePermission('USERS:MANAGE'),
  OrganizationController.listMembers
);

router.post(
  '/:organizationId/invitations',
  authenticate,
  requireTenantMembership,
  requirePermission('USERS:MANAGE'),
  OrganizationController.inviteMember
);

export default router;

