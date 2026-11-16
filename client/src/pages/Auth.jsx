import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, useSession, ROLE_LABEL } from '../api.js';
import { Field, Input, Alert, useAction } from '../components/ui.jsx';
import { Logo } from '../components/Layout.jsx';

function AuthShell({ title, children, footer }) {
  return (
    <div className="auth">
      <Link to="/" className="plain"><Logo /></Link>
      <div className="card auth-card">
        <h1>{title}</h1>
        {children}
      </div>
      <p className="muted">{footer}</p>
    </div>
  );
}

export function Login() {
  const { signIn } = useSession();
  const form = useState({ email: '', password: '' });
  const { busy, error, run } = useAction();
  const submit = (e) => {
    e.preventDefault();
    run(async () => signIn((await api('/auth/login', { method: 'POST', body: form[0] })).token));
  };
  return (
    <AuthShell title="Log in" footer={<>New here? <Link to="/register">Create an account</Link></>}>
      <form onSubmit={submit} className="stack">
        <Field label="Email ID"><Input form={form} name="email" type="email" required autoComplete="email" /></Field>
        <Field label="Password"><Input form={form} name="password" type="password" required autoComplete="current-password" /></Field>
        <Alert>{error}</Alert>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
    </AuthShell>
  );
}

const NAME_LABEL = { teacher: 'Your full name', school: 'School name', agency: 'Agency name', college: 'College name' };

export function Register() {
  const { signIn } = useSession();
  const [params] = useSearchParams();
  const form = useState({ role: ROLE_LABEL[params.get('role')] ? params.get('role') : 'teacher', name: '', email: '', password: '' });
  const [value, setValue] = form;
  const { busy, error, run } = useAction();
  const submit = (e) => {
    e.preventDefault();
    run(async () => signIn((await api('/auth/register', { method: 'POST', body: value })).token));
  };
  return (
    <AuthShell title="Create your account" footer={<>Already registered? <Link to="/login">Log in</Link></>}>
      <form onSubmit={submit} className="stack">
        <div className="field">
          <span className="field-label">I am a</span>
          <div className="role-pick" role="radiogroup" aria-label="Account type">
            {Object.entries(ROLE_LABEL).map(([role, label]) => (
              <button type="button" key={role} role="radio" aria-checked={value.role === role}
                className={value.role === role ? 'on' : ''} onClick={() => setValue({ ...value, role })}>{label}</button>
            ))}
          </div>
        </div>
        <Field label={NAME_LABEL[value.role]}><Input form={form} name="name" required /></Field>
        <Field label="Email ID"><Input form={form} name="email" type="email" required autoComplete="email" /></Field>
        <Field label="Password" hint="At least 8 characters">
          <Input form={form} name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <Alert>{error}</Alert>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Sign up'}</button>
      </form>
    </AuthShell>
  );
}
