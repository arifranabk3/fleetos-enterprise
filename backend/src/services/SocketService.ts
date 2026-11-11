import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { OrganizationMember } from '../models/OrganizationMember';
import { Vehicle } from '../models/Vehicle';
import { Shipment } from '../models/Shipment';

export interface AuthenticatedSocketUser {
  userId: string;
  email: string;
  organizationId: string;
  role: string;
}

export interface AuthenticatedSocket extends Socket {
  user?: AuthenticatedSocketUser;
}

export class SocketService {
  private static io: SocketIOServer | null = null;

  public static initialize(io: SocketIOServer): void {
    SocketService.io = io;

    // 1. Mandatory Socket Authentication Middleware
    io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
          socket.handshake.query?.token;

        if (!token) {
          return next(new Error('AUTHENTICATION_ERROR: Missing authentication token for socket handshake.'));
        }

        const secret = process.env.JWT_ACCESS_SECRET || 'fleetos-dev-access-super-secret-key-replace-in-prod';
        const decoded = jwt.verify(String(token), secret) as any;

        // Resolve active organization context
        const requestedOrgId =
          socket.handshake.auth?.organizationId ||
          socket.handshake.headers?.['x-organization-id'] ||
          decoded.organizationId;

        if (!requestedOrgId) {
          return next(new Error('ORGANIZATION_ERROR: Missing organization context for socket handshake.'));
        }

        // Verify membership in database
        const member = await OrganizationMember.findOne({
          userId: decoded.userId,
          organizationId: requestedOrgId,
          status: 'ACTIVE',
        });

        if (!member) {
          return next(new Error('FORBIDDEN: User does not have verified membership in the requested organization.'));
        }

        socket.user = {
          userId: decoded.userId,
          email: decoded.email,
          organizationId: requestedOrgId.toString(),
          role: member.role,
        };

        next();
      } catch (err: any) {
        next(new Error(`AUTHENTICATION_FAILED: ${err.message}`));
      }
    });

    // 2. Connection and Room Management
    io.on('connection', (socket: AuthenticatedSocket) => {
      const user = socket.user!;
      const orgRoom = `org:${user.organizationId}`;

      // Join tenant-scoped room automatically
      socket.join(orgRoom);
      socket.join(`user:${user.userId}`);

      // Vehicle subscription with strict tenant check
      socket.on('subscribe:vehicle', async (data: { vehicleId: string }) => {
        try {
          if (!data?.vehicleId) return;
          const vehicle = await Vehicle.findOne({
            _id: data.vehicleId,
            organizationId: user.organizationId,
            isArchived: false,
          });

          if (vehicle) {
            socket.join(`vehicle:${data.vehicleId}`);
            socket.emit('subscribed:vehicle', { vehicleId: data.vehicleId, status: 'SUCCESS' });
          } else {
            socket.emit('subscription:error', {
              vehicleId: data.vehicleId,
              message: 'Vehicle not found or cross-tenant subscription denied.',
            });
          }
        } catch (e: any) {
          socket.emit('subscription:error', { error: e.message });
        }
      });

      // Shipment subscription with strict tenant check
      socket.on('subscribe:shipment', async (data: { shipmentId: string }) => {
        try {
          if (!data?.shipmentId) return;
          const shipment = await Shipment.findOne({
            _id: data.shipmentId,
            organizationId: user.organizationId,
            isArchived: false,
          });

          if (shipment) {
            socket.join(`shipment:${data.shipmentId}`);
            socket.emit('subscribed:shipment', { shipmentId: data.shipmentId, status: 'SUCCESS' });
          } else {
            socket.emit('subscription:error', {
              shipmentId: data.shipmentId,
              message: 'Shipment not found or cross-tenant subscription denied.',
            });
          }
        } catch (e: any) {
          socket.emit('subscription:error', { error: e.message });
        }
      });

      socket.on('disconnect', () => {
        // Clean disconnect
      });
    });
  }

  /**
   * Broadcast telemetry update strictly within the vehicle's tenant organization
   */
  public static broadcastVehicleTelemetry(organizationId: string, telemetry: any): void {
    if (!SocketService.io) return;

    // 1. Organization room broadcast for Live Map Operations
    SocketService.io.to(`org:${organizationId}`).emit('vehicle.location.updated', telemetry);

    // 2. Resource-specific room broadcast for detail tracking page
    SocketService.io.to(`vehicle:${telemetry.vehicleId}`).emit('vehicle.telemetry', telemetry);

    if (telemetry.shipmentId) {
      SocketService.io.to(`shipment:${telemetry.shipmentId}`).emit('shipment.location.updated', telemetry);
    }
  }

  /**
   * Broadcast telemetry alert to organization
   */
  public static broadcastAlert(organizationId: string, alert: any): void {
    if (!SocketService.io) return;
    SocketService.io.to(`org:${organizationId}`).emit('telemetry.alert.created', alert);
  }
}
