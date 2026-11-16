import { all, run, get, notify } from './db.js';
import { reminderAfterMs, graceMs } from './constants.js';
import { sendMail } from './mailer.js';

// Vacancy ageing:
//   active --(30 days since listing/last verification)--> pending_verification (+ reminder to school)
//   pending_verification --(5 days without a response)--> outdated
// The school answers the reminder with "still open" (back to active, clock restarts) or "close".
export function runVacancyLifecycle(at = new Date()) {
  const iso = at.toISOString();
  const remindBefore = new Date(at.getTime() - reminderAfterMs()).toISOString();
  const expireBefore = new Date(at.getTime() - graceMs()).toISOString();
  const graceDays = Math.round(graceMs() / 86400000);

  const expired = all(
    "SELECT * FROM vacancies WHERE status = 'pending_verification' AND reminder_at <= ?", expireBefore);
  for (const v of expired) {
    run("UPDATE vacancies SET status = 'outdated' WHERE id = ?", v.id);
    notify(v.school_id, {
      type: 'vacancy_outdated',
      title: `"${v.title}" was moved to outdated vacancies`,
      body: 'We did not hear back about whether this vacancy is still open. You can re-list it any time.',
      vacancyId: v.id,
    });
  }

  const due = all("SELECT * FROM vacancies WHERE status = 'active' AND verified_at <= ?", remindBefore);
  for (const v of due) {
    run("UPDATE vacancies SET status = 'pending_verification', reminder_at = ? WHERE id = ?", iso, v.id);
    const body = `Please confirm within ${graceDays} days whether this vacancy is still open, otherwise it will be moved to outdated vacancies.`;
    notify(v.school_id, {
      type: 'vacancy_reminder',
      title: `Is "${v.title}" still available?`,
      body,
      vacancyId: v.id,
    });
    const school = get('SELECT u.email AS login_email, o.email FROM users u LEFT JOIN orgs o ON o.user_id = u.id WHERE u.id = ?', v.school_id);
    sendMail(school?.email || school?.login_email, `Is your vacancy "${v.title}" still available?`, body);
  }

  return { reminded: due.length, outdated: expired.length };
}

export function startScheduler() {
  const tick = () => {
    try {
      const r = runVacancyLifecycle();
      if (r.reminded || r.outdated) console.log(`Vacancy lifecycle: ${r.reminded} reminded, ${r.outdated} outdated`);
    } catch (err) {
      console.error('Vacancy lifecycle failed:', err);
    }
  };
  tick();
  setInterval(tick, 60 * 60 * 1000).unref();
}
