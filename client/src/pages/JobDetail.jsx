import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, useLoad, useSession, salaryText, dateText, dateTimeText } from '../api.js';
import { Loading, Alert, Badge, useAction } from '../components/ui.jsx';
import { Requirements } from '../components/VacancyCard.jsx';

export function VacancyDetails({ v }) {
  const rows = [
    ['Salary', salaryText(v)],
    ['Subject', v.subject],
    ['Educational qualifications', <><Requirements v={v} experience={false} />{v.qualifications_note && <><br />{v.qualifications_note}</>}</>],
    ['Work experience', <>{v.min_exp_years > 0 ? `${v.min_exp_years}+ years` : 'Freshers can apply'}{v.experience_note && <><br />{v.experience_note}</>}</>],
    ['Time schedule', v.schedule],
    ['Other perks', v.perks],
    ['About the role', v.description],
  ].filter(([, value]) => value);
  return (
    <dl className="details">
      {rows.map(([k, value]) => <div key={k}><dt>{k}</dt><dd>{value}</dd></div>)}
    </dl>
  );
}

function InterviewBox({ a }) {
  if (a.status !== 'interview_scheduled') return null;
  return (
    <div className="alert alert-success block">
      <strong>Interview: {dateTimeText(a.interview_at)}</strong>
      <span>{a.interview_mode}{a.interview_location && ` · ${a.interview_location}`}</span>
      {a.interview_notes && <span>{a.interview_notes}</span>}
    </div>
  );
}

export default function JobDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { me } = useSession();
  const state = useLoad(`/vacancies/${id}`);
  const [note, setNote] = useState('');
  const { busy, error, run } = useAction();
  const manager = me.user.role !== 'teacher';

  const apply = (teacherId) => run(async () => {
    await api(`/vacancies/${id}/apply`, { method: 'POST', body: { teacher_id: teacherId, note } });
    setNote('');
    await state.reload();
  });
  const withdraw = (appId) => {
    if (window.confirm('Withdraw this application?')) run(async () => { await api(`/applications/${appId}`, { method: 'DELETE' }); await state.reload(); });
  };

  return (
    <Loading state={state}>
      {(v) => {
        const open = v.status === 'active' || v.status === 'pending_verification';
        return (
          <div className="stack narrow">
            <div><button className="link small" onClick={() => history.back()}>← Back</button></div>
            <section className="card">
              <h1>{v.title}</h1>
              <p className="vc-school">{v.school_name}{v.school_board && <span className="muted"> · {v.school_board}</span>}</p>
              <p className="muted small">
                {v.school_address}{v.distance_km != null && ` · ${v.distance_km} km from you`}
                {v.school_lat != null && <> · <a href={`https://www.openstreetmap.org/?mlat=${v.school_lat}&mlon=${v.school_lng}#map=15/${v.school_lat}/${v.school_lng}`} target="_blank" rel="noreferrer">View on map</a></>}
                {v.school_website && <> · <a href={/^https?:/.test(v.school_website) ? v.school_website : `https://${v.school_website}`} target="_blank" rel="noreferrer">Website</a></>}
              </p>
              <p className="muted small">Posted {dateText(v.created_at)}</p>
              <VacancyDetails v={v} />
            </section>

            {!open && <Alert kind="warn">This vacancy is no longer open for applications.</Alert>}
            <Alert>{error}</Alert>

            {!manager && (
              <section className="card">
                {v.application ? (
                  <div className="stack">
                    <div className="between"><h2>Your application</h2><Badge status={v.application.status} /></div>
                    <InterviewBox a={v.application} />
                    <p className="muted small">Applied on {dateText(v.application.created_at)}</p>
                    <div><button className="link danger small" onClick={() => withdraw(v.application.id)} disabled={busy}>Withdraw application</button></div>
                  </div>
                ) : open && (
                  <div className="stack">
                    <h2>Apply for this job</h2>
                    {v.eligible
                      ? <Alert kind="success">You meet the requirements for this vacancy.</Alert>
                      : <Alert kind="warn"><span>Your profile does not meet every requirement: {v.missing.join('; ')}. You can still apply, and the school will see this.</span></Alert>}
                    <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the school (optional)" aria-label="Note for the school" />
                    <div><button className="btn btn-primary" onClick={() => apply()} disabled={busy}>{busy ? 'Applying…' : 'Apply now'}</button></div>
                  </div>
                )}
              </section>
            )}

            {manager && (
              <section className="card stack">
                <h2>Apply on behalf of your teachers</h2>
                {v.teachers.length === 0 && <p className="muted">You have not added any teachers yet. <Link to="/teachers/new">Add a teacher</Link></p>}
                <ul className="list">
                  {[...v.teachers].sort((a, b) => (String(b.id) === params.get('teacher_id')) - (String(a.id) === params.get('teacher_id')) || b.eligible - a.eligible).map((t) => (
                    <li key={t.id} className="between">
                      <div>
                        <strong>{t.name}</strong>
                        <div className="muted small">{t.eligible ? 'Meets all requirements' : t.missing.join('; ')}</div>
                      </div>
                      {t.application_status ? <Badge status={t.application_status} />
                        : open && <button className={`btn btn-sm ${t.eligible ? 'btn-primary' : 'btn-outline'}`} onClick={() => apply(t.id)} disabled={busy}>Apply</button>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        );
      }}
    </Loading>
  );
}
