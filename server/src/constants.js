export const ROLES = ['teacher', 'school', 'agency', 'college'];
export const ORG_ROLES = ['school', 'agency', 'college'];

// Ordered education levels. A vacancy asks for a minimum level; a teacher's
// highest level must be equal or higher.
export const LEVELS = [
  { id: 1, label: 'Higher Secondary (12th)' },
  { id: 2, label: 'Diploma' },
  { id: 3, label: "Bachelor's degree" },
  { id: 4, label: "Master's degree" },
  { id: 5, label: 'M.Phil' },
  { id: 6, label: 'Doctorate (PhD)' },
];

// Professional teaching qualifications. A vacancy may require one of them.
export const TEACHING_QUALS = ['D.El.Ed / D.Ed', 'B.Ed', 'M.Ed', 'NTT', 'CTET / TET'];

export const SUBJECTS = [
  'English', 'Hindi', 'Mathematics', 'Science', 'Physics', 'Chemistry', 'Biology',
  'Social Science', 'History', 'Geography', 'Political Science', 'Economics',
  'Commerce', 'Accountancy', 'Business Studies', 'Computer Science', 'Sanskrit',
  'Physical Education', 'Art', 'Music', 'Primary (all subjects)', 'Pre-primary',
];

export const APPLICATION_STATUSES = ['applied', 'shortlisted', 'interview_scheduled', 'hired', 'rejected'];
export const INTERVIEW_MODES = ['In person', 'Phone', 'Video call'];

const days = (name, fallback) => Number(process.env[name] ?? fallback) * 24 * 60 * 60 * 1000;
// After this long without verification the school is asked whether the vacancy is still open.
export const reminderAfterMs = () => days('REMINDER_AFTER_DAYS', 30);
// If the school does not answer within this window the vacancy becomes outdated.
export const graceMs = () => days('REMINDER_GRACE_DAYS', 5);
