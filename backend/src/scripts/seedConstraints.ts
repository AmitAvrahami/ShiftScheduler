/**
 * Seeds employee constraints for a specific week.
 *
 * Usage:
 *   npx ts-node src/scripts/seedConstraints.ts
 *
 * Week: 2026-W12 (Sun 2026-03-15 → Sat 2026-03-21)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User';
import { Constraint } from '../models/Constraint';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ─── Week Configuration ────────────────────────────────────────────────────────

const WEEK_ID = '2026-W12';

// Dates as UTC midnight strings so DB storage is deterministic across timezones
const D = {
    sun: new Date('2026-03-15'),
    mon: new Date('2026-03-16'),
    tue: new Date('2026-03-17'),
    wed: new Date('2026-03-18'),
    thu: new Date('2026-03-19'),
    fri: new Date('2026-03-20'),
    sat: new Date('2026-03-21'),
};

type Shift = 'morning' | 'afternoon' | 'night';
const ALL_SHIFTS: Shift[] = ['morning', 'afternoon', 'night'];
const ALL_DAYS = Object.values(D);

function block(date: Date, ...shifts: Shift[]) {
    return shifts.map(shift => ({ date, shift, canWork: false }));
}

// ─── Constraint Definitions ────────────────────────────────────────────────────

const employeeConstraints: {
    nameRegex: RegExp;
    displayName: string;
    note?: string;
    constraints: { date: Date; shift: string; canWork: boolean }[];
}[] = [
    {
        // שחר ויינברג
        nameRegex: /שחר/,
        displayName: 'Shahar',
        constraints: [
            ...block(D.sun, 'morning', 'afternoon'),
            ...block(D.wed, 'afternoon', 'night'),
            ...block(D.fri, 'afternoon'),
            ...block(D.sat, 'afternoon', 'night'),
        ],
    },
    {
        nameRegex: /עמית/,
        displayName: 'Amit (עמית אברהמי)',
        constraints: [
            ...block(D.sun, 'morning'),
            ...block(D.tue, 'morning'),
            ...block(D.wed, 'morning'),
            ...block(D.thu, 'morning'),
            ...block(D.fri, 'afternoon'),
            ...block(D.sat, 'afternoon'),
        ],
    },
    {
        // שני טקה
        nameRegex: /שני/,
        displayName: 'Shani',
        constraints: [
            ...block(D.mon, 'morning'),
            ...block(D.tue, 'morning', 'afternoon', 'night'),
            ...block(D.wed, 'morning'),
            ...block(D.fri, 'afternoon'),
        ],
    },
    {
        // לאורה ערב
        nameRegex: /לאורה/,
        displayName: 'Laura',
        constraints: [
            ...block(D.mon, 'night'),
            ...block(D.tue, 'morning', 'afternoon'),
        ],
    },
    {
        // פולינה לזרוב
        nameRegex: /פולינה/,
        displayName: 'Polina',
        constraints: [
            ...block(D.wed, 'morning'),
        ],
    },
    {
        // אופק כהן — on reserve, unavailable all week
        nameRegex: /אופק/,
        displayName: 'Ofek (reserve duty)',
        note: 'Blocked for all shifts — reserve duty',
        constraints: ALL_DAYS.flatMap(d => block(d, ...ALL_SHIFTS)),
    },
    {
        // Mital = Dana Cohen
        nameRegex: /דנה|מיטל/,
        displayName: 'Mital / Dana Cohen',
        constraints: [
            ...block(D.fri, 'morning'),
            ...block(D.sat, 'morning'),
        ],
    },
    {
        // מסי אסנקה — cannot work Thu morning, all of Fri, all of Sat
        nameRegex: /מסי/,
        displayName: 'Messi',
        constraints: [
            ...block(D.thu, 'morning'),
            ...block(D.fri, 'morning', 'afternoon', 'night'),
            ...block(D.sat, 'morning', 'afternoon', 'night'),
        ],
    },
];

// ─── Main ──────────────────────────────────────────────────────────────────────

async function run() {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log('Connected to MongoDB');
    console.log(`\nSeeding constraints for week ${WEEK_ID} (Sun 2026-03-15 → Sat 2026-03-21)\n`);
    console.log('─'.repeat(60));

    let ok = 0;
    let missing = 0;

    for (const { nameRegex, displayName, note, constraints } of employeeConstraints) {
        const user = await User.findOne({ name: nameRegex }).lean();

        if (!user) {
            console.warn(`⚠️  NOT FOUND: ${displayName} (regex: ${nameRegex})`);
            missing++;
            continue;
        }

        await Constraint.findOneAndUpdate(
            { userId: user._id, weekId: WEEK_ID },
            {
                userId: user._id,
                weekId: WEEK_ID,
                constraints,
                submittedAt: new Date(),
                isLocked: true,
            },
            { upsert: true, new: true },
        );

        const summary = note ?? `${constraints.length} blocked shifts`;
        console.log(`✅  ${displayName.padEnd(20)} (${user.name}) — ${summary}`);
        ok++;
    }

    console.log('─'.repeat(60));
    console.log(`\nDone. Seeded: ${ok}  |  Not found: ${missing}`);

    if (missing > 0) {
        console.log('\nTip: run "npx ts-node src/scripts/addEmployees.ts" first to create missing users.');
    }

    await mongoose.disconnect();
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
