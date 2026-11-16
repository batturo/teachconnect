import { LEVELS } from './constants.js';

const levelLabel = (id) => LEVELS.find((l) => l.id === id)?.label ?? '';
const norm = (s) => String(s).trim().toLowerCase();

// Decide whether a teacher meets a vacancy's stated requirements.
// `teacher` must have parsed `subjects` and `teaching_quals` arrays.
export function eligibility(teacher, vacancy) {
  const missing = [];
  if (vacancy.min_level > teacher.max_level) {
    missing.push(`Needs at least: ${levelLabel(vacancy.min_level)}`);
  }
  if (vacancy.teaching_qual && !teacher.teaching_quals.includes(vacancy.teaching_qual)) {
    missing.push(`Needs ${vacancy.teaching_qual}`);
  }
  if (vacancy.min_exp_years > teacher.exp_years) {
    missing.push(`Needs ${vacancy.min_exp_years}+ years of experience`);
  }
  if (vacancy.subject && !teacher.subjects.some((s) => norm(s) === norm(vacancy.subject))) {
    missing.push(`${vacancy.subject} is not among the subjects of interest`);
  }
  return { eligible: missing.length === 0, missing };
}

// Total months of work experience -> years with one decimal. Open-ended jobs run to today.
export function experienceYears(experience, today = new Date()) {
  let months = 0;
  for (const e of experience) {
    const from = parseMonth(e.from);
    const to = e.to ? parseMonth(e.to) : today.getFullYear() * 12 + today.getMonth();
    if (from != null && to != null && to >= from) months += to - from + 1;
  }
  return Math.round((months / 12) * 10) / 10;
}

function parseMonth(s) {
  const m = /^(\d{4})-(\d{2})$/.exec(s || '');
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
}

export function distanceKm(a, b) {
  if (a?.lat == null || a?.lng == null || b?.lat == null || b?.lng == null) return null;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)) * 10) / 10;
}
