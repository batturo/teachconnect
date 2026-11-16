import { Link } from 'react-router-dom';
import { useLoad, useSession } from '../api.js';
import { Loading, Empty, PageHead } from '../components/ui.jsx';

export default function ManagerHome() {
  const { me } = useSession();
  const state = useLoad('/teachers');
  const college = me.user.role === 'college';
  return (
    <>
      <PageHead title={me.profile.name} sub={college ? 'Students you have registered as teachers.' : 'Teachers you represent.'}
        action={<Link className="btn btn-primary" to="/teachers/new">+ Add teacher</Link>} />
      <Loading state={state}>
        {(rows) => rows.length ? (
          <div className="grid">
            {rows.map((t) => (
              <Link key={t.id} to={`/teachers/${t.id}`} className="card vacancy-card">
                <h3>{t.name}</h3>
                <p className="muted small">{t.subjects.join(', ') || 'No subjects added'} · {t.exp_years > 0 ? `${t.exp_years} yrs experience` : 'Fresher'}</p>
                <p className="vc-foot small">
                  <span className={t.eligible_count ? 'badge badge-eligible' : 'badge badge-muted'}>
                    {t.eligible_count} eligible {t.eligible_count === 1 ? 'vacancy' : 'vacancies'}
                  </span>
                  <span className="muted">{t.application_count} applied</span>
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <Empty title="No teachers added yet">
            Add {college ? 'your students' : 'the teachers you represent'} with their qualifications and subjects. You will see the vacancies each of them is eligible for and can apply on their behalf.
          </Empty>
        )}
      </Loading>
    </>
  );
}
