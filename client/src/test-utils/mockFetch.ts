// simple fetch mock helper for tests
export function mockFetchOnce(status: number, body: any) {
  (global as any).fetch = jest.fn().mockResolvedValue({
    ok: true,
    status,
    json: async () => body,
  });
}
