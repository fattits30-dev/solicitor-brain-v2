import { describe, expect, it } from '@jest/globals';
import { AuthService } from '../services/auth';

describe('AuthService Import Test', () => {
  it('should import AuthService successfully', () => {
    expect(AuthService).toBeDefined();
    expect(typeof AuthService.register).toBe('function');
  });
});
