import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, get, all, run, now, notify } from './db.js';
import { hashPassword, verifyPassword, signToken, requireAuth, requireRole, rateLimit } from './auth.js';
import { eligibility, experienceYears, distanceKm } from './matching.js';
import { sendMail } from './mailer.js';
import {
  ROLES, ORG_ROLES, LEVELS, TEACHING_QUALS, SUBJECTS, APPLICATION_STATUSES, INTERVIEW_MODES,
} from './constants.js';

export const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '200kb' }));

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };

// ---------- input helpers ----------
const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^\+?[\d\s-]{7,16}$/;

function coords(body) {
  const lat = num(body.lat), lng = num(body.lng);
  if (lat == null || lng == null) return { lat: null, lng: null };
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) fail(400, 'Invalid GPS location.');
  return { lat, lng };
}

function checkContact(mobile, email) {
  if (mobile && !MOBILE_RE.test(mobile)) fail(400, 'Please enter a valid mobile number.');
  if (email && !EMAIL_RE.test(email)) fail(400, 'Please enter a valid email ID.');
}

function teacherInput(body) {
  const name = str(body.name, 120);
  if (!name) fail(400, 'Name is required.');
  const mobile = str(body.mobile, 20), email = str(body.email, 200).toLowerCase();
  checkContact(mobile, email);
  const list = (v) => (Array.isArray(v) ? v.slice(0, 30) : []);
  const qualifications = list(body.qualifications)
    .map((q) => ({
      level: LEVELS.some((l) => l.id === Number(q?.level)) ? Number(q.level) : 0,
      degree: str(q?.degree, 120), institution: str(q?.institution, 200), year: str(String(q?.year ?? ''), 4),
    }))
    .filter((q) => q.level && q.degree);
  const month = (v) => (/^\d{4}-\d{2}$/.test(v) ? v : '');
  const experience = list(body.experience)
    .map((e) => ({ place: str(e?.place, 200), role: str(e?.role, 120), from: month(e?.from), to: month(e?.to) }))
    .filter((e) => e.place && e.from);
  const subjects = [...new Set(list(body.subjects).map((s) => str(s, 60)).filter(Boolean))];
  const teaching_quals = list(body.teaching_quals).filter((q) => TEACHING_QUALS.includes(q));
  return {
    name, father_name: str(body.father_name, 120), mother_name: str(body.mother_name, 120),
    mobile, email, address: str(body.address, 500), ...coords(body),
    qualifications: JSON.stringify(qualifications), experience: JSON.stringify(experience),
    subjects: JSON.stringify(subjects), teaching_quals: JSON.stringify(teaching_quals),
    additional_info: str(body.additional_info, 4000),
    max_level: Math.max(0, ...qualifications.map((q) => q.level)),
    exp_years: experienceYears(experience),
  };
}

const TEACHER_COLS = ['name', 'father_name', 'mother_name', 'mobile', 'email', 'address', 'lat', 'lng',
  'qualifications', 'experience', 'subjects', 'teaching_quals', 'additional_info', 'max_level', 'exp_years'];

function saveTeacher(id, data) {
  run(`UPDATE teachers SET ${TEACHER_COLS.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
    ...TEACHER_COLS.map((c) => data[c]), now(), id);
}

function parseTeacher(t) {
  if (!t) return null;
  for (const k of ['qualifications', 'experience', 'subjects', 'teaching_quals']) t[k] = JSON.parse(t[k]);
  return t;
}

function vacancyInput(body) {
  const title = str(body.title, 150);
  if (!title) fail(400, 'A title for the vacancy is required.');
  const min_level = num(body.min_level) ?? 0;
  if (min_level !== 0 && !LEVELS.some((l) => l.id === min_level)) fail(400, 'Invalid education level.');
  const teaching_qual = str(body.teaching_qual, 40);
  if (teaching_qual && !TEACHING_QUALS.includes(teaching_qual)) fail(400, 'Invalid teaching qualification.');
  const salary_min = num(body.salary_min), salary_max = num(body.salary_max);
  if ((salary_min ?? 0) < 0 || (salary_max ?? 0) < 0) fail(400, 'Salary cannot be negative.');
  if (salary_min != null && salary_max != null && salary_max < salary_min) {
    fail(400, 'Maximum salary cannot be lower than minimum salary.');
  }
  const min_exp_years = Math.max(0, num(body.min_exp_years) ?? 0);
  return {
    title, subject: str(body.subject, 60), description: str(body.description, 4000),
    min_level, teaching_qual, qualifications_note: str(body.qualifications_note, 1000),
    min_exp_years, experience_note: str(body.experience_note, 1000),
    salary_min, salary_max, schedule: str(body.schedule, 500), perks: str(body.perks, 2000),
  };
}
const VACANCY_COLS = ['title', 'subject', 'description', 'min_level', 'teaching_qual', 'qualifications_note',
  'min_exp_years', 'experience_note', 'salary_min', 'salary_max', 'schedule', 'perks'];

// ---------- lookups ----------
const VACANCY_SELECT = `
  SELECT v.*, o.name AS school_name, o.address AS school_address, o.affiliation_body AS school_board,
         o.website AS school_website, o.lat AS school_lat, o.lng AS school_lng
  FROM vacancies v JOIN orgs o ON o.user_id = v.school_id`;
const OPEN = "v.status IN ('active','pending_verification')";

// Teachers the current user may act for: themselves, or the ones they manage.
function myTeachers(user) {
  if (user.role === 'teacher') return all('SELECT * FROM teachers WHERE user_id = ?', user.id).map(parseTeacher);
  if (user.role === 'agency' || user.role === 'college') {
    return all('SELECT * FROM teachers WHERE managed_by = ? ORDER BY name', user.id).map(parseTeacher);
  }
  return [];
}

function teacherFor(user, teacherId) {
  const mine = myTeachers(user);
  const t = user.role === 'teacher' ? mine[0] : mine.find((x) => x.id === Number(teacherId));
  if (!t) fail(user.role === 'teacher' ? 400 : 404, user.role === 'teacher' ? 'Please complete your profile first.' : 'Teacher not found.');
  return t;
}

const teacherOwner = (t) => t.user_id ?? t.managed_by;

function ownVacancy(user, id) {
  const v = get('SELECT * FROM vacancies WHERE id = ?', id);
  if (!v || v.school_id !== user.id) fail(404, 'Vacancy not found.');
  return v;
}

function decorate(v, teacher) {
  const out = { ...v };
  if (teacher) {
    Object.assign(out, eligibility(teacher, v));
    out.distance_km = distanceKm(teacher, { lat: v.school_lat, lng: v.school_lng });
  }
  return out;
}

const wrap = (fn) => (req, res, next) => { try { fn(req, res); } catch (e) { next(e); } };
const api = express.Router();

// ---------- public ----------
api.get('/meta', (req, res) => res.json({
  levels: LEVELS, teachingQuals: TEACHING_QUALS, subjects: SUBJECTS,
  applicationStatuses: APPLICATION_STATUSES, interviewModes: INTERVIEW_MODES,
}));

api.post('/auth/register', rateLimit(20, 15 * 60 * 1000), wrap((req, res) => {
  const role = str(req.body.role, 20), email = str(req.body.email, 200).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const name = str(req.body.name, 120);
  if (!ROLES.includes(role)) fail(400, 'Please choose an account type.');
  if (!EMAIL_RE.test(email)) fail(400, 'Please enter a valid email ID.');
  if (password.length < 8) fail(400, 'Password must be at least 8 characters.');
  if (!name) fail(400, 'Name is required.');
  if (get('SELECT 1 FROM users WHERE email = ?', email)) fail(409, 'An account with this email already exists.');

  db.exec('BEGIN');
  try {
    const { lastInsertRowid: id } = run(
      'INSERT INTO users (role, email, password_hash, created_at) VALUES (?,?,?,?)', role, email, hashPassword(password), now());
    if (role === 'teacher') {
      run('INSERT INTO teachers (user_id, name, email, created_at, updated_at) VALUES (?,?,?,?,?)', id, name, email, now(), now());
    } else {
      run('INSERT INTO orgs (user_id, name, email) VALUES (?,?,?)', id, name, email);
    }
    db.exec('COMMIT');
    res.status(201).json({ token: signToken({ id: Number(id), role }) });
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}));

api.post('/auth/login', rateLimit(20, 15 * 60 * 1000), wrap((req, res) => {
  const user = get('SELECT * FROM users WHERE email = ?', str(req.body.email, 200).toLowerCase());
  if (!user || typeof req.body.password !== 'string' || !verifyPassword(req.body.password, user.password_hash)) {
    fail(401, 'Incorrect email or password.');
  }
  res.json({ token: signToken(user) });
}));

// ---------- everything below needs a login ----------
api.use(requireAuth);

api.get('/me', wrap((req, res) => {
  const { user } = req;
  const profile = user.role === 'teacher'
    ? parseTeacher(get('SELECT * FROM teachers WHERE user_id = ?', user.id))
    : get('SELECT * FROM orgs WHERE user_id = ?', user.id);
  const unread = get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', user.id).n;
  res.json({ user, profile, unread });
}));

api.put('/profile', wrap((req, res) => {
  const { user } = req;
  if (user.role === 'teacher') {
    const t = get('SELECT id FROM teachers WHERE user_id = ?', user.id);
    saveTeacher(t.id, teacherInput(req.body));
    return res.json(parseTeacher(get('SELECT * FROM teachers WHERE id = ?', t.id)));
  }
  const name = str(req.body.name, 200);
  if (!name) fail(400, 'Name is required.');
  const mobile = str(req.body.mobile, 20), email = str(req.body.email, 200).toLowerCase();
  checkContact(mobile, email);
  const { lat, lng } = coords(req.body);
  const hasAffiliation = user.role !== 'agency';
  run(`UPDATE orgs SET name=?, address=?, lat=?, lng=?, mobile=?, website=?, email=?, affiliation_body=?, affiliation_no=? WHERE user_id=?`,
    name, str(req.body.address, 500), lat, lng, mobile, str(req.body.website, 200), email,
    hasAffiliation ? str(req.body.affiliation_body, 200) : '', hasAffiliation ? str(req.body.affiliation_no, 100) : '', user.id);
  res.json(get('SELECT * FROM orgs WHERE user_id = ?', user.id));
}));

// ---------- teachers managed by an agency or college ----------
const manager = requireRole('agency', 'college');

api.get('/teachers', manager, wrap((req, res) => {
  const openVacancies = all(`${VACANCY_SELECT} WHERE ${OPEN}`);
  res.json(myTeachers(req.user).map((t) => ({
    ...t,
    eligible_count: openVacancies.filter((v) => eligibility(t, v).eligible).length,
    application_count: get('SELECT COUNT(*) AS n FROM applications WHERE teacher_id = ?', t.id).n,
  })));
}));

api.post('/teachers', manager, wrap((req, res) => {
  const data = teacherInput(req.body);
  const { lastInsertRowid: id } = run(
    'INSERT INTO teachers (managed_by, created_at, updated_at) VALUES (?,?,?)', req.user.id, now(), now());
  saveTeacher(id, data);
  res.status(201).json(parseTeacher(get('SELECT * FROM teachers WHERE id = ?', id)));
}));

api.get('/teachers/:id', manager, wrap((req, res) => res.json(teacherFor(req.user, req.params.id))));

api.put('/teachers/:id', manager, wrap((req, res) => {
  const t = teacherFor(req.user, req.params.id);
  saveTeacher(t.id, teacherInput(req.body));
  res.json(parseTeacher(get('SELECT * FROM teachers WHERE id = ?', t.id)));
}));

api.delete('/teachers/:id', manager, wrap((req, res) => {
  const t = teacherFor(req.user, req.params.id);
  run('DELETE FROM teachers WHERE id = ?', t.id);
  res.json({ ok: true });
}));

// ---------- vacancies: job seekers' side ----------
const seeker = requireRole('teacher', 'agency', 'college');

// Search. Optional teacher_id (agency/college) adds eligibility + distance for that teacher.
api.get('/vacancies', seeker, wrap((req, res) => {
  const { user } = req;
  const where = [OPEN], params = [];
  const like = (v) => `%${v.replace(/[%_]/g, '')}%`;
  const q = str(req.query.q, 100), subject = str(req.query.subject, 60), location = str(req.query.location, 100);
  if (q) {
    where.push('(v.title LIKE ? OR v.subject LIKE ? OR v.description LIKE ? OR o.name LIKE ? OR o.address LIKE ?)');
    params.push(...Array(5).fill(like(q)));
  }
  if (subject) { where.push('v.subject LIKE ?'); params.push(like(subject)); }
  if (location) { where.push('o.address LIKE ?'); params.push(like(location)); }
  const minSalary = num(req.query.min_salary);
  if (minSalary != null) { where.push('COALESCE(v.salary_max, v.salary_min) >= ?'); params.push(minSalary); }

  const teacher = user.role === 'teacher' ? myTeachers(user)[0]
    : req.query.teacher_id ? teacherFor(user, req.query.teacher_id) : null;
  let rows = all(`${VACANCY_SELECT} WHERE ${where.join(' AND ')} ORDER BY v.created_at DESC LIMIT 300`, ...params)
    .map((v) => decorate(v, teacher));
  if (req.query.eligible === '1' && teacher) rows = rows.filter((v) => v.eligible);
  if (teacher) {
    const applied = new Set(all('SELECT vacancy_id FROM applications WHERE teacher_id = ?', teacher.id).map((a) => a.vacancy_id));
    rows.forEach((v) => { v.applied = applied.has(v.id); });
  }
  res.json(rows);
}));

api.get('/vacancies/mine', requireRole('school'), wrap((req, res) => {
  res.json(all(`
    SELECT v.*, (SELECT COUNT(*) FROM applications a WHERE a.vacancy_id = v.id) AS application_count
    FROM vacancies v WHERE v.school_id = ? ORDER BY v.created_at DESC`, req.user.id));
}));

api.get('/vacancies/:id', wrap((req, res) => {
  const { user } = req;
  const v = get(`${VACANCY_SELECT} WHERE v.id = ?`, req.params.id);
  if (!v) fail(404, 'Vacancy not found.');
  if (user.role === 'school') {
    if (v.school_id !== user.id) fail(404, 'Vacancy not found.');
    return res.json(v);
  }
  const mine = myTeachers(user);
  if (user.role === 'teacher') {
    const out = decorate(v, mine[0]);
    out.application = get('SELECT * FROM applications WHERE vacancy_id = ? AND teacher_id = ?', v.id, mine[0].id) ?? null;
    return res.json(out);
  }
  // Agency / college: eligibility for each of their teachers.
  const applied = new Map(all('SELECT teacher_id, status FROM applications WHERE vacancy_id = ?', v.id).map((a) => [a.teacher_id, a.status]));
  res.json({
    ...v,
    teachers: mine.map((t) => ({ id: t.id, name: t.name, ...eligibility(t, v), application_status: applied.get(t.id) ?? null })),
  });
}));

// ---------- vacancies: school's side ----------
const school = requireRole('school');

api.post('/vacancies', school, wrap((req, res) => {
  const org = get('SELECT * FROM orgs WHERE user_id = ?', req.user.id);
  if (!org.address || !org.mobile) fail(400, 'Please complete your school profile (address and mobile number) before posting a vacancy.');
  const data = vacancyInput(req.body);
  const t = now();
  const { lastInsertRowid: id } = run(
    `INSERT INTO vacancies (school_id, ${VACANCY_COLS.join(', ')}, created_at, verified_at) VALUES (?, ${VACANCY_COLS.map(() => '?').join(', ')}, ?, ?)`,
    req.user.id, ...VACANCY_COLS.map((c) => data[c]), t, t);
  const vacancy = get('SELECT * FROM vacancies WHERE id = ?', id);
  announce(vacancy, org);
  res.status(201).json(vacancy);
}));

// Put the new vacancy in the Updates section of every eligible teacher
// (or of the agency/college that manages them).
function announce(vacancy, org) {
  for (const t of all('SELECT * FROM teachers').map(parseTeacher)) {
    if (!eligibility(t, vacancy).eligible) continue;
    const managed = t.user_id == null;
    notify(teacherOwner(t), {
      type: 'new_vacancy',
      title: managed ? `New vacancy for ${t.name}: ${vacancy.title}` : `New vacancy you are eligible for: ${vacancy.title}`,
      body: `${org.name}${org.address ? ' · ' + org.address : ''}`,
      vacancyId: vacancy.id,
      teacherId: managed ? t.id : null,
    });
  }
}

api.put('/vacancies/:id', school, wrap((req, res) => {
  const v = ownVacancy(req.user, req.params.id);
  const data = vacancyInput(req.body);
  run(`UPDATE vacancies SET ${VACANCY_COLS.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, ...VACANCY_COLS.map((c) => data[c]), v.id);
  res.json(get('SELECT * FROM vacancies WHERE id = ?', v.id));
}));

// "Yes, still available" (answers the reminder) and "re-list" (from outdated/closed) both
// make the vacancy active again and restart the 30-day clock.
api.post('/vacancies/:id/verify', school, wrap((req, res) => {
  const v = ownVacancy(req.user, req.params.id);
  run("UPDATE vacancies SET status = 'active', verified_at = ?, reminder_at = NULL WHERE id = ?", now(), v.id);
  res.json(get('SELECT * FROM vacancies WHERE id = ?', v.id));
}));

api.post('/vacancies/:id/close', school, wrap((req, res) => {
  const v = ownVacancy(req.user, req.params.id);
  run("UPDATE vacancies SET status = 'closed', reminder_at = NULL WHERE id = ?", v.id);
  res.json(get('SELECT * FROM vacancies WHERE id = ?', v.id));
}));

api.get('/vacancies/:id/applications', school, wrap((req, res) => {
  const v = ownVacancy(req.user, req.params.id);
  const rows = all('SELECT * FROM applications WHERE vacancy_id = ? ORDER BY created_at DESC', v.id);
  res.json(rows.map((a) => {
    const teacher = parseTeacher(get('SELECT * FROM teachers WHERE id = ?', a.teacher_id));
    const via = teacher.managed_by ? get('SELECT name, mobile, email FROM orgs WHERE user_id = ?', teacher.managed_by) : null;
    return { ...a, teacher, via, ...eligibility(teacher, v) };
  }));
}));

// ---------- applications ----------
api.post('/vacancies/:id/apply', seeker, wrap((req, res) => {
  const v = get(`SELECT v.* FROM vacancies v WHERE v.id = ? AND ${OPEN}`, req.params.id);
  if (!v) fail(404, 'This vacancy is no longer open.');
  const t = teacherFor(req.user, req.body.teacher_id);
  if (!t.mobile || !t.qualifications.length) {
    fail(400, 'Please add a mobile number and educational qualifications to the profile before applying.');
  }
  if (get('SELECT 1 FROM applications WHERE vacancy_id = ? AND teacher_id = ?', v.id, t.id)) fail(409, 'Already applied for this vacancy.');
  const { lastInsertRowid: id } = run(
    'INSERT INTO applications (vacancy_id, teacher_id, applied_by, note, created_at) VALUES (?,?,?,?,?)',
    v.id, t.id, req.user.id, str(req.body.note, 2000), now());
  notify(v.school_id, { type: 'new_application', title: `${t.name} applied for "${v.title}"`, vacancyId: v.id });
  res.status(201).json(get('SELECT * FROM applications WHERE id = ?', id));
}));

api.get('/applications', seeker, wrap((req, res) => {
  const ids = myTeachers(req.user).map((t) => t.id);
  if (!ids.length) return res.json([]);
  res.json(all(`
    SELECT a.*, t.name AS teacher_name, v.title, v.subject, v.status AS vacancy_status,
           o.name AS school_name, o.address AS school_address, o.mobile AS school_mobile
    FROM applications a
    JOIN teachers t ON t.id = a.teacher_id
    JOIN vacancies v ON v.id = a.vacancy_id
    JOIN orgs o ON o.user_id = v.school_id
    WHERE a.teacher_id IN (${ids.map(() => '?').join(',')}) ORDER BY a.created_at DESC`, ...ids));
}));

// The application together with what each side is allowed to do with it.
function loadApplication(user, id) {
  const a = get('SELECT * FROM applications WHERE id = ?', id);
  if (!a) fail(404, 'Application not found.');
  const vacancy = get('SELECT * FROM vacancies WHERE id = ?', a.vacancy_id);
  const teacher = get('SELECT * FROM teachers WHERE id = ?', a.teacher_id);
  const isSchool = vacancy.school_id === user.id;
  const isSeeker = teacherOwner(teacher) === user.id;
  if (!isSchool && !isSeeker) fail(404, 'Application not found.');
  return { a, vacancy, teacher, isSchool, isSeeker };
}

api.delete('/applications/:id', wrap((req, res) => {
  const { a, isSeeker } = loadApplication(req.user, req.params.id);
  if (!isSeeker) fail(403, 'Only the applicant can withdraw an application.');
  run('DELETE FROM applications WHERE id = ?', a.id);
  res.json({ ok: true });
}));

const STATUS_TEXT = { applied: 'under review', shortlisted: 'shortlisted', hired: 'selected', rejected: 'not selected' };

api.put('/applications/:id/status', wrap((req, res) => {
  const { a, vacancy, teacher, isSchool } = loadApplication(req.user, req.params.id);
  if (!isSchool) fail(403, 'Only the school can update an application.');
  const status = str(req.body.status, 30);
  if (!STATUS_TEXT[status]) fail(400, 'Invalid status.');
  run("UPDATE applications SET status = ?, interview_at = NULL, interview_mode = '', interview_location = '', interview_notes = '' WHERE id = ?", status, a.id);
  if (status !== a.status) {
    notify(teacherOwner(teacher), {
      type: 'application_status',
      title: `${teacher.user_id ? 'Your application' : teacher.name + "'s application"} for "${vacancy.title}" is ${STATUS_TEXT[status]}`,
      vacancyId: vacancy.id, teacherId: teacher.user_id ? null : teacher.id,
    });
  }
  res.json(get('SELECT * FROM applications WHERE id = ?', a.id));
}));

api.put('/applications/:id/interview', wrap((req, res) => {
  const { a, vacancy, teacher, isSchool } = loadApplication(req.user, req.params.id);
  if (!isSchool) fail(403, 'Only the school can schedule an interview.');
  const when = new Date(req.body.scheduled_at);
  if (Number.isNaN(when.getTime())) fail(400, 'Please choose a date and time for the interview.');
  if (when.getTime() < Date.now()) fail(400, 'The interview time must be in the future.');
  const mode = INTERVIEW_MODES.includes(req.body.mode) ? req.body.mode : INTERVIEW_MODES[0];
  const location = str(req.body.location, 500), notes = str(req.body.notes, 2000);
  run(`UPDATE applications SET status = 'interview_scheduled', interview_at = ?, interview_mode = ?, interview_location = ?, interview_notes = ? WHERE id = ?`,
    when.toISOString(), mode, location, notes, a.id);

  const school = get('SELECT name FROM orgs WHERE user_id = ?', vacancy.school_id);
  const title = `Interview ${a.interview_at ? 'rescheduled' : 'scheduled'}${teacher.user_id ? '' : ' for ' + teacher.name}: ${vacancy.title}`;
  const body = `${school.name} · ${mode}${location ? ' · ' + location : ''}`;
  const owner = teacherOwner(teacher);
  notify(owner, { type: 'interview', title, body, vacancyId: vacancy.id, teacherId: teacher.user_id ? null : teacher.id });
  sendMail(teacher.email || get('SELECT email FROM users WHERE id = ?', owner).email, title,
    `${body}\nWhen: ${when.toUTCString()}\n${notes}`);
  res.json(get('SELECT * FROM applications WHERE id = ?', a.id));
}));

// ---------- updates feed ----------
api.get('/notifications', wrap((req, res) => {
  res.json(all('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100', req.user.id));
}));

api.post('/notifications/read', wrap((req, res) => {
  run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', req.user.id);
  res.json({ ok: true });
}));

app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Serve the built website from the same server when it exists.
const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile('index.html', { root: clientDist }));
}

app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});
