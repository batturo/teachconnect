import { useState } from 'react';
import { useSession } from '../api.js';
import { Field, Input, Textarea, Alert, useAction } from './ui.jsx';
import LocationField from './LocationField.jsx';

const blankQual = { level: '', degree: '', institution: '', year: '' };
const blankExp = { place: '', role: '', from: '', to: '' };

// Full teacher profile form. Used by teachers for themselves and by
// agencies/colleges for the teachers they add.
export default function TeacherForm({ initial, onSave, saveLabel = 'Save profile' }) {
  const { meta } = useSession();
  const formState = useState({ qualifications: [], experience: [], subjects: [], teaching_quals: [], ...initial });
  const [form, setForm] = formState;
  const [customSubject, setCustomSubject] = useState('');
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();

  const setRow = (key, i, patch) =>
    setForm({ ...form, [key]: form[key].map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const addRow = (key, blank) => setForm({ ...form, [key]: [...form[key], { ...blank }] });
  const removeRow = (key, i) => setForm({ ...form, [key]: form[key].filter((_, j) => j !== i) });
  const toggle = (key, value) =>
    setForm({ ...form, [key]: form[key].includes(value) ? form[key].filter((x) => x !== value) : [...form[key], value] });

  const addCustomSubject = () => {
    const s = customSubject.trim();
    if (s && !form.subjects.some((x) => x.toLowerCase() === s.toLowerCase())) setForm({ ...form, subjects: [...form.subjects, s] });
    setCustomSubject('');
  };

  const submit = (e) => {
    e.preventDefault();
    setSaved(false);
    run(async () => { await onSave(form); setSaved(true); });
  };

  const subjectOptions = [...new Set([...meta.subjects, ...form.subjects])];

  return (
    <form onSubmit={submit} className="stack">
      <section className="card">
        <h2>Personal details</h2>
        <div className="form-grid">
          <Field label="Full name"><Input form={formState} name="name" required autoComplete="name" /></Field>
          <Field label="Mobile number"><Input form={formState} name="mobile" type="tel" inputMode="tel" placeholder="e.g. 98765 43210" /></Field>
          <Field label="Father's name"><Input form={formState} name="father_name" /></Field>
          <Field label="Mother's name"><Input form={formState} name="mother_name" /></Field>
          <Field label="Email ID"><Input form={formState} name="email" type="email" /></Field>
          <LocationField form={formState} />
        </div>
      </section>

      <section className="card">
        <h2>Educational qualifications</h2>
        {form.qualifications.map((q, i) => (
          <div className="row-group" key={i}>
            <div className="form-grid">
              <Field label="Level">
                <select value={q.level} onChange={(e) => setRow('qualifications', i, { level: Number(e.target.value) })} required>
                  <option value="">Select…</option>
                  {meta.levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </Field>
              <Field label="Degree / course">
                <input value={q.degree} onChange={(e) => setRow('qualifications', i, { degree: e.target.value })} placeholder="e.g. B.Sc Mathematics" required />
              </Field>
              <Field label="Board / university">
                <input value={q.institution} onChange={(e) => setRow('qualifications', i, { institution: e.target.value })} />
              </Field>
              <Field label="Year of passing">
                <input value={q.year} onChange={(e) => setRow('qualifications', i, { year: e.target.value })} inputMode="numeric" maxLength={4} placeholder="YYYY" />
              </Field>
            </div>
            <button type="button" className="link danger small" onClick={() => removeRow('qualifications', i)}>Remove</button>
          </div>
        ))}
        <button type="button" className="btn btn-outline btn-sm" onClick={() => addRow('qualifications', blankQual)}>+ Add qualification</button>

        <h3>Teaching qualifications</h3>
        <div className="chips">
          {meta.teachingQuals.map((q) => (
            <button type="button" key={q} className={`chip${form.teaching_quals.includes(q) ? ' on' : ''}`}
              aria-pressed={form.teaching_quals.includes(q)} onClick={() => toggle('teaching_quals', q)}>{q}</button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Work experience</h2>
        {form.experience.length === 0 && <p className="muted small">No experience added. Freshers can leave this empty.</p>}
        {form.experience.map((x, i) => (
          <div className="row-group" key={i}>
            <div className="form-grid">
              <Field label="Place of work">
                <input value={x.place} onChange={(e) => setRow('experience', i, { place: e.target.value })} placeholder="School / institute name" required />
              </Field>
              <Field label="Position">
                <input value={x.role} onChange={(e) => setRow('experience', i, { role: e.target.value })} placeholder="e.g. PGT Physics" />
              </Field>
              <Field label="From">
                <input type="month" value={x.from} onChange={(e) => setRow('experience', i, { from: e.target.value })} placeholder="YYYY-MM" pattern="\d{4}-\d{2}" required />
              </Field>
              <Field label="To" hint="Leave empty if currently working here">
                <input type="month" value={x.to} onChange={(e) => setRow('experience', i, { to: e.target.value })} placeholder="YYYY-MM" pattern="\d{4}-\d{2}" min={x.from} />
              </Field>
            </div>
            <button type="button" className="link danger small" onClick={() => removeRow('experience', i)}>Remove</button>
          </div>
        ))}
        <button type="button" className="btn btn-outline btn-sm" onClick={() => addRow('experience', blankExp)}>+ Add work experience</button>
      </section>

      <section className="card">
        <h2>Subjects interested in teaching</h2>
        <div className="chips">
          {subjectOptions.map((s) => (
            <button type="button" key={s} className={`chip${form.subjects.includes(s) ? ' on' : ''}`}
              aria-pressed={form.subjects.includes(s)} onClick={() => toggle('subjects', s)}>{s}</button>
          ))}
        </div>
        <div className="inline-add">
          <input value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} placeholder="Other subject"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSubject(); } }} />
          <button type="button" className="btn btn-outline btn-sm" onClick={addCustomSubject}>Add</button>
        </div>
      </section>

      <section className="card">
        <h2>Additional information</h2>
        <Textarea form={formState} name="additional_info" rows={5}
          placeholder="Achievements, languages, classes you prefer, notice period, anything else a school should know…" />
      </section>

      <Alert>{error}</Alert>
      {saved && <Alert kind="success">Saved.</Alert>}
      <div className="actions">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : saveLabel}</button>
      </div>
    </form>
  );
}
