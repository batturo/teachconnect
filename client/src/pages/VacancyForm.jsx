import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, useSession } from '../api.js';
import { Field, Input, Textarea, Alert, PageHead, useAction } from '../components/ui.jsx';

const BLANK = { title: '', subject: '', description: '', min_level: 0, teaching_qual: '', qualifications_note: '',
  min_exp_years: '', experience_note: '', salary_min: '', salary_max: '', schedule: '', perks: '' };

export default function VacancyForm() {
  const { id } = useParams();
  const { meta } = useSession();
  const navigate = useNavigate();
  const form = useState(id ? null : BLANK);
  const [value, setValue] = form;
  const { busy, error, run } = useAction();
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (id) api(`/vacancies/${id}`).then((v) => setValue({ ...BLANK, ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x ?? ''])) })).catch((e) => setLoadError(e.message));
  }, [id]);

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      const saved = await api(id ? `/vacancies/${id}` : '/vacancies', { method: id ? 'PUT' : 'POST', body: value });
      navigate(`/vacancies/${saved.id}`, { replace: true });
    });
  };

  if (loadError) return <Alert>{loadError}</Alert>;
  if (!value) return <p className="muted pad">Loading…</p>;

  return (
    <form onSubmit={submit} className="stack narrow">
      <PageHead title={id ? 'Edit vacancy' : 'Post a vacancy'}
        sub="Teachers who meet the requirements below will see this vacancy in their Updates and on their dashboard." />
      <section className="card">
        <h2>The position</h2>
        <div className="form-grid">
          <Field label="Job title" wide><Input form={form} name="title" required placeholder="e.g. PGT Physics, Primary Teacher" /></Field>
          <Field label="Subject" hint="Only teachers interested in this subject are matched. Leave empty for any.">
            <Input form={form} name="subject" list="subjects" placeholder="Any subject" />
            <datalist id="subjects">{meta.subjects.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="Time schedule"><Input form={form} name="schedule" placeholder="e.g. Mon–Sat, 7:30 am – 2:00 pm" /></Field>
          <Field label="About the role" wide><Textarea form={form} name="description" rows={4} placeholder="Classes to be taught, responsibilities, joining date…" /></Field>
        </div>
      </section>

      <section className="card">
        <h2>Requirements</h2>
        <div className="form-grid">
          <Field label="Minimum educational qualification">
            <select value={value.min_level} onChange={(e) => setValue({ ...value, min_level: Number(e.target.value) })}>
              <option value={0}>No minimum</option>
              {meta.levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </Field>
          <Field label="Teaching qualification required">
            <select value={value.teaching_qual} onChange={(e) => setValue({ ...value, teaching_qual: e.target.value })}>
              <option value="">None required</option>
              {meta.teachingQuals.map((q) => <option key={q}>{q}</option>)}
            </select>
          </Field>
          <Field label="More about qualifications" wide><Input form={form} name="qualifications_note" placeholder="e.g. M.Sc Physics with 55% marks preferred" /></Field>
          <Field label="Minimum work experience (years)" hint="Use 0 if freshers can apply">
            <Input form={form} name="min_exp_years" type="number" min="0" max="50" step="0.5" placeholder="0" />
          </Field>
          <Field label="More about experience"><Input form={form} name="experience_note" placeholder="e.g. CBSE board classes 11–12" /></Field>
        </div>
      </section>

      <section className="card">
        <h2>Salary and perks</h2>
        <div className="form-grid">
          <Field label="Salary from (₹ / month)"><Input form={form} name="salary_min" type="number" min="0" step="500" /></Field>
          <Field label="Salary up to (₹ / month)"><Input form={form} name="salary_max" type="number" min="0" step="500" /></Field>
          <Field label="Other perks" wide><Textarea form={form} name="perks" placeholder="Accommodation, transport, PF, fee concession for children…" /></Field>
        </div>
      </section>

      <Alert>{error}</Alert>
      <div className="actions">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : id ? 'Save changes' : 'Post vacancy'}</button>
        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
      </div>
    </form>
  );
}
