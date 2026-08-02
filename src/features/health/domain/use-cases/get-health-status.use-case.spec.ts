import {
  SystemStatusProvider,
  SystemStatusSnapshot,
} from '../contracts/system-status.provider';
import { GetHealthStatusUseCase } from './get-health-status.use-case';

class FakeSystemStatusProvider extends SystemStatusProvider {
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
    const useCase = new GetHealthStatusUseCase(new FakeSystemStatusProvider());

    const result = useCase.execute();

    expect(result.status).toBe('ok');
    expect(result.timestamp.toISOString()).toBe('2026-08-02T00:00:00.000Z');
    expect(result.uptimeSeconds).toBe(120);
    expect(result.environment).toBe('test');
  });
});
