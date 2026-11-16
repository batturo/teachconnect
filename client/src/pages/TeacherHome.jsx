import { Link } from 'react-router-dom';
import { useLoad, useSession, dateTimeText } from '../api.js';
import { Loading, Empty, PageHead } from '../components/ui.jsx';
import VacancyCard from '../components/VacancyCard.jsx';

// What a teacher still needs to fill in for matching to work well.
export function profileGaps(t) {
  return [
    !t.mobile && 'mobile number',
    !t.address && 'address',
    t.lat == null && 'GPS location',
    !t.qualifications.length && 'educational qualifications',
    !t.subjects.length && 'subjects you want to teach',
  ].filter(Boolean);
}

export default function TeacherHome() {
  const { me } = useSession();
  const eligible = useLoad('/vacancies?eligible=1');
  const applications = useLoad('/applications');
  const gaps = profileGaps(me.profile);
  const interviews = (applications.data ?? []).filter((a) => a.status === 'interview_scheduled' && new Date(a.interview_at) > new Date());

  return (
    <>
      <PageHead title={`Hello, ${me.profile.name.split(' ')[0]}`} sub="Here are the vacancies that match your profile." />

      {gaps.length > 0 && (
        <div className="alert alert-warn">
          <span>Complete your profile to get matched with more vacancies. Missing: {gaps.join(', ')}.</span>
          <Link className="btn btn-sm btn-primary" to="/profile">Complete profile</Link>
        </div>
      )}

      {interviews.length > 0 && (
        <section className="stack">
          <h2>Upcoming interviews</h2>
          {interviews.map((a) => (
            <Link key={a.id} to={`/jobs/${a.vacancy_id}`} className="card interview-card">
              <strong>{dateTimeText(a.interview_at)}</strong>
              <span>{a.title} · {a.school_name}</span>
              <span className="muted small">{a.interview_mode}{a.interview_location && ` · ${a.interview_location}`}</span>
            </Link>
          ))}
        </section>
      )}

      <section className="stack">
        <h2>Vacancies you are eligible for</h2>
        <Loading state={eligible}>
          {(rows) => rows.length ? <div className="grid">{rows.map((v) => <VacancyCard key={v.id} v={v} />)}</div> : (
            <Empty title="No matching vacancies right now">
              New vacancies that fit your qualifications, experience and subjects will appear here and in Updates. Meanwhile you can <Link to="/jobs">search all jobs</Link>.
            </Empty>
          )}
        </Loading>
      </section>
    </>
  );
}
