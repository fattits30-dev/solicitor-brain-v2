/**
 * Simple test to verify Jest configuration is working
 */

describe('Simple Test', () => {
  it('should be able to run basic tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });

  it('should work with TypeScript', () => {
    const obj: { name: string; value: number } = {
      name: 'test',
      value: 42
    };
    
    expect(obj.name).toBe('test');
    expect(obj.value).toBe(42);
  });
});