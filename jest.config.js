/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      diagnostics: false, // Type checking handled by tsc, not ts-jest
      tsconfig: {
        esModuleInterop: true,
      },
    }],
  },
  moduleNameMapper: {
    // Map better-sqlite3 to its pre-built binary
    'better-sqlite3': '<rootDir>/node_modules/better-sqlite3',
  },
  testTimeout: 10000,
};
