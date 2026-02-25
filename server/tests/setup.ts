// Set env vars before any test modules load
process.env.JWT_SECRET = 'test-secret-key-for-vitest-at-least-32-chars';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-vitest-32ch';
process.env.NODE_ENV = 'test';
