import { SystemStatusService } from '../contracts/system-status.provider';
import { HealthStatus } from '../entities/health-status.entity';

export class GetHealthStatusUseCase {
  constructor(private readonly systemStatus: SystemStatusService) {}

  execute(): HealthStatus {
    const snapshot = this.systemStatus.getSnapshot();

    return HealthStatus.create({
      status: 'ok',
      timestamp: snapshot.timestamp,
      uptimeSeconds: snapshot.uptimeSeconds,
      environment: snapshot.environment,
    });
  }
}
