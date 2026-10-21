// Test environment. Values are throwaway and only valid against compose.test.yml.
Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://test:test@localhost:55432/test",
  CREW_PASSCODE: "boo-crew-2026",
  SESSION_SECRET: "test-secret-test-secret-test-secret-123",
  SCREEN_TOKEN: "screen-token-for-tests",
  PUBLIC_URL: "https://fear.test",
  EVENT_START: "2000-01-01T00:00:00-07:00",
  EVENT_END: "2100-01-01T00:00:00-07:00",
  PHOTO_DELETE_AT: "2100-01-01T00:00:00-07:00",
  PHOTO_DIR: `${process.cwd()}/.test-photos`,
});

export {};
