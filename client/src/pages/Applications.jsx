import { Link } from 'react-router-dom';
import { useLoad, useSession, dateText, dateTimeText } from '../api.js';
import { Loading, Empty, PageHead, Badge } from '../components/ui.jsx';

export default function Applications() {
  const { me } = useSession();
  const state = useLoad('/applications');
  const manager = me.user.role !== 'teacher';
  return (
    <>
      <PageHead title="Applications" sub={manager ? 'Jobs you applied to on behalf of your teachers.' : 'Jobs you have applied for.'} />
      <Loading state={state}>
        {(rows) => rows.length ? (
          <div className="stack">
            {rows.map((a) => (
              <Link key={a.id} to={`/jobs/${a.vacancy_id}`} className="card app-card">
                <div className="between">
                  <div>
                    <h3>{a.title}</h3>
                    <p className="vc-school">{a.school_name}</p>
                  </div>
                  <Badge status={a.status} />
                </div>
                {manager && <p className="small">Teacher: <strong>{a.teacher_name}</strong></p>}
                {a.status === 'interview_scheduled' && (
                  <p className="interview-line">
                    Interview on {dateTimeText(a.interview_at)} · {a.interview_mode}{a.interview_location && ` · ${a.interview_location}`}
                  </p>
                )}
                <p className="muted small">Applied {dateText(a.created_at)} · {a.school_address}</p>
              </Link>
            ))}
          </div>
        ) : <Empty title="No applications yet"><Link to="/jobs">Search jobs</Link> to find a vacancy and apply.</Empty>}
      </Loading>
    </>
  );
}
