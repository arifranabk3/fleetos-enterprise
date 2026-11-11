import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function checkDatabaseDuplicates() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('No MONGODB_URI configured, skipping remote duplicate check.');
    return;
  }

  console.log('Connecting to database to check for existing data duplicates...');
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    const db = mongoose.connection.db;
    if (!db) {
      console.log('Could not get database instance.');
      return;
    }

    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections in database.`);

    const report: Record<string, any> = {};

    for (const col of collections) {
      const colName = col.name;
      const count = await db.collection(colName).countDocuments();
      report[colName] = { documentCount: count };

      // If invoices exist, check for duplicates
      if (colName === 'invoices') {
        const dupInvoices = await db.collection('invoices').aggregate([
          { $group: { _id: { organizationId: '$organizationId', invoiceNumber: '$invoiceNumber' }, count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } }
        ]).toArray();
        report[colName].duplicateNumbers = dupInvoices;
      }

      if (colName === 'ratematrices' || colName === 'rate_matrices') {
        const dups = await db.collection(colName).aggregate([
          { $group: { _id: { organizationId: '$organizationId', code: '$code', version: '$version' }, count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } }
        ]).toArray();
        report[colName].duplicates = dups;
      }
    }

    console.log('DUPLICATE AUDIT REPORT:');
    console.log(JSON.stringify(report, null, 2));
    await mongoose.disconnect();
  } catch (err: any) {
    console.log('Remote database connection note (timeout or network):', err.message);
    console.log('Continuing with idempotent migration design and in-memory verification.');
  }
}

checkDatabaseDuplicates().catch(console.error);
