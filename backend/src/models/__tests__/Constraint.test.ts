import mongoose from 'mongoose';
import { Constraint } from '../Constraint';

describe('Constraint Model', () => {
    it('creates a valid constraint document successfully', async () => {
        const validConstraint = new Constraint({
            userId: new mongoose.Types.ObjectId(),
            weekId: '2026-W11',
            constraints: [
                {
                    date: new Date('2026-03-08'),
                    shift: 'morning',
                    canWork: true,
                },
            ],
        });

        const savedConstraint = await validConstraint.save();
        expect(savedConstraint._id).toBeDefined();
        expect(savedConstraint.weekId).toBe('2026-W11');
        expect(savedConstraint.constraints.length).toBe(1);
        expect(savedConstraint.isLocked).toBe(false);
    });

    it('fails if required fields are missing', async () => {
        const constraintWithoutRequired = new Constraint({
            // missing userId, weekId
            constraints: [],
        });

        let error;
        try {
            await constraintWithoutRequired.save();
        } catch (err) {
            error = err;
        }

        expect(error).toBeInstanceOf(mongoose.Error.ValidationError);
        if (error instanceof mongoose.Error.ValidationError) {
            expect(error.errors.userId).toBeDefined();
            expect(error.errors.weekId).toBeDefined();
        }
    });

    it('weekId format is stored correctly', async () => {
        const constraint = new Constraint({
            userId: new mongoose.Types.ObjectId(),
            weekId: '2026-W11',
            constraints: [],
        });

        const savedConstraint = await constraint.save();
        expect(savedConstraint.weekId).toBe('2026-W11');
    });

    it('enforces compound unique index (userId + weekId)', async () => {
        const userId = new mongoose.Types.ObjectId();
        const weekId = '2026-W11';

        const constraint1 = new Constraint({
            userId,
            weekId,
            constraints: [],
        });
        await constraint1.save();

        const constraint2 = new Constraint({
            userId,
            weekId,
            constraints: [],
        });

        let error;
        try {
            await constraint2.save();
        } catch (err) {
            error = err;
        }

        expect(error).toBeDefined();
        expect((error as any).code).toBe(11000); // MongoDB duplicate key error code
    });

    it('isLocked defaults to false', async () => {
        const constraint = new Constraint({
            userId: new mongoose.Types.ObjectId(),
            weekId: '2026-W12',
            constraints: [],
        });

        const savedConstraint = await constraint.save();
        expect(savedConstraint.isLocked).toBe(false);
    });

    it('timestamps (createdAt, updatedAt) are set automatically', async () => {
        const constraint = new Constraint({
            userId: new mongoose.Types.ObjectId(),
            weekId: '2026-W13',
            constraints: [],
        });

        const savedConstraint = await constraint.save();
        expect(savedConstraint.createdAt).toBeDefined();
        expect(savedConstraint.updatedAt).toBeDefined();
        // Verify they are valid dates
        expect(savedConstraint.createdAt instanceof Date).toBe(true);
        expect(savedConstraint.updatedAt instanceof Date).toBe(true);
    });
});
