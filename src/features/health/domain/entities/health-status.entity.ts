export interface HealthStatusProperties {
  status: 'ok';
  timestamp: Date;
  uptimeSeconds: number;
  environment: string;
}

export class HealthStatus {
  private constructor(private readonly properties: HealthStatusProperties) {}

  static create(properties: HealthStatusProperties): HealthStatus {
    if (properties.uptimeSeconds < 0) {
      throw new Error('Uptime cannot be negative.');
    }

    return new HealthStatus(properties);
  }

  get status(): 'ok' {
    return this.properties.status;
  }

  get timestamp(): Date {
    return this.properties.timestamp;
  }

  get uptimeSeconds(): number {
    return this.properties.uptimeSeconds;
  }

  get environment(): string {
    return this.properties.environment;
  }
}
