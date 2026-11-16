process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const { app } = await import('../src/app.js');
const { runVacancyLifecycle } = await import('../src/lifecycle.js');
const { experienceYears } = await import('../src/matching.js');

let server, base;
before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}/api`; r(); }); }));
after(() => server.close());

async function call(method, path, token, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}
const register = async (role, email, name) =>
  (await call('POST', '/auth/register', null, { role, email, name, password: 'password123' })).body.token;

const mathsTeacher = {
  name: 'Asha Verma', father_name: 'R. Verma', mother_name: 'S. Verma', mobile: '9876543210',
  email: 'asha@example.com', address: 'Indore', lat: 22.72, lng: 75.86,
  qualifications: [{ level: 3, degree: 'B.Sc Mathematics', institution: 'DAVV', year: '2016' }],
  experience: [{ place: 'Sunrise School', role: 'TGT', from: '2018-04', to: '2022-03' }],
  subjects: ['Mathematics'], teaching_quals: ['B.Ed'], additional_info: 'Olympiad coach',
};
const vacancy = {
  title: 'TGT Mathematics', subject: 'Mathematics', min_level: 3, teaching_qual: 'B.Ed',
  min_exp_years: 2, salary_min: 30000, salary_max: 40000, schedule: 'Mon-Sat, 8am-2pm', perks: 'PF, transport',
};

let school, teacher, fresher, agency, vacancyId, applicationId;

test('experience is summed across jobs', () => {
  assert.equal(experienceYears([{ from: '2018-04', to: '2022-03' }, { from: '2023-01', to: '2023-06' }]), 4.5);
});

test('registration, login and profiles', async () => {
  school = await register('school', 'school@example.com', 'Green Valley School');
  teacher = await register('teacher', 'asha@example.com', 'Asha Verma');
  fresher = await register('teacher', 'new@example.com', 'New Teacher');
  agency = await register('agency', 'agency@example.com', 'EduStaff');
  assert.ok(school && teacher && fresher && agency);

  assert.equal((await call('POST', '/auth/register', null, { role: 'school', email: 'school@example.com', name: 'x', password: 'password123' })).status, 409);
  assert.equal((await call('POST', '/auth/login', null, { email: 'asha@example.com', password: 'wrong' })).status, 401);
  assert.equal((await call('POST', '/auth/login', null, { email: 'asha@example.com', password: 'password123' })).status, 200);
  assert.equal((await call('GET', '/me')).status, 401);

  const saved = await call('PUT', '/profile', teacher, mathsTeacher);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.max_level, 3);
  assert.equal(saved.body.exp_years, 4);
  assert.equal(saved.body.lat, 22.72);

  // A school must complete its profile before posting.
  assert.equal((await call('POST', '/vacancies', school, vacancy)).status, 400);
  const org = await call('PUT', '/profile', school, {
    name: 'Green Valley School', address: 'Vijay Nagar, Indore', mobile: '0731-2550000', website: 'https://gvs.example',
    email: 'office@gvs.example', affiliation_body: 'CBSE', affiliation_no: '1030123', lat: 22.75, lng: 75.89,
  });
  assert.equal(org.body.affiliation_body, 'CBSE');
});

test('agency adds a teacher and cannot see teachers of others', async () => {
  const added = await call('POST', '/teachers', agency, { ...mathsTeacher, name: 'Ravi Kumar', email: 'ravi@example.com' });
  assert.equal(added.status, 201);
  assert.equal((await call('GET', '/teachers', agency)).body.length, 1);
  assert.equal((await call('GET', '/teachers', teacher)).status, 403);
  const college = await register('college', 'college@example.com', 'City College');
  assert.equal((await call('GET', `/teachers/${added.body.id}`, college)).status, 404);
});

test('a new vacancy reaches only eligible teachers', async () => {
  const posted = await call('POST', '/vacancies', school, vacancy);
  assert.equal(posted.status, 201);
  vacancyId = posted.body.id;

  const updates = (await call('GET', '/notifications', teacher)).body;
  assert.equal(updates.length, 1);
  assert.equal(updates[0].type, 'new_vacancy');
  assert.equal((await call('GET', '/notifications', fresher)).body.length, 0);
  assert.match((await call('GET', '/notifications', agency)).body[0].title, /Ravi Kumar/);

  const eligible = (await call('GET', '/vacancies?eligible=1', teacher)).body;
  assert.equal(eligible.length, 1);
  assert.ok(eligible[0].distance_km > 0);
  assert.equal((await call('GET', '/vacancies?eligible=1', fresher)).body.length, 0);

  // Search still shows it to everyone, with the reasons it does not match.
  const found = (await call('GET', '/vacancies?q=mathematics&location=indore&min_salary=35000', fresher)).body;
  assert.equal(found.length, 1);
  assert.equal(found[0].eligible, false);
  assert.ok(found[0].missing.length >= 3);
  assert.equal((await call('GET', '/vacancies?q=chemistry', fresher)).body.length, 0);
  assert.equal((await call('GET', '/vacancies', school)).status, 403);
});

test('apply, review and schedule an interview', async () => {
  const applied = await call('POST', `/vacancies/${vacancyId}/apply`, teacher, { note: 'Available immediately' });
  assert.equal(applied.status, 201);
  applicationId = applied.body.id;
  assert.equal((await call('POST', `/vacancies/${vacancyId}/apply`, teacher, {})).status, 409);

  const ravi = (await call('GET', '/teachers', agency)).body[0];
  assert.equal(ravi.eligible_count, 1);
  assert.equal((await call('POST', `/vacancies/${vacancyId}/apply`, agency, { teacher_id: ravi.id })).status, 201);

  const applicants = (await call('GET', `/vacancies/${vacancyId}/applications`, school)).body;
  assert.equal(applicants.length, 2);
  assert.equal(applicants.find((a) => a.teacher.name === 'Ravi Kumar').via.name, 'EduStaff');
  assert.equal(applicants.find((a) => a.id === applicationId).teacher.father_name, 'R. Verma');

  // Only the owning school can act on an application.
  const other = await register('school', 'other@example.com', 'Other School');
  assert.equal((await call('GET', `/vacancies/${vacancyId}/applications`, other)).status, 404);
  assert.equal((await call('PUT', `/applications/${applicationId}/status`, other, { status: 'hired' })).status, 404);
  assert.equal((await call('PUT', `/applications/${applicationId}/status`, teacher, { status: 'hired' })).status, 403);

  assert.equal((await call('PUT', `/applications/${applicationId}/interview`, school, { scheduled_at: '2020-01-01T10:00' })).status, 400);
  const when = new Date(Date.now() + 3 * 86400000).toISOString();
  const interview = await call('PUT', `/applications/${applicationId}/interview`, school,
    { scheduled_at: when, mode: 'In person', location: 'School office', notes: 'Bring originals' });
  assert.equal(interview.body.status, 'interview_scheduled');

  const mine = (await call('GET', '/applications', teacher)).body;
  assert.equal(mine[0].interview_at, when);
  assert.equal(mine[0].interview_location, 'School office');
  assert.equal((await call('GET', '/notifications', teacher)).body[0].type, 'interview');
  assert.equal((await call('GET', '/me', teacher)).body.unread, 2);
});

test('30-day reminder, then outdated after 5 more days', async () => {
  const day = 86400000;
  const status = async () => (await call('GET', `/vacancies/${vacancyId}`, school)).body.status;

  assert.deepEqual(runVacancyLifecycle(new Date(Date.now() + 29 * day)), { reminded: 0, outdated: 0 });
  assert.equal(await status(), 'active');

  assert.equal(runVacancyLifecycle(new Date(Date.now() + 31 * day)).reminded, 1);
  assert.equal(await status(), 'pending_verification');
  assert.equal((await call('GET', '/notifications', school)).body[0].type, 'vacancy_reminder');
  // Still listed while waiting for the school's answer.
  assert.equal((await call('GET', '/vacancies', fresher)).body.length, 1);

  // Answering the reminder keeps it alive and restarts the clock.
  assert.equal((await call('POST', `/vacancies/${vacancyId}/verify`, school)).body.status, 'active');
  assert.deepEqual(runVacancyLifecycle(new Date(Date.now() + 29 * day)), { reminded: 0, outdated: 0 });

  // No answer this time.
  runVacancyLifecycle(new Date(Date.now() + 31 * day));
  assert.equal(runVacancyLifecycle(new Date(Date.now() + 34 * day)).outdated, 0);
  assert.equal(runVacancyLifecycle(new Date(Date.now() + 37 * day)).outdated, 1);
  assert.equal(await status(), 'outdated');
  assert.equal((await call('GET', '/vacancies', fresher)).body.length, 0);
  assert.equal((await call('POST', `/vacancies/${vacancyId}/apply`, fresher, {})).status, 404);

  // Re-listing brings it back.
  assert.equal((await call('POST', `/vacancies/${vacancyId}/verify`, school)).body.status, 'active');
  assert.equal((await call('GET', '/vacancies', fresher)).body.length, 1);
});
