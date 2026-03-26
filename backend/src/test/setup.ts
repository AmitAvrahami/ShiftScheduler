/**
 * Global Jest setup — runs before every test file.
 *
 * This file intentionally does NOT start a database. Integration tests that
 * require Mongoose must import and call the helpers from `./dbSetup.ts`.
 */

jest.setTimeout(60000); // 60 seconds

// Suppress verbose debug logs from the CSP algorithm during test runs
jest.spyOn(console, 'debug').mockImplementation(() => {});
