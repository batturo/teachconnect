// Fills an empty database with demo accounts (password for all: password123).
// Usage: npm run seed
import { app } from './app.js';
import { get } from './db.js';

if (get('SELECT 1 FROM users LIMIT 1')) {
  console.log('Database already has data; seed skipped.');
  process.exit(0);
}

const server = app.listen(0);
const base = `http://localhost:${server.address().port}/api`;
async function call(method, path, token, body) {
  const res = await fetch(base + path, {
    method, body: body && JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${data.error}`);
  return data;
}
const register = async (role, email, name) => (await call('POST', '/auth/register', null, { role, email, name, password: 'password123' })).token;

const teacher = await register('teacher', 'teacher@demo.com', 'Asha Verma');
await call('PUT', '/profile', teacher, {
  name: 'Asha Verma', father_name: 'Ramesh Verma', mother_name: 'Sunita Verma', mobile: '98765 43210', email: 'teacher@demo.com',
  address: '14 Scheme No. 54, Vijay Nagar, Indore, Madhya Pradesh 452010', lat: 22.7533, lng: 75.8937,
  qualifications: [
    { level: 3, degree: 'B.Sc Mathematics', institution: 'Devi Ahilya Vishwavidyalaya', year: '2015' },
    { level: 4, degree: 'M.Sc Mathematics', institution: 'Devi Ahilya Vishwavidyalaya', year: '2017' },
  ],
  teaching_quals: ['B.Ed', 'CTET / TET'],
  experience: [{ place: 'Sunrise Public School, Indore', role: 'TGT Mathematics', from: '2018-04', to: '2023-03' }],
  subjects: ['Mathematics', 'Physics'],
  additional_info: 'Maths Olympiad coach. Comfortable teaching in English and Hindi.',
});

const agency = await register('agency', 'agency@demo.com', 'EduStaff Placements');
await call('PUT', '/profile', agency, { name: 'EduStaff Placements', address: 'MG Road, Indore', mobile: '0731 400 1000', website: 'www.edustaff.example', email: 'agency@demo.com' });
await call('POST', '/teachers', agency, {
  name: 'Ravi Kumar', father_name: 'Suresh Kumar', mother_name: 'Meena Kumar', mobile: '91234 56780', email: 'ravi@example.com',
  address: 'Palasia, Indore', lat: 22.7244, lng: 75.8839,
  qualifications: [{ level: 4, degree: 'M.A. English', institution: 'Barkatullah University', year: '2019' }],
  teaching_quals: ['B.Ed'], experience: [{ place: 'Little Flower School', role: 'PRT English', from: '2020-06', to: '' }],
  subjects: ['English', 'Social Science'],
});

const college = await register('college', 'college@demo.com', 'City College of Education');
await call('PUT', '/profile', college, { name: 'City College of Education', address: 'AB Road, Indore', mobile: '0731 255 9000', website: 'www.citycollege.example', email: 'college@demo.com', affiliation_body: 'Devi Ahilya Vishwavidyalaya', affiliation_no: 'DAVV/EDU/2011/118' });
await call('POST', '/teachers', college, {
  name: 'Neha Joshi', mobile: '99887 76655', email: 'neha@example.com', address: 'Rau, Indore',
  qualifications: [{ level: 3, degree: 'B.A.', institution: 'City College of Education', year: '2026' }],
  teaching_quals: ['D.El.Ed / D.Ed'], subjects: ['Primary (all subjects)', 'Hindi'],
});

const school = await register('school', 'school@demo.com', 'Green Valley Public School');
await call('PUT', '/profile', school, {
  name: 'Green Valley Public School', address: 'Bypass Road, Bicholi Mardana, Indore, Madhya Pradesh 452016', lat: 22.7106, lng: 75.9273,
  mobile: '0731 255 0000', website: 'www.greenvalley.example', email: 'school@demo.com', affiliation_body: 'CBSE', affiliation_no: '1030456',
});
await call('POST', '/vacancies', school, {
  title: 'TGT Mathematics', subject: 'Mathematics', min_level: 3, teaching_qual: 'B.Ed', min_exp_years: 2,
  description: 'Teach Mathematics to classes 6 to 10. Joining from the new academic session.',
  qualifications_note: 'Graduation with Mathematics as a main subject.', experience_note: 'CBSE school experience preferred.',
  salary_min: 32000, salary_max: 42000, schedule: 'Monday to Saturday, 7:30 am – 2:00 pm', perks: 'PF, school transport, fee concession for two children.',
});
await call('POST', '/vacancies', school, {
  title: 'PRT English', subject: 'English', min_level: 3, teaching_qual: 'B.Ed', min_exp_years: 1,
  description: 'Class teacher for primary section, teaching English to classes 3 to 5.',
  salary_min: 22000, salary_max: 28000, schedule: 'Monday to Saturday, 7:30 am – 1:30 pm', perks: 'Lunch provided, annual bonus.',
});
await call('POST', '/vacancies', school, {
  title: 'Primary Teacher (Freshers welcome)', subject: 'Primary (all subjects)', min_level: 3, teaching_qual: 'D.El.Ed / D.Ed', min_exp_years: 0,
  salary_min: 15000, salary_max: 18000, schedule: 'Monday to Friday, 8:00 am – 1:00 pm', perks: 'Training provided.',
});
await call('POST', '/vacancies', school, {
  title: 'PGT Chemistry', subject: 'Chemistry', min_level: 4, teaching_qual: 'B.Ed', min_exp_years: 3,
  salary_min: 45000, salary_max: 60000, schedule: 'Monday to Saturday, 7:30 am – 2:30 pm', perks: 'On-campus accommodation.',
});

console.log('Seeded demo accounts (password: password123): teacher@demo.com, school@demo.com, agency@demo.com, college@demo.com');
server.close();
