import { HealthStatus } from '../../domain/entities/health-status.entity';

export interface HealthResponseDto {
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
}

export function toHealthResponseDto(health: HealthStatus): HealthResponseDto {
  return {
    status: health.status,
    timestamp: health.timestamp.toISOString(),
    uptimeSeconds: health.uptimeSeconds,
    environment: health.environment,
  };
}
