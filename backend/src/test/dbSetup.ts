/**
 * Shared DB lifecycle helpers for integration tests that require a real Mongoose
 * connection. Import this file from any test suite that needs to read/write
 * MongoDB — do NOT import it from pure-function algorithm tests.
 *
 * Usage:
 * ```ts
 * import { setupTestDatabase, teardownTestDatabase, clearCollections } from '../../test/dbSetup';
 *
 * beforeAll(setupTestDatabase);
 * afterAll(teardownTestDatabase);
 * afterEach(clearCollections);
 * ```
 */

import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryReplSet;

/**
 * Starts a MongoMemoryReplSet and connects Mongoose.
 * Use in `beforeAll` of integration test suites.
 */
export async function setupTestDatabase(): Promise<void> {
    mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
}

/**
 * Disconnects Mongoose and stops the in-memory server.
 * Use in `afterAll` of integration test suites.
 */
export async function teardownTestDatabase(): Promise<void> {
    await mongoose.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
    }
}

/**
 * Drops all documents from every collection.
 * Use in `afterEach` to ensure test isolation.
 */
export async function clearCollections(): Promise<void> {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
}
