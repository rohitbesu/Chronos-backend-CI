// import express from 'express';
// import { join, dirname } from 'path';
// import { fileURLToPath } from 'url';
// import { Low } from 'lowdb';
// import { JSONFile } from 'lowdb/node';
// import { v4 as uuidv4 } from 'uuid';
// import cron from 'node-cron';

// // ─── Database Setup ───────────────────────────────────────────────────────────
// const __dirname = dirname(fileURLToPath(import.meta.url));
// const file = join(__dirname, 'db.json');
// const adapter = new JSONFile(file);
// const db = new Low(adapter, { jobs: [] });

// await db.read();
// db.data ||= { jobs: [] };
// await db.write();

// // ─── Express Setup ────────────────────────────────────────────────────────────
// const app = express();
// const PORT = process.env.PORT || 3000;
// const API_KEY = process.env.API_KEY || 'chronos-secret-key';

// app.use(express.json());

// // ─── Auth Middleware ──────────────────────────────────────────────────────────
// // All /jobs routes require a valid API key in the x-api-key header.
// function requireAuth(req, res, next) {
//     const key = req.headers['x-api-key'];
//     if (!key || key !== API_KEY) {
//         return res.status(401).json({ message: 'Unauthorized: provide a valid x-api-key header.' });
//     }
//     next();
// }

// // ─── Health Check ─────────────────────────────────────────────────────────────
// app.get('/test', (req, res) => {
//     res.json({ message: 'Chronos Server is Alive and Running!' });
// });

// // ─── POST /jobs ───────────────────────────────────────────────────────────────
// // Submit a new job. Supports one-time (executionTime) and recurring (cronExpression).
// //
// // Body (one-time):
// //   { "name": "Send Email", "executionTime": "2026-05-29T10:00:00Z" }
// //
// // Body (recurring):
// //   { "name": "Daily Report", "cronExpression": "0 9 * * *" }
// app.post('/jobs', requireAuth, async (req, res) => {
//     await db.read();

//     const { name, executionTime, cronExpression } = req.body;

//     if (!name) {
//         return res.status(400).json({ message: 'name is required.' });
//     }
//     if (!executionTime && !cronExpression) {
//         return res.status(400).json({ message: 'Provide either executionTime (one-time) or cronExpression (recurring).' });
//     }
//     if (cronExpression && !cron.validate(cronExpression)) {
//         return res.status(400).json({ message: 'Invalid cronExpression. Example: "0 9 * * *"' });
//     }

//     const newJob = {
//         id: uuidv4(),
//         name,
//         type: cronExpression ? 'recurring' : 'one-time',
//         executionTime: executionTime || null,       // ISO string for one-time jobs
//         cronExpression: cronExpression || null,     // cron string for recurring jobs
//         lastRunAt: null,                            // timestamp of last execution
//         nextRunAt: executionTime || null,           // for display purposes
//         status: 'scheduled',
//         retryCount: 0,
//         createdAt: new Date().toISOString()
//     };

//     db.data.jobs.push(newJob);
//     await db.write();

//     res.status(201).json({ message: 'Job submitted successfully!', job: newJob });
// });

// // ─── GET /jobs ────────────────────────────────────────────────────────────────
// // Returns all jobs. Optional query: ?status=scheduled|completed|failed|cancelled
// app.get('/jobs', requireAuth, async (req, res) => {
//     await db.read();
//     const { status } = req.query;
//     const jobs = status
//         ? db.data.jobs.filter(j => j.status === status)
//         : db.data.jobs;
//     res.json(jobs);
// });

// // ─── GET /jobs/:id ────────────────────────────────────────────────────────────
// // Returns a single job by ID.
// app.get('/jobs/:id', requireAuth, async (req, res) => {
//     await db.read();
//     const job = db.data.jobs.find(j => j.id === req.params.id);
//     if (!job) return res.status(404).json({ message: 'Job not found.' });
//     res.json(job);
// });

// // ─── DELETE /jobs/:id ─────────────────────────────────────────────────────────
// // Cancel a scheduled job.
// app.delete('/jobs/:id', requireAuth, async (req, res) => {
//     await db.read();
//     const job = db.data.jobs.find(j => j.id === req.params.id);

//     if (!job) return res.status(404).json({ message: 'Job not found.' });
//     if (job.status !== 'scheduled') {
//         return res.status(400).json({ message: `Cannot cancel a job with status "${job.status}".` });
//     }

//     job.status = 'cancelled';
//     await db.write();
//     res.json({ message: 'Job cancelled successfully.', job });
// });

// // ─── PATCH /jobs/:id/reschedule ───────────────────────────────────────────────
// // Reschedule a cancelled or failed job.
// //
// // Body (one-time):  { "executionTime": "2026-06-01T09:00:00Z" }
// // Body (recurring): { "cronExpression": "0 10 * * 1" }
// app.patch('/jobs/:id/reschedule', requireAuth, async (req, res) => {
//     await db.read();
//     const job = db.data.jobs.find(j => j.id === req.params.id);

//     if (!job) return res.status(404).json({ message: 'Job not found.' });
//     if (job.status === 'scheduled') {
//         return res.status(400).json({ message: 'Job is already scheduled.' });
//     }

//     const { executionTime, cronExpression } = req.body;

//     if (!executionTime && !cronExpression) {
//         return res.status(400).json({ message: 'Provide either executionTime or cronExpression.' });
//     }
//     if (cronExpression && !cron.validate(cronExpression)) {
//         return res.status(400).json({ message: 'Invalid cronExpression.' });
//     }

//     // Reset the job for a fresh run
//     job.status = 'scheduled';
//     job.retryCount = 0;                                    // ← reset retry counter
//     job.executionTime = executionTime || job.executionTime;
//     job.cronExpression = cronExpression || job.cronExpression;
//     job.type = cronExpression ? 'recurring' : 'one-time';
//     job.nextRunAt = executionTime || null;
//     job.lastRunAt = null;

//     await db.write();
//     res.json({ message: 'Job rescheduled successfully.', job });
// });

// // ─── Simple Browser UI ────────────────────────────────────────────────────────
// app.get('/', (req, res) => {
//     res.send(`
//         <html>
//         <head><title>Chronos</title></head>
//         <body style="font-family:sans-serif;margin:40px;background:#f4f4f9;">
//             <h2>🕒 Chronos Job Scheduler</h2>
//             <p style="color:#666;">Use the API with header <code>x-api-key: ${API_KEY}</code></p>

//             <div style="display:flex;gap:20px;flex-wrap:wrap;">
//                 <div style="background:white;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,.1);width:340px;">
//                     <h3 style="margin-top:0">Submit a Job</h3>

//                     <label><b>Job Name:</b></label><br>
//                     <input id="jobName" value="Send Weekly Report" style="width:100%;padding:8px;margin:6px 0;box-sizing:border-box;"><br>

//                     <label><b>Type:</b></label><br>
//                     <select id="jobType" onchange="toggleFields()" style="width:100%;padding:8px;margin:6px 0;">
//                         <option value="one-time">One-Time</option>
//                         <option value="recurring">Recurring</option>
//                     </select><br>

//                     <div id="oneTimeFields">
//                         <label><b>Run in:</b></label><br>
//                         <select id="delay" style="width:100%;padding:8px;margin:6px 0;">
//                             <option value="15">15 seconds</option>
//                             <option value="30">30 seconds</option>
//                             <option value="60">1 minute</option>
//                         </select>
//                     </div>

//                     <div id="recurringFields" style="display:none;">
//                         <label><b>Cron Expression:</b></label><br>
//                         <input id="cronExpr" value="*/1 * * * *" style="width:100%;padding:8px;margin:6px 0;box-sizing:border-box;">
//                         <small style="color:#888;">Example: <code>*/1 * * * *</code> = every minute</small>
//                     </div><br>

//                     <button onclick="submitJob()" style="background:#007bff;color:white;border:none;padding:10px;border-radius:4px;cursor:pointer;width:100%;font-weight:bold;">Submit Job</button>
//                     <button onclick="viewJobs()" style="background:#28a745;color:white;border:none;padding:10px;border-radius:4px;cursor:pointer;width:100%;margin-top:8px;font-weight:bold;">🔄 View All Jobs</button>
//                 </div>

//                 <div style="flex:1;min-width:300px;">
//                     <h3>Response:</h3>
//                     <pre id="response" style="background:#212529;color:#f8f9fa;padding:15px;border-radius:5px;min-height:300px;max-height:500px;overflow-y:auto;">Click a button to see data...</pre>
//                 </div>
//             </div>

//             <script>
//                 const API_KEY = '${API_KEY}';
//                 const headers = { 'Content-Type': 'application/json', 'x-api-key': API_KEY };

//                 function toggleFields() {
//                     const t = document.getElementById('jobType').value;
//                     document.getElementById('oneTimeFields').style.display = t === 'one-time' ? '' : 'none';
//                     document.getElementById('recurringFields').style.display = t === 'recurring' ? '' : 'none';
//                 }

//                 async function submitJob() {
//                     const name = document.getElementById('jobName').value;
//                     const type = document.getElementById('jobType').value;
//                     let body = { name };

//                     if (type === 'one-time') {
//                         const secs = parseInt(document.getElementById('delay').value);
//                         body.executionTime = new Date(Date.now() + secs * 1000).toISOString();
//                     } else {
//                         body.cronExpression = document.getElementById('cronExpr').value;
//                     }

//                     try {
//                         const res = await fetch('/jobs', { method:'POST', headers, body: JSON.stringify(body) });
//                         document.getElementById('response').innerText = JSON.stringify(await res.json(), null, 2);
//                     } catch(e) { document.getElementById('response').innerText = 'Error: ' + e.message; }
//                 }

//                 async function viewJobs() {
//                     try {
//                         const res = await fetch('/jobs', { headers });
//                         document.getElementById('response').innerText = JSON.stringify(await res.json(), null, 2);
//                     } catch(e) { document.getElementById('response').innerText = 'Error: ' + e.message; }
//                 }
//             </script>
//         </body>
//         </html>
//     `);
// });

// // ─── Background Scheduler ─────────────────────────────────────────────────────
// // Runs every 10 seconds. Handles both one-time and recurring jobs.
// cron.schedule('*/10 * * * * *', async () => {
//     await db.read();
//     const now = new Date();

//     for (let job of db.data.jobs) {
//         if (job.status !== 'scheduled') continue;

//         // Determine if this job should fire now
//         const shouldRun =
//             (job.type === 'one-time' && new Date(job.executionTime) <= now) ||
//             (job.type === 'recurring' && shouldRecurringRun(job, now));

//         if (!shouldRun) continue;

//         console.log(`\n⏳ [SCHEDULER] Running: "${job.name}" (${job.type}) ID: ${job.id}`);

//         try {
//             // Simulate execution — 80% success, 20% failure
//             const success = Math.random() > 0.2;
//             if (!success) throw new Error('Simulated execution failure');

//             job.lastRunAt = now.toISOString();

//             if (job.type === 'one-time') {
//                 job.status = 'completed';
//                 console.log(`✅ [SCHEDULER] "${job.name}" completed.`);
//             } else {
//                 // Recurring jobs stay 'scheduled' — they run again next cycle
//                 job.retryCount = 0;
//                 console.log(`✅ [SCHEDULER] "${job.name}" ran successfully. Next check in 10s.`);
//             }

//         } catch (error) {
//             job.retryCount += 1;
//             console.log(`❌ [SCHEDULER] "${job.name}" failed. Attempt ${job.retryCount}/3`);

//             if (job.retryCount < 3) {
//                 job.status = 'scheduled';
//                 console.log(`🔄 [SCHEDULER] Retrying "${job.name}"...`);
//             } else {
//                 job.status = 'failed';
//                 console.log(`🚨 [SCHEDULER] "${job.name}" permanently failed after 3 attempts.`);
//                 // In production: send an email/notification to the user here
//             }
//         }

//         await db.write();
//     }
// });

// // Helper: check if a recurring job should fire based on its cron expression.
// // We compare the job's lastRunAt against the current minute to avoid double-runs.
// function shouldRecurringRun(job, now) {
//     if (!cron.validate(job.cronExpression)) return false;

//     // Simple minute-level check: has this job not run in the current minute?
//     const lastRun = job.lastRunAt ? new Date(job.lastRunAt) : null;
//     if (lastRun) {
//         const diffMs = now - lastRun;
//         // Don't re-run if it ran less than 50 seconds ago (prevents double-fire in 10s loop)
//         if (diffMs < 50000) return false;
//     }

//     // Use node-cron's internal matching by checking if cron would have fired
//     // between lastRunAt and now. Simple approach: match on minute boundaries.
//     const task = cron.getTasks?.();
//     // Fallback: basic check using a temporary scheduled task match
//     // We'll use a pragmatic approach — parse the minimum interval from common patterns
//     return matchesCron(job.cronExpression, now);
// }

// // Lightweight cron matcher for the 5-field standard format (min hour dom month dow)
// function matchesCron(expr, date) {
//     const parts = expr.trim().split(/\s+/);
//     if (parts.length !== 5) return false;

//     const [min, hour, dom, month, dow] = parts;
//     const checks = [
//         [min,   date.getMinutes()],
//         [hour,  date.getHours()],
//         [dom,   date.getDate()],
//         [month, date.getMonth() + 1],
//         [dow,   date.getDay()],
//     ];

//     return checks.every(([field, val]) => fieldMatches(field, val));
// }

// function fieldMatches(field, val) {
//     if (field === '*') return true;
//     if (field.includes('/')) {
//         const [, step] = field.split('/');
//         return val % parseInt(step) === 0;
//     }
//     if (field.includes('-')) {
//         const [start, end] = field.split('-').map(Number);
//         return val >= start && val <= end;
//     }
//     if (field.includes(',')) {
//         return field.split(',').map(Number).includes(val);
//     }
//     return parseInt(field) === val;
// }

// // ─── Start Server ─────────────────────────────────────────────────────────────
// app.listen(PORT, () => {
//     console.log(`🚀 Chronos running at http://localhost:${PORT}`);
//     console.log(`🔑 API Key: ${API_KEY}`);
//     console.log(`📖 Docs: see README.md`);
// });




import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { v4 as uuidv4 } from 'uuid';
import cron from 'node-cron';

// ─── Database Setup ───────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter, { jobs: [] });

await db.read();
db.data ||= { jobs: [] };
await db.write();

// ─── Express Setup ────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'chronos-secret-key';

app.use(express.json());

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
    const key = req.headers['x-api-key'];
    if (!key || key !== API_KEY) {
        return res.status(401).json({ message: 'Unauthorized: provide a valid x-api-key header.' });
    }
    next();
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

// Calculate next run time for a cron expression
function getNextCronRun(cronExpression) {
    const now = new Date();
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length !== 5) return null;

    // For simple cases, just add 1 minute as approximation
    // This is good enough for display purposes
    const next = new Date(now.getTime() + 60000);
    return next.toISOString();
}

// Check if a cron expression matches the current time
function matchesCron(expr, date) {
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5) return false;

    const [min, hour, dom, month, dow] = parts;
    const checks = [
        [min, date.getMinutes()],
        [hour, date.getHours()],
        [dom, date.getDate()],
        [month, date.getMonth() + 1],
        [dow, date.getDay()],
    ];

    return checks.every(([field, val]) => fieldMatches(field, val));
}

function fieldMatches(field, val) {
    if (field === '*') return true;
    if (field.includes('/')) {
        const [base, step] = field.split('/');
        const stepNum = parseInt(step);
        if (base === '*') return val % stepNum === 0;
        return val >= parseInt(base) && val % stepNum === 0;
    }
    if (field.includes('-')) {
        const [start, end] = field.split('-').map(Number);
        return val >= start && val <= end;
    }
    if (field.includes(',')) {
        return field.split(',').map(Number).includes(val);
    }
    return parseInt(field) === val;
}

// Format date for logging
function formatTime(date) {
    return date.toISOString().replace('T', ' ').substring(0, 19);
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/test', (req, res) => {
    res.json({ 
        message: 'Chronos Server is Alive and Running!',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ─── POST /jobs ───────────────────────────────────────────────────────────────
// Submit a new job. Supports one-time (executionTime) and recurring (cronExpression).
app.post('/jobs', requireAuth, async (req, res) => {
    await db.read();

    const { name, executionTime, cronExpression, payload } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ message: 'name is required and must be a non-empty string.' });
    }
    if (!executionTime && !cronExpression) {
        return res.status(400).json({ message: 'Provide either executionTime (one-time) or cronExpression (recurring).' });
    }
    if (executionTime && cronExpression) {
        return res.status(400).json({ message: 'Provide only one: executionTime OR cronExpression, not both.' });
    }
    if (cronExpression && !cron.validate(cronExpression)) {
        return res.status(400).json({ message: 'Invalid cronExpression. Example: "0 9 * * *" for daily at 9am.' });
    }
    if (executionTime) {
        const execDate = new Date(executionTime);
        if (isNaN(execDate.getTime())) {
            return res.status(400).json({ message: 'Invalid executionTime format. Use ISO 8601 format.' });
        }
        if (execDate <= new Date()) {
            return res.status(400).json({ message: 'executionTime must be in the future.' });
        }
    }

    const now = new Date();
    const isRecurring = !!cronExpression;

    const newJob = {
        id: uuidv4(),
        name: name.trim(),
        type: isRecurring ? 'recurring' : 'one-time',
        executionTime: executionTime || null,
        cronExpression: cronExpression || null,
        payload: payload || {},
        lastRunAt: null,
        nextRunAt: isRecurring ? getNextCronRun(cronExpression) : executionTime,
        status: 'scheduled',
        retryCount: 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    };

    db.data.jobs.push(newJob);
    await db.write();

    console.log(`📝 [${formatTime(now)}] Job created: "${newJob.name}" (${newJob.type}) ID: ${newJob.id}`);

    res.status(201).json({ message: 'Job submitted successfully!', job: newJob });
});

// ─── GET /jobs ────────────────────────────────────────────────────────────────
// Returns all jobs. Optional query: ?status=scheduled|completed|failed|cancelled
app.get('/jobs', requireAuth, async (req, res) => {
    await db.read();
    const { status, type } = req.query;
    
    let jobs = db.data.jobs;
    
    if (status) {
        jobs = jobs.filter(j => j.status === status);
    }
    if (type) {
        jobs = jobs.filter(j => j.type === type);
    }
    
    // Sort by createdAt descending (newest first)
    jobs = jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
        count: jobs.length,
        jobs: jobs
    });
});

// ─── GET /jobs/:id ────────────────────────────────────────────────────────────
app.get('/jobs/:id', requireAuth, async (req, res) => {
    await db.read();
    const job = db.data.jobs.find(j => j.id === req.params.id);
    if (!job) {
        return res.status(404).json({ message: 'Job not found.' });
    }
    res.json(job);
});

// ─── DELETE /jobs/:id ─────────────────────────────────────────────────────────
// Cancel a scheduled job.
app.delete('/jobs/:id', requireAuth, async (req, res) => {
    await db.read();
    const job = db.data.jobs.find(j => j.id === req.params.id);

    if (!job) {
        return res.status(404).json({ message: 'Job not found.' });
    }
    if (job.status !== 'scheduled') {
        return res.status(400).json({ message: `Cannot cancel a job with status "${job.status}".` });
    }

    job.status = 'cancelled';
    job.updatedAt = new Date().toISOString();
    await db.write();

    console.log(`🚫 [${formatTime(new Date())}] Job cancelled: "${job.name}" ID: ${job.id}`);

    res.json({ message: 'Job cancelled successfully.', job });
});

// ─── PATCH /jobs/:id/reschedule ───────────────────────────────────────────────
// Reschedule a cancelled or failed job.
app.patch('/jobs/:id/reschedule', requireAuth, async (req, res) => {
    await db.read();
    const job = db.data.jobs.find(j => j.id === req.params.id);

    if (!job) {
        return res.status(404).json({ message: 'Job not found.' });
    }
    if (job.status === 'scheduled') {
        return res.status(400).json({ message: 'Job is already scheduled. Cancel it first to reschedule.' });
    }

    const { executionTime, cronExpression } = req.body;

    if (!executionTime && !cronExpression) {
        return res.status(400).json({ message: 'Provide either executionTime or cronExpression.' });
    }
    if (executionTime && cronExpression) {
        return res.status(400).json({ message: 'Provide only one: executionTime OR cronExpression.' });
    }
    if (cronExpression && !cron.validate(cronExpression)) {
        return res.status(400).json({ message: 'Invalid cronExpression.' });
    }
    if (executionTime && new Date(executionTime) <= new Date()) {
        return res.status(400).json({ message: 'executionTime must be in the future.' });
    }

    const isRecurring = !!cronExpression;

    // Reset the job for a fresh run
    job.status = 'scheduled';
    job.retryCount = 0;
    job.executionTime = executionTime || null;
    job.cronExpression = cronExpression || null;
    job.type = isRecurring ? 'recurring' : 'one-time';
    job.nextRunAt = isRecurring ? getNextCronRun(cronExpression) : executionTime;
    job.lastRunAt = null;
    job.updatedAt = new Date().toISOString();

    await db.write();

    console.log(`🔄 [${formatTime(new Date())}] Job rescheduled: "${job.name}" ID: ${job.id}`);

    res.json({ message: 'Job rescheduled successfully.', job });
});

// ─── GET /jobs/stats ──────────────────────────────────────────────────────────
// Get job statistics
app.get('/stats', requireAuth, async (req, res) => {
    await db.read();
    const jobs = db.data.jobs;

    const stats = {
        total: jobs.length,
        scheduled: jobs.filter(j => j.status === 'scheduled').length,
        completed: jobs.filter(j => j.status === 'completed').length,
        failed: jobs.filter(j => j.status === 'failed').length,
        cancelled: jobs.filter(j => j.status === 'cancelled').length,
        oneTime: jobs.filter(j => j.type === 'one-time').length,
        recurring: jobs.filter(j => j.type === 'recurring').length
    };

    res.json(stats);
});

// ─── Simple Browser UI ────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Chronos Job Scheduler</title>
            <meta charset="UTF-8">
            <style>
                * { box-sizing: border-box; }
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f4f4f9; }
                h2 { color: #333; margin-bottom: 10px; }
                .subtitle { color: #666; margin-bottom: 30px; }
                .container { display: flex; gap: 20px; flex-wrap: wrap; }
                .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,.1); }
                .form-card { width: 360px; }
                .response-card { flex: 1; min-width: 400px; }
                label { font-weight: 600; display: block; margin-bottom: 4px; color: #333; }
                input, select { width: 100%; padding: 10px; margin-bottom: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
                input:focus, select:focus { outline: none; border-color: #007bff; }
                button { width: 100%; padding: 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 14px; margin-bottom: 8px; transition: opacity 0.2s; }
                button:hover { opacity: 0.9; }
                .btn-primary { background: #007bff; color: white; }
                .btn-success { background: #28a745; color: white; }
                .btn-info { background: #17a2b8; color: white; }
                .btn-secondary { background: #6c757d; color: white; }
                pre { background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 5px; min-height: 400px; max-height: 500px; overflow: auto; margin: 0; font-size: 13px; line-height: 1.4; }
                .hint { font-size: 12px; color: #888; margin-top: -8px; margin-bottom: 12px; }
                h3 { margin-top: 0; margin-bottom: 15px; color: #333; }
                .button-group { display: flex; gap: 8px; }
                .button-group button { flex: 1; }
            </style>
        </head>
        <body>
            <h2>🕒 Chronos Job Scheduler</h2>
            <p class="subtitle">API Key: <code>${API_KEY}</code></p>

            <div class="container">
                <div class="card form-card">
                    <h3>Submit a Job</h3>

                    <label>Job Name</label>
                    <input id="jobName" value="Send Weekly Report" placeholder="Enter job name">

                    <label>Job Type</label>
                    <select id="jobType" onchange="toggleFields()">
                        <option value="one-time">One-Time</option>
                        <option value="recurring">Recurring</option>
                    </select>

                    <div id="oneTimeFields">
                        <label>Run In</label>
                        <select id="delay">
                            <option value="15">15 seconds</option>
                            <option value="30">30 seconds</option>
                            <option value="60">1 minute</option>
                            <option value="300">5 minutes</option>
                        </select>
                    </div>

                    <div id="recurringFields" style="display:none;">
                        <label>Cron Expression</label>
                        <input id="cronExpr" value="*/1 * * * *" placeholder="*/1 * * * *">
                        <p class="hint">Example: <code>*/1 * * * *</code> = every minute</p>
                    </div>

                    <label>Payload (JSON, optional)</label>
                    <input id="payload" value='{"email": "user@example.com"}' placeholder='{"key": "value"}'>

                    <button class="btn-primary" onclick="submitJob()">Submit Job</button>
                    
                    <div class="button-group">
                        <button class="btn-success" onclick="viewJobs()">View All</button>
                        <button class="btn-info" onclick="viewStats()">Stats</button>
                    </div>

                    <h3 style="margin-top: 20px;">Manage Job</h3>
                    <label>Job ID</label>
                    <input id="jobId" placeholder="Paste job ID here">
                    
                    <div class="button-group">
                        <button class="btn-secondary" onclick="getJob()">Get</button>
                        <button class="btn-secondary" onclick="cancelJob()" style="background: #dc3545;">Cancel</button>
                    </div>
                </div>

                <div class="card response-card">
                    <h3>Response</h3>
                    <pre id="response">Click a button to see results...</pre>
                </div>
            </div>

            <script>
                const API_KEY = '${API_KEY}';
                const headers = { 'Content-Type': 'application/json', 'x-api-key': API_KEY };

                function toggleFields() {
                    const t = document.getElementById('jobType').value;
                    document.getElementById('oneTimeFields').style.display = t === 'one-time' ? '' : 'none';
                    document.getElementById('recurringFields').style.display = t === 'recurring' ? '' : 'none';
                }

                function showResponse(data) {
                    document.getElementById('response').innerText = JSON.stringify(data, null, 2);
                }

                function showError(e) {
                    document.getElementById('response').innerText = 'Error: ' + e.message;
                }

                async function submitJob() {
                    const name = document.getElementById('jobName').value;
                    const type = document.getElementById('jobType').value;
                    let body = { name };

                    // Parse payload
                    try {
                        const payloadStr = document.getElementById('payload').value.trim();
                        if (payloadStr) {
                            body.payload = JSON.parse(payloadStr);
                        }
                    } catch (e) {
                        showResponse({ error: 'Invalid JSON in payload field' });
                        return;
                    }

                    if (type === 'one-time') {
                        const secs = parseInt(document.getElementById('delay').value);
                        body.executionTime = new Date(Date.now() + secs * 1000).toISOString();
                    } else {
                        body.cronExpression = document.getElementById('cronExpr').value;
                    }

                    try {
                        const res = await fetch('/jobs', { method: 'POST', headers, body: JSON.stringify(body) });
                        showResponse(await res.json());
                    } catch (e) { showError(e); }
                }

                async function viewJobs() {
                    try {
                        const res = await fetch('/jobs', { headers });
                        showResponse(await res.json());
                    } catch (e) { showError(e); }
                }

                async function viewStats() {
                    try {
                        const res = await fetch('/stats', { headers });
                        showResponse(await res.json());
                    } catch (e) { showError(e); }
                }

                async function getJob() {
                    const id = document.getElementById('jobId').value.trim();
                    if (!id) { showResponse({ error: 'Enter a job ID' }); return; }
                    try {
                        const res = await fetch('/jobs/' + id, { headers });
                        showResponse(await res.json());
                    } catch (e) { showError(e); }
                }

                async function cancelJob() {
                    const id = document.getElementById('jobId').value.trim();
                    if (!id) { showResponse({ error: 'Enter a job ID' }); return; }
                    try {
                        const res = await fetch('/jobs/' + id, { method: 'DELETE', headers });
                        showResponse(await res.json());
                    } catch (e) { showError(e); }
                }
            </script>
        </body>
        </html>
    `);
});

// ─── Background Scheduler ─────────────────────────────────────────────────────
// Runs every 10 seconds. Handles both one-time and recurring jobs.

let isProcessing = false; // Simple lock to prevent overlapping runs

cron.schedule('*/10 * * * * *', async () => {
    // Skip if already processing
    if (isProcessing) return;
    isProcessing = true;

    try {
        await db.read();
        const now = new Date();

        for (let job of db.data.jobs) {
            if (job.status !== 'scheduled') continue;

            let shouldRun = false;

            if (job.type === 'one-time') {
                // One-time job: check if execution time has passed
                shouldRun = new Date(job.executionTime) <= now;
            } else if (job.type === 'recurring') {
                // Recurring job: check if cron matches current minute
                if (!cron.validate(job.cronExpression)) continue;

                // Check if cron expression matches current time
                if (matchesCron(job.cronExpression, now)) {
                    // Make sure we haven't run in the last 50 seconds (avoid double-fire)
                    if (job.lastRunAt) {
                        const lastRun = new Date(job.lastRunAt);
                        const diffMs = now - lastRun;
                        if (diffMs < 50000) continue; // Skip, ran too recently
                    }
                    shouldRun = true;
                }
            }

            if (!shouldRun) continue;

            console.log(`\n⏳ [${formatTime(now)}] Running: "${job.name}" (${job.type}) ID: ${job.id}`);
            if (Object.keys(job.payload || {}).length > 0) {
                console.log(`   Payload: ${JSON.stringify(job.payload)}`);
            }

            try {
                // Simulate execution — 80% success, 20% failure
                const success = Math.random() > 0.2;
                if (!success) throw new Error('Simulated execution failure');

                // Job succeeded
                job.lastRunAt = now.toISOString();
                job.updatedAt = now.toISOString();

                if (job.type === 'one-time') {
                    job.status = 'completed';
                    console.log(`✅ [${formatTime(now)}] "${job.name}" completed successfully.`);
                } else {
                    // Recurring jobs stay scheduled, reset retry count
                    job.retryCount = 0;
                    job.nextRunAt = getNextCronRun(job.cronExpression);
                    console.log(`✅ [${formatTime(now)}] "${job.name}" ran successfully. Will run again based on schedule.`);
                }

            } catch (error) {
                // Job failed
                job.retryCount += 1;
                job.updatedAt = now.toISOString();
                
                console.log(`❌ [${formatTime(now)}] "${job.name}" failed. Attempt ${job.retryCount}/3. Error: ${error.message}`);

                if (job.retryCount >= 3) {
                    job.status = 'failed';
                    console.log(`🚨 [${formatTime(now)}] "${job.name}" permanently failed after 3 attempts.`);
                    // TODO: In production, send notification to user here
                } else {
                    console.log(`🔄 [${formatTime(now)}] "${job.name}" will retry on next scheduler run.`);
                }
            }

            await db.write();
        }
    } catch (error) {
        console.error(`💥 [${formatTime(new Date())}] Scheduler error:`, error.message);
    } finally {
        isProcessing = false;
    }
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
    console.log('\n👋 Received SIGTERM. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n👋 Received SIGINT. Shutting down gracefully...');
    process.exit(0);
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 Chronos Job Scheduler`);
    console.log(`   Server: http://localhost:${PORT}`);
    console.log(`   API Key: ${API_KEY}`);
    console.log(`   Database: ${file}`);
    console.log(`\n📖 Endpoints:`);
    console.log(`   GET  /test              - Health check`);
    console.log(`   GET  /jobs              - List all jobs`);
    console.log(`   POST /jobs              - Create a job`);
    console.log(`   GET  /jobs/:id          - Get a job`);
    console.log(`   DELETE /jobs/:id        - Cancel a job`);
    console.log(`   PATCH /jobs/:id/reschedule - Reschedule a job`);
    console.log(`   GET  /stats             - Job statistics`);
    console.log(`\n⏰ Scheduler running every 10 seconds...\n`);
});
