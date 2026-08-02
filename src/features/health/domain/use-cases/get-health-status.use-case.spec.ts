import {
  SystemStatusService,
  SystemStatusSnapshot,
} from '../contracts/system-status-abstract.service';
import { GetHealthStatusUseCase } from './get-health-status.use-case';

class FakeSystemStatusService extends SystemStatusService {
  getSnapshot(): SystemStatusSnapshot {
    return {
      timestamp: new Date('2026-08-02T00:00:00.000Z'),
      uptimeSeconds: 120,
      environment: 'test',
    };
  }
}

describe('GetHealthStatusUseCase', () => {
  it('returns a healthy system snapshot', () => {
    const useCase = new GetHealthStatusUseCase(new FakeSystemStatusService());

    const result = useCase.execute();

    expect(result.status).toBe('ok');
    expect(result.timestamp.toISOString()).toBe('2026-08-02T00:00:00.000Z');
    expect(result.uptimeSeconds).toBe(120);
    expect(result.environment).toBe('test');
  });
});
