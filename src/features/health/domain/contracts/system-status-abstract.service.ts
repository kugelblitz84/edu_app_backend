export interface SystemStatusSnapshot {
  timestamp: Date;
  uptimeSeconds: number;
  environment: string;
}

/**
 * Domain-facing contract. The use case does not know whether the values come
 * from Node.js, a monitoring service, or a test fake.
 */
export abstract class SystemStatusService {
  abstract getSnapshot(): SystemStatusSnapshot;
}
