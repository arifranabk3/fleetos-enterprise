import mongoose from 'mongoose';

export const connectDatabase = async (uri?: string): Promise<typeof mongoose> => {
  const connectionUri = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/fleetos';

  try {
    const conn = await mongoose.connect(connectionUri, {
      autoIndex: true, // Build indexes for multi-tenant isolation
    });

    console.log(`[FleetOS] Connected to MongoDB database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error('[FleetOS] Database connection error:', error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
};

