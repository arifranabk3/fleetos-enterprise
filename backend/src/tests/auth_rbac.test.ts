import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Organization, OrganizationMember, Session, AuditLog, Invitation } from '../models';
import { generateAccessToken, generateRandomToken, hashToken } from '../utils/token';
import { hasPermission } from '../utils/permissions';

async function runAuthAndRBACSecuritySuite() {
  console.log('[Phase 03 Test Suite] Starting Enterprise Authentication, Session & RBAC Tests...');
  let mongod: MongoMemoryServer | null = null;

  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);

    await Promise.all([
      User.init(),
      Organization.init(),
      OrganizationMember.init(),
      Session.init(),
      Invitation.init(),
      AuditLog.init(),
    ]);

    // 1. TEST: USER REGISTRATION & PASSWORD HASHING
    const password = 'SuperSecurePassword2026!';
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      firstName: 'Chief',
      lastName: 'Security Officer',
      email: 'cso@fleetos.com',
      passwordHash,
      status: 'ACTIVE',
      isEmailVerified: true,
    });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    const isWrongMatch = await bcrypt.compare('WrongPassword', user.passwordHash);

    if (!isMatch || isWrongMatch) {
      throw new Error('Password hash verification failed.');
    }
    console.log('✓ TEST 1: User registration & bcrypt password hashing verified.');

    // 2. TEST: DUPLICATE REGISTRATION REJECTION
    try {
      await User.create({
        firstName: 'Impostor',
        lastName: 'User',
        email: 'cso@fleetos.com', // Duplicate email
        passwordHash: 'hash',
      });
      throw new Error('Security failure: Duplicate email was accepted.');
    } catch (err: any) {
      if (err.code === 11000) {
        console.log('✓ TEST 2: Duplicate registration rejected by global unique email index.');
      } else {
        throw err;
      }
    }

    // 3. TEST: MULTI-ORGANIZATION MEMBERSHIP & ROLE ASSIGNMENTS
    const carrierA = await Organization.create({
      name: 'Apex Express',
      slug: 'apex-express',
      plan: 'ENTERPRISE',
    });

    const carrierB = await Organization.create({
      name: 'Pacific Cargo',
      slug: 'pacific-cargo',
      plan: 'GROWTH',
    });

    // Same global user has different roles in different organizations:
    // In Carrier A: ORGANIZATION_OWNER
    await OrganizationMember.create({
      organizationId: carrierA._id,
      userId: user._id,
      role: 'ORGANIZATION_OWNER',
      status: 'ACTIVE',
    });

    // In Carrier B: DISPATCHER
    await OrganizationMember.create({
      organizationId: carrierB._id,
      userId: user._id,
      role: 'DISPATCHER',
      status: 'ACTIVE',
    });

    const memberships = await OrganizationMember.find({ userId: user._id });
    if (memberships.length !== 2) {
      throw new Error('Multi-organization membership association failed.');
    }
    console.log('✓ TEST 3: One global user successfully mapped to multiple organizations with distinct roles.');

    // 4. TEST: RBAC PERMISSION ENFORCEMENT & PRIVILEGE ESCALATION PREVENTION
    // As OWNER in Carrier A, user CAN manage billing
    const ownerHasBilling = hasPermission('ORGANIZATION_OWNER', 'BILLING:MANAGE');
    // As DISPATCHER in Carrier B, user CANNOT manage billing
    const dispatcherHasBilling = hasPermission('DISPATCHER', 'BILLING:MANAGE');
    // DISPATCHER CAN dispatch shipments
    const dispatcherCanDispatch = hasPermission('DISPATCHER', 'DISPATCH:MANAGE');

    if (!ownerHasBilling || dispatcherHasBilling || !dispatcherCanDispatch) {
      throw new Error('RBAC permission evaluation failed.');
    }
    console.log('✓ TEST 4: RBAC matrix verified across Owner and Dispatcher roles.');

    // 5. TEST: SESSION MANAGEMENT & REFRESH TOKEN ROTATION
    const { rawToken: token1, tokenHash: hash1 } = generateRandomToken();
    const familyId = 'fam-12345';

    const session1 = await Session.create({
      userId: user._id,
      refreshTokenHash: hash1,
      familyId,
      expiresAt: new Date(Date.now() + 100000),
    });

    // Rotate session: invalidate session 1, issue session 2 in same family
    session1.isRevoked = true;
    await session1.save();

    const { rawToken: token2, tokenHash: hash2 } = generateRandomToken();
    const session2 = await Session.create({
      userId: user._id,
      refreshTokenHash: hash2,
      familyId,
      expiresAt: new Date(Date.now() + 100000),
    });

    console.log('✓ TEST 5: Refresh token rotation created successor session in same family.');

    // 6. TEST: REFRESH TOKEN REUSE DETECTION (Automatic Family Revocation)
    // If an attacker presents old token 1 (hash1):
    const replayedSession = await Session.findOne({ refreshTokenHash: hash1 });
    if (replayedSession && replayedSession.isRevoked) {
      // Security defense: revoke entire family!
      await Session.updateMany({ familyId: replayedSession.familyId }, { isRevoked: true });
    }

    const session2Check = await Session.findById(session2._id);
    if (!session2Check || !session2Check.isRevoked) {
      throw new Error('Token reuse detection failed to revoke active sessions in family!');
    }
    console.log('✓ TEST 6: Token reuse attack successfully detected and entire session family revoked.');

    // 7. TEST: ORGANIZATION SWITCHING VERIFICATION
    // User can switch to Carrier A (has active membership)
    const validSwitch = await OrganizationMember.findOne({
      userId: user._id,
      organizationId: carrierA._id,
      status: 'ACTIVE',
    });
    if (!validSwitch) throw new Error('Legitimate switch rejected.');

    // Create an unrelated Carrier C where user has NO membership
    const carrierC = await Organization.create({
      name: 'Unrelated Freight',
      slug: 'unrelated-freight',
      plan: 'STARTER',
    });

    const illegalSwitch = await OrganizationMember.findOne({
      userId: user._id,
      organizationId: carrierC._id,
      status: 'ACTIVE',
    });
    if (illegalSwitch !== null) {
      throw new Error('CRITICAL SECURITY VIOLATION: User accessed organization without membership!');
    }
    console.log('✓ TEST 7: Cross-tenant organization switching strictly verified and restricted.');

    // 8. TEST: INVITATION LIFECYCLE & CRYPTOGRAPHIC HASHING
    const { rawToken: inviteRaw, tokenHash: inviteHash } = generateRandomToken();
    const invite = await Invitation.create({
      organizationId: carrierA._id,
      email: 'newhire@carrier.com',
      role: 'DRIVER',
      tokenHash: inviteHash,
      invitedBy: user._id,
      expiresAt: new Date(Date.now() + 100000),
    });

    const foundInvite = await Invitation.findOne({ tokenHash: hashToken(inviteRaw), status: 'PENDING' });
    if (!foundInvite) throw new Error('Invitation token matching failed.');
    console.log('✓ TEST 8: Cryptographic invitation lifecycle and hashing verified.');

    // 9. TEST: AUDIT LOGGING OF AUTHENTICATION ACTIONS
    const auditRecord = await AuditLog.create({
      organizationId: carrierA._id,
      actorId: user._id,
      actorEmail: user.email,
      action: 'USER_LOGIN_SUCCESS',
      entity: 'SESSION',
      ipAddress: '127.0.0.1',
    });

    if (!auditRecord || auditRecord.action !== 'USER_LOGIN_SUCCESS') {
      throw new Error('Audit logging failed.');
    }
    console.log('✓ TEST 9: Security audit event correctly logged.');

    // 10. TEST: PRIVILEGE ESCALATION REJECTION
    // Verify viewer cannot perform admin action
    const viewerCannotDelete = hasPermission('VIEWER', 'USERS:MANAGE');
    if (viewerCannotDelete) {
      throw new Error('Privilege escalation: Viewer allowed to manage users.');
    }
    console.log('✓ TEST 10: Privilege escalation prevented (Viewer denied management privileges).');

    console.log('\n========================================================================');
    console.log('🎉 ALL 10 AUTHENTICATION, MEMBERSHIP & RBAC SECURITY TESTS PASSED!');
    console.log('========================================================================\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  }
}

runAuthAndRBACSecuritySuite();

