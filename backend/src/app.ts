import express, { Application, Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/authRoutes';
import organizationRoutes from './routes/organizationRoutes';
import fleetRoutes from './routes/fleetRoutes';
import logisticsRoutes from './routes/logisticsRoutes';
import trackingRoutes from './routes/trackingRoutes';
import maintenanceRoutes from './routes/maintenanceRoutes';
import fuelRoutes from './routes/fuelRoutes';
import driverWorkforceRoutes from './routes/driverWorkforceRoutes';
import billingRoutes from './routes/billingRoutes';
import financialReportRoutes from './routes/financialReportRoutes';
import fleetAnalyticsRoutes from './routes/fleetAnalyticsRoutes';
import driverAnalyticsRoutes from './routes/driverAnalyticsRoutes';
import { SocketService } from './services/SocketService';

export const createApp = (): { app: Application; server: http.Server; io: SocketIOServer } => {
  const app = express();
  const server = http.createServer(app);

  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    },
  });

  // Initialize Socket.IO Enterprise Architecture
  SocketService.initialize(io);

  // Base security & parsing middleware
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Health check route
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'healthy',
      platform: 'FleetOS Enterprise Fleet & Logistics SaaS',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Modular API Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/organizations', organizationRoutes);
  app.use('/api/v1', fleetRoutes);
  app.use('/api/v1', logisticsRoutes);
  app.use('/api/v1', trackingRoutes);
  app.use('/api/v1', maintenanceRoutes);
  app.use('/api/v1', fuelRoutes);
  app.use('/api/v1', driverWorkforceRoutes);
  app.use('/api/v1', billingRoutes);
  app.use('/api/v1', financialReportRoutes);
  app.use('/api/v1', fleetAnalyticsRoutes);
  app.use('/api/v1', driverAnalyticsRoutes);

  // Centralized Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Centralized Error]:', err);
    res.status(err.status || 500).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected error occurred.',
      },
    });
  });

  return { app, server, io };
};
