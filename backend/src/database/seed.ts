import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import {
  Organization,
  User,
  OrganizationMember,
  Role,
  Permission,
  Vehicle,
  Driver,
  Shipment,
} from '../models';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export async function seedDevelopmentData() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required to run database seeding.');
  }

  console.log('[Seed] Connecting to MongoDB database...');
  await mongoose.connect(uri);
  console.log('[Seed] Connected to database:', mongoose.connection.name);

  try {
    // 1. Seed or Upsert Demo Organization
    const demoOrgSlug = 'apex-logistics';
    let org = await Organization.findOne({ slug: demoOrgSlug });

    if (!org) {
      org = await Organization.create({
        name: 'Apex Global Logistics, LLC',
        slug: demoOrgSlug,
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
        settings: {
          telemetryIntervalSeconds: 5,
          allowSimulatedGps: true,
          currency: 'USD',
        },
      });
      console.log('✓ Created Demo Organization: Apex Global Logistics');
    } else {
      console.log('✓ Found Existing Organization: Apex Global Logistics');
    }

    // 2. Seed Demo Enterprise Admin User
    const adminEmail = 'arif.mahmood@apexlogistics.com';
    let adminUser = await User.findOne({ organizationId: org._id, email: adminEmail });

    if (!adminUser) {
      const passwordHash = await bcrypt.hash('demo-password-2026', 10);
      adminUser = await User.create({
        organizationId: org._id,
        firstName: 'Arif',
        lastName: 'Mahmood',
        email: adminEmail,
        passwordHash,
        role: 'ORGANIZATION_ADMIN',
        status: 'ACTIVE',
      });
      console.log('✓ Created Demo Admin User: Arif Mahmood');
    }

    // 3. Ensure Organization Membership
    const existingMember = await OrganizationMember.findOne({
      organizationId: org._id,
      userId: adminUser._id,
    });

    if (!existingMember) {
      await OrganizationMember.create({
        organizationId: org._id,
        userId: adminUser._id,
        role: 'ORGANIZATION_ADMIN',
        status: 'ACTIVE',
      });
      console.log('✓ Verified Organization Membership for Admin');
    }

    // 4. Seed Demo Vehicles
    const vehiclesData = [
      {
        organizationId: org._id,
        vin: '1M8GDM9A4KP048291',
        plateNumber: 'FLT-8890',
        make: 'Volvo',
        modelName: 'VNL 860',
        year: 2024,
        type: 'SEMI_TRUCK' as const,
        capacityKg: 36000,
        status: 'IN_TRANSIT' as const,
        odometerKm: 42150,
      },
      {
        organizationId: org._id,
        vin: '1M8GDM9B7LP059284',
        plateNumber: 'FLT-4021',
        make: 'Freightliner',
        modelName: 'Cascadia 126',
        year: 2023,
        type: 'SEMI_TRUCK' as const,
        capacityKg: 34000,
        status: 'AVAILABLE' as const,
        odometerKm: 89400,
      },
    ];

    for (const v of vehiclesData) {
      const exists = await Vehicle.findOne({ organizationId: org._id, plateNumber: v.plateNumber });
      if (!exists) {
        await Vehicle.create(v);
        console.log(`✓ Seeded Vehicle: ${v.plateNumber} (${v.make} ${v.modelName})`);
      }
    }

    // 5. Seed Demo Driver
    const driverEmail = 'hamza.khan@apexlogistics.com';
    let driverUser = await User.findOne({ organizationId: org._id, email: driverEmail });
    if (!driverUser) {
      const passwordHash = await bcrypt.hash('driver-pass-2026', 10);
      driverUser = await User.create({
        organizationId: org._id,
        firstName: 'Hamza',
        lastName: 'Khan',
        email: driverEmail,
        passwordHash,
        role: 'DRIVER',
        status: 'ACTIVE',
      });

      await OrganizationMember.create({
        organizationId: org._id,
        userId: driverUser._id,
        role: 'DRIVER',
        status: 'ACTIVE',
      });

      const assignedVeh = await Vehicle.findOne({ organizationId: org._id, plateNumber: 'FLT-8890' });

      await Driver.create({
        organizationId: org._id,
        userId: driverUser._id,
        licenseNumber: 'CDL-IL-984210',
        licenseClass: 'CDL-A',
        licenseExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // 1 year out
        assignedVehicleId: assignedVeh?._id,
        status: 'DRIVING',
        rating: 4.95,
      });
      console.log('✓ Seeded Driver: Hamza Khan (CDL-IL-984210)');
    }

    // 6. Seed Demo Shipment
    const trackingNum = 'FLT-SHP-89210';
    const existingShipment = await Shipment.findOne({ organizationId: org._id, trackingNumber: trackingNum });
    if (!existingShipment) {
      const veh = await Vehicle.findOne({ organizationId: org._id, plateNumber: 'FLT-8890' });
      const drv = await Driver.findOne({ organizationId: org._id, licenseNumber: 'CDL-IL-984210' });

      await Shipment.create({
        organizationId: org._id,
        trackingNumber: trackingNum,
        vehicleId: veh?._id,
        driverId: drv?._id,
        status: 'IN_TRANSIT',
        customer: {
          name: 'Nexus Distribution Ltd',
          email: 'logistics@nexus.com',
          phone: '+1 (555) 019-2834',
        },
        origin: {
          address: 'Chicago Central Yard, IL',
          city: 'Chicago, IL',
          latitude: 41.8781,
          longitude: -87.6298,
        },
        destination: {
          address: 'Dallas Logistics Hub, TX',
          city: 'Dallas, TX',
          latitude: 32.7767,
          longitude: -96.797,
        },
        cargo: {
          description: 'High-Density Consumer Electronics',
          weightKg: 18400,
        },
        pricing: {
          quotedAmount: 5400,
          currency: 'USD',
        },
      });
      console.log(`✓ Seeded Active Shipment: ${trackingNum}`);
    }

    console.log('\n======================================================');
    console.log('🎉 SEEDING COMPLETED SUCCESSFULLY WITHOUT DUPLICATES!');
    console.log('======================================================\n');
  } catch (error) {
    console.error('❌ Seeding error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  seedDevelopmentData();
}

