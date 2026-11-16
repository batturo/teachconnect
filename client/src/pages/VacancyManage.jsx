import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, useLoad, useSession, dateText, dateTimeText } from '../api.js';
import { Loading, Empty, Badge, Alert, Field, Input, Textarea, useAction } from '../components/ui.jsx';
import { VacancyDetails } from './JobDetail.jsx';
import { VerifyPrompt } from './SchoolHome.jsx';

// "2026-11-20T10:30" in local time, for <input type="datetime-local">.
const toLocalInput = (iso) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function InterviewForm({ a, onDone, onCancel }) {
  const { meta } = useSession();
  const form = useState({
    scheduled_at: a.interview_at ? toLocalInput(a.interview_at) : '',
    mode: a.interview_mode || meta.interviewModes[0], location: a.interview_location, notes: a.interview_notes,
  });
  const [value, setValue] = form;
  const { busy, error, run } = useAction();
  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      await api(`/applications/${a.id}/interview`, { method: 'PUT', body: { ...value, scheduled_at: new Date(value.scheduled_at).toISOString() } });
      await onDone();
    });
  };
  return (
    <form onSubmit={submit} className="subform">
      <h4>{a.interview_at ? 'Reschedule interview' : 'Schedule interview'}</h4>
      <div className="form-grid">
        <Field label="Date and time"><Input form={form} name="scheduled_at" type="datetime-local" required min={toLocalInput(new Date().toISOString())} /></Field>
        <Field label="Mode">
          <select value={value.mode} onChange={(e) => setValue({ ...value, mode: e.target.value })}>
            {meta.interviewModes.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label={value.mode === 'In person' ? 'Venue' : value.mode === 'Phone' ? 'Number we will call from' : 'Meeting link'} wide>
          <Input form={form} name="location" />
        </Field>
        <Field label="Instructions for the candidate" wide><Textarea form={form} name="notes" rows={2} placeholder="Documents to bring, demo class topic…" /></Field>
      </div>
      <Alert>{error}</Alert>
      <div className="actions">
        <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Confirm interview'}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function TeacherProfile({ t }) {
  const { meta } = useSession();
  const level = (id) => meta.levels.find((l) => l.id === id)?.label;
  const rows = [
    ["Father's name", t.father_name], ["Mother's name", t.mother_name],
    ['Mobile', t.mobile && <a href={`tel:${t.mobile}`}>{t.mobile}</a>],
    ['Email', t.email && <a href={`mailto:${t.email}`}>{t.email}</a>],
    ['Address', t.address && <>{t.address}{t.lat != null && <> · <a href={`https://www.openstreetmap.org/?mlat=${t.lat}&mlon=${t.lng}#map=15/${t.lat}/${t.lng}`} target="_blank" rel="noreferrer">Map</a></>}</>],
    ['Education', t.qualifications.length > 0 && (
      <ul className="plain-list">{t.qualifications.map((q, i) => <li key={i}>{q.degree} <span className="muted">({level(q.level)}{q.institution && `, ${q.institution}`}{q.year && `, ${q.year}`})</span></li>)}</ul>
    )],
    ['Teaching qualifications', t.teaching_quals.join(', ')],
    ['Work experience', t.experience.length > 0 ? (
      <ul className="plain-list">{t.experience.map((x, i) => <li key={i}>{x.place}{x.role && ` – ${x.role}`} <span className="muted">({x.from} to {x.to || 'present'})</span></li>)}</ul>
    ) : 'Fresher'],
    ['Subjects', t.subjects.join(', ')],
    ['Additional information', t.additional_info],
  ].filter(([, v]) => v);
  return <dl className="details compact">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

function Applicant({ a, reload }) {
  const [open, setOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const { busy, error, run } = useAction();
  const setStatus = (status) => run(async () => { await api(`/applications/${a.id}/status`, { method: 'PUT', body: { status } }); await reload(); });
  const t = a.teacher;
  return (
    <li className="applicant">
      <div className="between">
        <div>
          <strong>{t.name}</strong>
          <div className="muted small">
            {t.exp_years > 0 ? `${t.exp_years} yrs experience` : 'Fresher'} · {t.subjects.join(', ') || 'No subjects listed'}
            {a.via && ` · via ${a.via.name}`}
          </div>
        </div>
        <Badge status={a.status} />
      </div>
      {!a.eligible && <p className="small warn-text">Does not meet: {a.missing.join('; ')}</p>}
      {a.note && <p className="note">"{a.note}"</p>}
      {a.status === 'interview_scheduled' && (
        <p className="interview-line">Interview on {dateTimeText(a.interview_at)} · {a.interview_mode}{a.interview_location && ` · ${a.interview_location}`}</p>
      )}
      <Alert>{error}</Alert>
      <div className="actions wrap">
        <button className="btn btn-sm btn-outline" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide profile' : 'View profile'}</button>
        <button className="btn btn-sm btn-primary" onClick={() => setScheduling(true)} disabled={busy}>{a.interview_at ? 'Reschedule interview' : 'Schedule interview'}</button>
        {a.status === 'applied' && <button className="btn btn-sm btn-outline" onClick={() => setStatus('shortlisted')} disabled={busy}>Shortlist</button>}
        {a.status !== 'hired' && <button className="btn btn-sm btn-outline" onClick={() => setStatus('hired')} disabled={busy}>Mark selected</button>}
        {a.status !== 'rejected' && <button className="btn btn-sm btn-ghost danger" onClick={() => setStatus('rejected')} disabled={busy}>Reject</button>}
      </div>
      {scheduling && <InterviewForm a={a} onCancel={() => setScheduling(false)} onDone={async () => { setScheduling(false); await reload(); }} />}
      {open && <TeacherProfile t={t} />}
      <p className="muted small">Applied {dateText(a.created_at)}</p>
    </li>
  );
}

export default function VacancyManage() {
  const { id } = useParams();
  const vacancy = useLoad(`/vacancies/${id}`);
  const applicants = useLoad(`/vacancies/${id}/applications`);
  const { busy, error, run } = useAction();
  const act = (action) => run(async () => { await api(`/vacancies/${id}/${action}`, { method: 'POST' }); await vacancy.reload(); });

  return (
    <Loading state={vacancy}>
      {(v) => (
        <div className="stack narrow">
          <div><Link to="/home" className="link small">← All vacancies</Link></div>
          {v.status === 'pending_verification' && <VerifyPrompt v={v} onDone={vacancy.reload} />}
          {v.status === 'outdated' && <Alert kind="warn"><span>This vacancy is outdated and hidden from teachers because the 30-day reminder was not answered.</span></Alert>}
          <section className="card">
            <div className="between"><h1>{v.title}</h1><Badge status={v.status} /></div>
            <p className="muted small">Listed {dateText(v.created_at)}{v.verified_at !== v.created_at && ` · last confirmed ${dateText(v.verified_at)}`}</p>
            <VacancyDetails v={v} />
            <Alert>{error}</Alert>
            <div className="actions wrap">
              <Link className="btn btn-outline btn-sm" to={`/vacancies/${id}/edit`}>Edit</Link>
              {(v.status === 'outdated' || v.status === 'closed') && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act('verify')}>Re-list vacancy</button>}
              {v.status !== 'closed' && <button className="btn btn-ghost btn-sm danger" disabled={busy} onClick={() => window.confirm('Close this vacancy? Teachers will no longer see it.') && act('close')}>Close vacancy</button>}
            </div>
          </section>

          <section className="card">
            <h2>Applicants</h2>
            <Loading state={applicants}>
              {(rows) => rows.length
                ? <ul className="list">{rows.map((a) => <Applicant key={a.id} a={a} reload={applicants.reload} />)}</ul>
                : <Empty title="No applications yet">Eligible teachers have been notified about this vacancy.</Empty>}
            </Loading>
          </section>
        </div>
      )}
    </Loading>
  );
}
