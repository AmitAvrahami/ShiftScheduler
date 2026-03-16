import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryReplSet;

jest.setTimeout(60000); // 60 seconds

// Suppress verbose debug logs from the CSP algorithm during test runs
jest.spyOn(console, 'debug').mockImplementation(() => {});

beforeAll(async () => {
    // Use a single-node replica set so mongoose transactions (withTransaction) work in tests.
    // MongoMemoryReplSet manages its own temp directory automatically.
    mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
});

afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
    }
});

afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
});
