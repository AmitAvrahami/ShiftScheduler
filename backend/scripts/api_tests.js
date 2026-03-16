const BASE_URL = 'http://127.0.0.1:5001/api';

async function fetchJson(method, endpoint, body = null, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const error = new Error(`HTTP ${res.status}`);
        error.status = res.status;
        error.data = data;
        throw error;
    }
    return { status: res.status, data };
}

async function run() {
    let results = [];
    const log = (testNum, desc, exp, act, status, msg = '') => {
        results.push({ testNum, desc, exp, act, status, msg });
        console.log(`Test ${testNum}: ${status} | Expected: ${exp} | Actual: ${act} | ${msg}`);
    };

    try {
        console.log("-> Logging in to get tokens...");
        let managerToken = '';
        let employeeToken = '';

        try {
            const mRes = await fetchJson('POST', '/auth/login', { email: 'dana@bezeq.co.il', password: 'password123' });
            managerToken = mRes.data.token;
        } catch (e) { console.error("Manager login failed", e.data || e.message); return; }

        try {
            const eRes = await fetchJson('POST', '/auth/login', { email: 'amit@bezeq.co.il', password: 'password123' });
            employeeToken = eRes.data.token;
        } catch (e) { console.error("Employee login failed", e.data || e.message); return; }

        const weekId = '2026-W12';

        // --- Test 1 ---
        try {
            await fetchJson('POST', '/schedules/generate', { weekId }, employeeToken);
            log(1, "Employee cannot generate", 403, 200, "❌", "Should have failed");
        } catch (e) {
            log(1, "Employee cannot generate", 403, e.status, e.status === 403 ? "✅" : "❌");
        }

        // --- Test 2 ---
        let scheduleVersion1;
        try {
            const res = await fetchJson('POST', '/schedules/generate', { weekId }, managerToken);
            const { schedule, warnings } = res.data.data;
            scheduleVersion1 = schedule;
            const validShifts = schedule.shifts.length === 21;
            log(2, "Manager generates schedule", 200, res.status, validShifts ? "✅" : "❌", `Shifts: ${schedule.shifts.length}, Warnings: ${warnings.length}`);
        } catch (e) {
            log(2, "Manager generates schedule", 200, e.status || e.message, "❌", "Failed to generate");
        }

        // --- Test 4 ---
        try {
            const res = await fetchJson('POST', '/schedules/generate', { weekId }, managerToken);
            const { warnings } = res.data.data;
            const hasWarning = warnings.includes("שים לב: האילוצים לשבוע זה טרם ננעלו");
            log(4, "Unlocked constraints warning", "true", hasWarning.toString(), hasWarning ? "✅" : "⚠️", "Warning check");
        } catch (e) {
            log(4, "Unlocked constraints warning", "true", "error", "❌", "Failed to regenerate");
        }

        // --- Test 5 ---
        try {
            await fetchJson('GET', `/schedules/${weekId}`, null, employeeToken);
            log(5, "Employee cannot see unpublished", 404, 200, "❌");
        } catch (e) {
            log(5, "Employee cannot see unpublished", 404, e.status, e.status === 404 ? "✅" : "❌");
        }

        // --- Test 6 ---
        try {
            const res = await fetchJson('GET', `/schedules/${weekId}`, null, managerToken);
            log(6, "Manager can see unpublished", 200, res.status, res.status === 200 ? "✅" : "❌");
        } catch (e) {
            log(6, "Manager can see unpublished", 200, e.status, "❌");
        }

        // --- Test 7 ---
        try {
            await fetchJson('GET', `/schedules/${weekId}/my`, null, employeeToken);
            log(7, "Get my shifts unpublished", 404, 200, "❌");
        } catch (e) {
            log(7, "Get my shifts unpublished", 404, e.status, e.status === 404 ? "✅" : "❌");
        }

        // --- Test 8 ---
        try {
            await fetchJson('PATCH', `/schedules/${weekId}/publish`, null, employeeToken);
            log(8, "Employee cannot publish", 403, 200, "❌");
        } catch (e) {
            log(8, "Employee cannot publish", 403, e.status, e.status === 403 ? "✅" : "❌");
        }

        // --- Test 9 ---
        try {
            const res = await fetchJson('PATCH', `/schedules/${weekId}/publish`, null, managerToken);
            log(9, "Manager publishes schedule", 200, res.status, res.data.data.isPublished ? "✅" : "❌");
        } catch (e) {
            log(9, "Manager publishes schedule", 200, e.status, "❌");
        }

        // --- Test 10 ---
        try {
            const res = await fetchJson('GET', `/schedules/${weekId}`, null, employeeToken);
            log(10, "After publish employee sees schedule", 200, res.status, res.status === 200 ? "✅" : "❌");
        } catch (e) {
            log(10, "After publish employee sees schedule", 200, e.status, "❌");
        }

        // --- Test 7.5 ---
        try {
            const res = await fetchJson('GET', `/schedules/${weekId}/my`, null, employeeToken);
            log(7.5, "Get my shifts (published)", 200, res.status, res.status === 200 ? "✅" : "❌");
        } catch (e) {
            log(7.5, "Get my shifts (published)", 200, e.status, "❌");
        }

        // --- Test 3 ---
        try {
            await fetchJson('POST', '/schedules/generate', { weekId }, managerToken);
            log(3, "Cannot generate already-published", 400, 200, "❌");
        } catch (e) {
            log(3, "Cannot generate already-published", 400, e.status, e.status === 400 ? "✅" : "❌");
        }

        // --- Test 11 ---
        let notifId;
        try {
            const res = await fetchJson('GET', '/notifications', null, employeeToken);
            const data = res.data.data;
            const valid = data.unreadCount >= 1 && data.notifications[0].message.includes(weekId);
            notifId = data.notifications[0]._id;
            log(11, "Employee has unread notif", 200, res.status, valid ? "✅" : "❌", `Count: ${data.unreadCount}`);
        } catch (e) {
            log(11, "Employee has unread notif", 200, e.status || e.message, "❌");
        }

        // --- Test 13 ---
        if (notifId) {
            try {
                await fetchJson('PATCH', `/notifications/${notifId}/read`, null, managerToken);
                log(13, "Cannot mark another user notif", 403, 200, "❌");
            } catch (e) {
                const isAuthDeny = e.status === 403 || e.status === 404;
                log(13, "Cannot mark another user notif", "403/404", e.status, isAuthDeny ? "✅" : "❌");
            }

            // --- Test 12 ---
            try {
                const res = await fetchJson('PATCH', `/notifications/${notifId}/read`, null, employeeToken);
                log(12, "Mark notif as read", 200, res.status, res.data.data.isRead ? "✅" : "❌");
            } catch (e) {
                log(12, "Mark notif as read", 200, e.status, "❌");
            }
        }

        // --- Test 14 ---
        try {
            const weekId14 = '2026-W13';
            await fetchJson('POST', '/constraints', {
                weekId: weekId14,
                constraints: [{ date: '2026-03-22T00:00:00.000Z', type: 'morning', reason: 'Test' }]
            }, employeeToken);

            const res = await fetchJson('POST', '/schedules/generate', { weekId: weekId14 }, managerToken);
            const morningShift = res.data.data.schedule.shifts.find(s => new Date(s.date).toISOString() === '2026-03-22T00:00:00.000Z' && s.type === 'morning');

            const meRes = await fetchJson('GET', '/auth/me', null, employeeToken);
            const empId = meRes.data.user._id;

            const empInShift = morningShift.employees.some(e => e._id === empId);
            log(14, "Constraint Integration", "false", empInShift.toString(), !empInShift ? "✅" : "❌");
        } catch (e) {
            log(14, "Constraint Integration", 200, e.status || e.message, "❌");
        }

        console.log("\n--- JSON RESULTS ---");
        console.log(JSON.stringify(results));

    } catch (err) {
        console.error("Critical script error:", err);
    }
}

run();
