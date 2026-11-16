# TeachConnect

A job portal that connects teachers with schools. One backend, one client codebase that ships as
the **website**, the **Android app** and the **iOS app**.

Four account types: **Teacher**, **School**, **Work Agency**, **College**.

## What it does

| Area | Behaviour |
|---|---|
| Teacher profile | Name, father's/mother's name, mobile, email, address with GPS pin, qualifications, work experience (place + duration), subjects, additional information |
| School / Agency / College profile | Name, address, mobile, website, email; board (school) or university (college) with affiliation no. |
| Agencies and colleges | Add and manage teachers using the same profile form, see each teacher's eligible vacancies, apply on their behalf |
| Vacancies | Schools post title, subject, qualification and experience requirements, salary, time schedule, perks |
| Matching | A teacher is eligible when their highest education level, teaching qualification, total experience and subjects meet the vacancy's requirements (`server/src/matching.js`) |
| Updates | Every eligible teacher (or their agency/college) gets the new vacancy in Updates; also application status, interviews, reminders |
| Dashboard | Teachers see the vacancies they are eligible for, and upcoming interviews |
| Search | Keyword, subject, city/area, minimum salary, "only eligible" filter, distance from the teacher's GPS pin |
| Apply / interview | Teachers apply; schools view full applicant profiles, shortlist, select, reject, schedule or reschedule interviews |
| 30-day check | 30 days after listing the school is asked "still available?" (Updates + email). No answer within 5 days moves it to **Outdated**; the school can re-list it (`server/src/lifecycle.js`) |

## Run it

Requires Node.js 22.5 or newer.

```bash
cd server && npm install && npm run seed && npm start
```

```bash
cd client && npm install && npm run dev
```

Open http://localhost:5173. Demo logins (password `password123`): `teacher@demo.com`, `school@demo.com`,
`agency@demo.com`, `college@demo.com`.

Tests: `cd server && npm test`.

## Deploy the website

`cd client && npm run build`, then run the server: it serves `client/dist` and the API from one port.

Server environment variables:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Required in production (`NODE_ENV=production`) |
| `PORT` | Default 4000 |
| `DB_PATH` | SQLite file, default `server/data/teachconnect.db` |
| `SMTP_URL`, `MAIL_FROM` | Enables email for reminders and interview invitations; without it mail is only logged |
| `REMINDER_AFTER_DAYS`, `REMINDER_GRACE_DAYS` | Default 30 and 5 |

### Netlify (demo hosting)

The repo is ready for Netlify: `netlify.toml` builds the website and `netlify/functions/api.mjs` runs
the API as a function. Import the repo in Netlify and it deploys on every push; no settings or
environment variables are needed. The database file is kept in Netlify Blobs and starts with the demo
accounts above (`server/src/serverless.js`). This is fine for trying the portal out, but simultaneous
writes can overwrite each other, so use a host with a persistent disk for real traffic.

## Build the mobile apps

The native projects are in `client/android` and `client/ios` (Capacitor). They load the same client,
so they need the address of your deployed server:

```bash
cd client && echo "VITE_API_URL=https://your-server.example.com" > .env && npm run sync
```

Then `npm run android` (opens Android Studio) or `npm run ios` (opens Xcode, macOS only) to run on a
device and produce the store builds. Set your own app ID in `capacitor.config.json` before publishing.
