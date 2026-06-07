# Chronos — Job Scheduler System

A reliable backend for scheduling, executing, and monitoring one-time and recurring jobs. Built with **Node.js**, **Express 5**, **lowdb**, and **node-cron**.

---

## Quick Start

```bash
npm install
npm start
```

Server runs at `http://localhost:3000`.  
All `/jobs` routes require the header: `x-api-key: chronos-secret-key`

To use a custom API key or port:
```bash
API_KEY=my-secret PORT=4000 node server.js
```

---

## API Reference

### Authentication
Every request to `/jobs` must include:
```
x-api-key: chronos-secret-key
```

---

### Health Check
**GET** `/test`  
No auth required.
```json
{ "message": "Chronos Server is Alive and Running!" }
```

---

### Submit a Job
**POST** `/jobs`

**One-time job** (runs once at a specific time):
```json
{
  "name": "Send Invoice Email",
  "executionTime": "2026-06-01T09:00:00Z"
}
```

**Recurring job** (runs on a cron schedule):
```json
{
  "name": "Daily Backup",
  "cronExpression": "0 2 * * *"
}
```

**Response** `201`:
```json
{
  "message": "Job submitted successfully!",
  "job": {
    "id": "uuid-here",
    "name": "Daily Backup",
    "type": "recurring",
    "cronExpression": "0 2 * * *",
    "status": "scheduled",
    "retryCount": 0,
    "createdAt": "2026-05-28T10:00:00.000Z"
  }
}
```

---

### List All Jobs
**GET** `/jobs`

Optional filter: `GET /jobs?status=scheduled`  
Possible status values: `scheduled`, `completed`, `failed`, `cancelled`

---

### Get a Single Job
**GET** `/jobs/:id`

---

### Cancel a Job
**DELETE** `/jobs/:id`  
Only works on jobs with status `scheduled`.

---

### Reschedule a Job
**PATCH** `/jobs/:id/reschedule`

Resets `retryCount` to 0 and sets status back to `scheduled`.

```json
{ "executionTime": "2026-07-01T08:00:00Z" }
```
or for a recurring job:
```json
{ "cronExpression": "0 10 * * 1" }
```

---

## Job Lifecycle

```
submitted → scheduled → [worker picks it up] → completed
                                             ↘ failed (after 3 retries)
                    ↑ reschedule                  ↓
                 cancelled ←── DELETE /jobs/:id
```

- The background worker runs **every 10 seconds**.
- Failed jobs are retried up to **3 times** automatically.
- Recurring jobs stay in `scheduled` state and re-run each cycle.

---

## Cron Expression Examples

| Expression     | Meaning                  |
|----------------|--------------------------|
| `*/1 * * * *`  | Every minute             |
| `0 9 * * *`    | Every day at 9am         |
| `0 9 * * 1`    | Every Monday at 9am      |
| `0 0 1 * *`    | First day of every month |

---

## Design Decisions

- **lowdb** was chosen for simplicity and zero-setup (file-based JSON). In production, this would be replaced with **PostgreSQL** or **Redis** for durability and concurrent access.
- **node-cron** handles the recurring schedule matching. The worker polls every 10 seconds to keep the scheduler responsive without overloading.
- **API key auth** is simple middleware. In production, this would be replaced with JWT tokens.
- **Retry logic** is capped at 3 attempts. After that, the job is marked `failed` — in production, a notification (email/webhook) would be sent to the user.

---

## Deliverables Checklist

- [x] Job submission (one-time + recurring)
- [x] Job management APIs (view, cancel, reschedule)
- [x] Failure handling with automatic retries (max 3)
- [x] Logging to console on every job event
- [x] Authentication via API key
- [x] RESTful API design
- [x] File-based database (lowdb / db.json)


Airtribe submission branch
