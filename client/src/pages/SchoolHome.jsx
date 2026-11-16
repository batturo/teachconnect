import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useLoad, useSession, salaryText, dateText } from '../api.js';
import { Loading, Empty, PageHead, Badge, Alert, useAction } from '../components/ui.jsx';

const TABS = [
  ['open', 'Open', (v) => v.status === 'active' || v.status === 'pending_verification'],
  ['outdated', 'Outdated', (v) => v.status === 'outdated'],
  ['closed', 'Closed', (v) => v.status === 'closed'],
];

// Answer to the 30-day "is this vacancy still available?" reminder.
export function VerifyPrompt({ v, onDone }) {
  const { busy, error, run } = useAction();
  const answer = (action) => run(async () => { await api(`/vacancies/${v.id}/${action}`, { method: 'POST' }); await onDone(); });
  return (
    <div className="alert alert-warn">
      <span><strong>Is "{v.title}" still available?</strong> It was listed over 30 days ago. Without a response it moves to outdated vacancies 5 days after the reminder ({dateText(v.reminder_at)}).</span>
      <span className="actions">
        <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => answer('verify')}>Yes, still available</button>
        <button className="btn btn-sm btn-outline" disabled={busy} onClick={() => answer('close')}>No, close it</button>
      </span>
      {error && <span>{error}</span>}
    </div>
  );
}

export default function SchoolHome() {
  const { me } = useSession();
  const state = useLoad('/vacancies/mine');
  const [tab, setTab] = useState('open');
  const incomplete = !me.profile.address || !me.profile.mobile;

  return (
    <>
      <PageHead title={me.profile.name} sub="Your vacancies and applicants."
        action={<Link className="btn btn-primary" to="/vacancies/new">+ Post a vacancy</Link>} />
      {incomplete && (
        <Alert kind="warn">
          <span>Add your school's address and mobile number before posting a vacancy.</span>
          <Link className="btn btn-sm btn-primary" to="/profile">Complete profile</Link>
        </Alert>
      )}
      <Loading state={state}>
        {(rows) => {
          const filter = TABS.find(([key]) => key === tab)[2];
          const shown = rows.filter(filter);
          return (
            <>
              {rows.filter((v) => v.status === 'pending_verification').map((v) => <VerifyPrompt key={v.id} v={v} onDone={state.reload} />)}
              <div className="tabs" role="tablist">
                {TABS.map(([key, label, f]) => (
                  <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
                    {label} <span className="count">{rows.filter(f).length}</span>
                  </button>
                ))}
              </div>
              {shown.length ? (
                <div className="grid">
                  {shown.map((v) => (
                    <Link key={v.id} to={`/vacancies/${v.id}`} className="card vacancy-card">
                      <div className="vc-top"><h3>{v.title}</h3><Badge status={v.status} /></div>
                      <p className="vc-salary">{salaryText(v)}</p>
                      <p className="muted small vc-foot">
                        <span>{v.application_count} {v.application_count === 1 ? 'applicant' : 'applicants'}</span>
                        <span>Listed {dateText(v.created_at)}</span>
                      </p>
                    </Link>
                  ))}
                </div>
              ) : tab === 'open' ? (
                <Empty title="No open vacancies">Post a vacancy and it will be shown to every teacher who meets its requirements.</Empty>
              ) : tab === 'outdated' ? (
                <Empty title="No outdated vacancies">Vacancies you do not re-confirm after the 30-day reminder are moved here.</Empty>
              ) : <Empty title="No closed vacancies" />}
            </>
          );
        }}
      </Loading>
    </>
  );
}
