import { Link } from 'react-router-dom';
import { Logo } from '../components/Layout.jsx';

const ROLES = [
  ['teacher', 'Teachers', 'Build your profile once. See every vacancy you are eligible for, apply in a tap and get interview calls.'],
  ['school', 'Schools', 'Advertise vacancies with your requirements. They reach matching teachers instantly. Review applicants and schedule interviews.'],
  ['agency', 'Work Agencies', 'Add the teachers you represent, track which vacancies fit each of them and apply on their behalf.'],
  ['college', 'Colleges', 'Register your graduating students as teachers and help them land their first teaching job.'],
];
const STEPS = [
  ['Create your profile', 'Qualifications, experience, subjects and location for teachers. Board and affiliation details for schools.'],
  ['Get matched', 'Each vacancy lists its requirements. Teachers who meet them see it in their Updates and on their dashboard.'],
  ['Apply and interview', 'Teachers apply; schools shortlist and schedule interviews, with updates delivered to both sides.'],
];

export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-bar">
        <Logo />
        <div className="actions">
          <Link className="btn btn-ghost" to="/login">Log in</Link>
          <Link className="btn btn-accent" to="/register">Sign up</Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <p className="eyebrow">The job portal for teachers and schools</p>
          <h1>Teaching jobs,<br />matched to you.</h1>
          <p className="lead">TeachConnect connects qualified teachers with schools that are hiring. No endless scrolling: you see the vacancies you are eligible for.</p>
          <div className="actions">
            <Link className="btn btn-accent btn-lg" to="/register?role=teacher">I'm a teacher</Link>
            <Link className="btn btn-light btn-lg" to="/register?role=school">I'm hiring for a school</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>One portal, four kinds of accounts</h2>
        <div className="role-grid">
          {ROLES.map(([role, title, text]) => (
            <Link key={role} to={`/register?role=${role}`} className="card role-card">
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="link">Sign up as {title.toLowerCase().replace(/s$/, '').replace(/ie$/, 'y')} →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section tinted">
        <h2>How it works</h2>
        <ol className="steps">
          {STEPS.map(([title, text], i) => (
            <li key={title}><span className="step-n">{i + 1}</span><h3>{title}</h3><p>{text}</p></li>
          ))}
        </ol>
      </section>

      <footer className="footer">
        <Logo />
        <p className="muted small">Available on the web, Android and iOS.</p>
      </footer>
    </div>
  );
}
