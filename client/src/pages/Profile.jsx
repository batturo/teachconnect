import { useState } from 'react';
import { api, useSession, ROLE_LABEL } from '../api.js';
import { Field, Input, Alert, PageHead, useAction } from '../components/ui.jsx';
import TeacherForm from '../components/TeacherForm.jsx';
import LocationField from '../components/LocationField.jsx';

const AFFILIATION = { school: 'Board affiliated to', college: 'University affiliated to' };

function OrgForm() {
  const { me, refresh } = useSession();
  const role = me.user.role;
  const form = useState(me.profile);
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  const submit = (e) => {
    e.preventDefault();
    setSaved(false);
    run(async () => { await api('/profile', { method: 'PUT', body: form[0] }); await refresh(); setSaved(true); });
  };
  return (
    <form onSubmit={submit} className="stack">
      <section className="card">
        <h2>{ROLE_LABEL[role]} details</h2>
        <div className="form-grid">
          <Field label="Name" wide><Input form={form} name="name" required /></Field>
          <LocationField form={form} />
          {AFFILIATION[role] && <>
            <Field label={AFFILIATION[role]}><Input form={form} name="affiliation_body" placeholder={role === 'school' ? 'e.g. CBSE, ICSE, State Board' : 'e.g. University of Delhi'} /></Field>
            <Field label="Affiliation no."><Input form={form} name="affiliation_no" /></Field>
          </>}
          <Field label="Mobile number"><Input form={form} name="mobile" type="tel" inputMode="tel" /></Field>
          <Field label="Email ID"><Input form={form} name="email" type="email" /></Field>
          <Field label="Website"><Input form={form} name="website" placeholder="www.example.com" /></Field>
        </div>
      </section>
      <Alert>{error}</Alert>
      {saved && <Alert kind="success">Saved.</Alert>}
      <div className="actions"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div>
    </form>
  );
}

export default function Profile() {
  const { me, refresh, signOut } = useSession();
  const save = async (body) => { await api('/profile', { method: 'PUT', body }); await refresh(); };
  return (
    <div className="narrow stack">
      <PageHead title="Profile" sub={`${ROLE_LABEL[me.user.role]} account · ${me.user.email}`}
        action={<button className="btn btn-outline btn-sm" onClick={signOut}>Log out</button>} />
      {me.user.role === 'teacher' ? <TeacherForm initial={me.profile} onSave={save} /> : <OrgForm />}
    </div>
  );
}
