import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const path = process.env.DB_PATH || new URL('../data/teachconnect.db', import.meta.url).pathname;
if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

// DB_JOURNAL_MODE=DELETE keeps everything in one file (used by the serverless deployment).
const journal = process.env.DB_JOURNAL_MODE === 'DELETE' ? 'DELETE' : 'WAL';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('teacher','school','agency','college')),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Profile for schools, agencies and colleges.
CREATE TABLE IF NOT EXISTS orgs (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  lat REAL, lng REAL,
  mobile TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  affiliation_body TEXT NOT NULL DEFAULT '',  -- board (school) or university (college)
  affiliation_no TEXT NOT NULL DEFAULT ''
);

-- A teacher either owns the profile (user_id) or is managed by an agency/college (managed_by).
CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  managed_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  father_name TEXT NOT NULL DEFAULT '',
  mother_name TEXT NOT NULL DEFAULT '',
  mobile TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  lat REAL, lng REAL,
  qualifications TEXT NOT NULL DEFAULT '[]',  -- [{level, degree, institution, year}]
  experience TEXT NOT NULL DEFAULT '[]',      -- [{place, role, from, to}]  (YYYY-MM, to='' = present)
  subjects TEXT NOT NULL DEFAULT '[]',
  teaching_quals TEXT NOT NULL DEFAULT '[]',
  additional_info TEXT NOT NULL DEFAULT '',
  max_level INTEGER NOT NULL DEFAULT 0,       -- derived from qualifications
  exp_years REAL NOT NULL DEFAULT 0,          -- derived from experience
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS teachers_managed_by ON teachers(managed_by);

CREATE TABLE IF NOT EXISTS vacancies (
  id INTEGER PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  min_level INTEGER NOT NULL DEFAULT 0,
  teaching_qual TEXT NOT NULL DEFAULT '',
  qualifications_note TEXT NOT NULL DEFAULT '',
  min_exp_years REAL NOT NULL DEFAULT 0,
  experience_note TEXT NOT NULL DEFAULT '',
  salary_min INTEGER, salary_max INTEGER,
  schedule TEXT NOT NULL DEFAULT '',
  perks TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','pending_verification','outdated','closed')),
  created_at TEXT NOT NULL,
  verified_at TEXT NOT NULL,   -- listing date, or the last time the school confirmed it is open
  reminder_at TEXT             -- when the "still available?" reminder was sent
);
CREATE INDEX IF NOT EXISTS vacancies_status ON vacancies(status, verified_at);
CREATE INDEX IF NOT EXISTS vacancies_school ON vacancies(school_id);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY,
  vacancy_id INTEGER NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  applied_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'applied',
  interview_at TEXT,
  interview_mode TEXT NOT NULL DEFAULT '',
  interview_location TEXT NOT NULL DEFAULT '',
  interview_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (vacancy_id, teacher_id)
);

-- The "Updates" feed.
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  vacancy_id INTEGER REFERENCES vacancies(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, id DESC);
`;

export let db;
export function openDb() {
  db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode = ${journal}; PRAGMA foreign_keys = ON;`);
  db.exec(SCHEMA);
}
export const closeDb = () => db.close();
openDb();

export const now = () => new Date().toISOString();
export const get = (sql, ...params) => db.prepare(sql).get(...params);
export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);

export function notify(userId, { type, title, body = '', vacancyId = null, teacherId = null }) {
  run(
    'INSERT INTO notifications (user_id, type, title, body, vacancy_id, teacher_id, created_at) VALUES (?,?,?,?,?,?,?)',
    userId, type, title, body, vacancyId, teacherId, now()
  );
}
