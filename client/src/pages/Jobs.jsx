import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLoad, useSession } from '../api.js';
import { Loading, Empty, PageHead, Field } from '../components/ui.jsx';
import VacancyCard from '../components/VacancyCard.jsx';

// Job search. Agencies and colleges can pick one of their teachers to check eligibility against.
export default function Jobs() {
  const { me, meta } = useSession();
  const manager = me.user.role !== 'teacher';
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(Object.fromEntries(params));
  const teachers = useLoad(manager ? '/teachers' : null);
  const results = useLoad(`/vacancies?${params}`);

  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });
  const apply = (next) => setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)), { replace: true });
  const search = (e) => { e.preventDefault(); apply(draft); };
  const change = (k) => (e) => { const next = { ...draft, [k]: e.target.type === 'checkbox' ? (e.target.checked ? '1' : '') : e.target.value }; setDraft(next); apply(next); };

  const forTeacher = !manager || draft.teacher_id;
  const suffix = manager && draft.teacher_id ? `?teacher_id=${draft.teacher_id}` : '';

  return (
    <>
      <PageHead title="Search jobs" />
      <form className="card search" onSubmit={search}>
        <div className="search-main">
          <input type="search" value={draft.q ?? ''} onChange={set('q')} placeholder="Job title, subject or school" aria-label="Search" />
          <button className="btn btn-primary">Search</button>
        </div>
        <div className="form-grid filters">
          <Field label="Subject">
            <select value={draft.subject ?? ''} onChange={change('subject')}>
              <option value="">Any subject</option>
              {meta.subjects.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="City / area"><input value={draft.location ?? ''} onChange={set('location')} placeholder="e.g. Indore" /></Field>
          <Field label="Minimum salary (₹ / month)"><input value={draft.min_salary ?? ''} onChange={set('min_salary')} inputMode="numeric" placeholder="e.g. 25000" /></Field>
          {manager && (
            <Field label="Check eligibility for">
              <select value={draft.teacher_id ?? ''} onChange={change('teacher_id')}>
                <option value="">— Select a teacher —</option>
                {(teachers.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          )}
        </div>
        {forTeacher && (
          <label className="check">
            <input type="checkbox" checked={draft.eligible === '1'} onChange={change('eligible')} />
            Only show vacancies {manager ? 'this teacher is' : 'I am'} eligible for
          </label>
        )}
      </form>

      <Loading state={results}>
        {(rows) => rows.length ? (
          <>
            <p className="muted small">{rows.length} {rows.length === 1 ? 'vacancy' : 'vacancies'} found</p>
            <div className="grid">{rows.map((v) => <VacancyCard key={v.id} v={v} to={`/jobs/${v.id}${suffix}`} />)}</div>
          </>
        ) : <Empty title="No vacancies found">Try removing a filter or searching for something else.</Empty>}
      </Loading>
    </>
  );
}
