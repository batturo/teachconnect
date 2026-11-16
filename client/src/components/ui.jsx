import { useState } from 'react';
import { STATUS_LABEL } from '../api.js';

export function Field({ label, hint, children, wide }) {
  return (
    <label className={`field${wide ? ' wide' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

// Text input bound to form state: <Input form={[form, setForm]} name="mobile" />
export function Input({ form: [form, setForm], name, ...props }) {
  return <input value={form[name] ?? ''} onChange={(e) => setForm({ ...form, [name]: e.target.value })} {...props} />;
}
export function Textarea({ form: [form, setForm], name, rows = 3, ...props }) {
  return <textarea rows={rows} value={form[name] ?? ''} onChange={(e) => setForm({ ...form, [name]: e.target.value })} {...props} />;
}

export const Badge = ({ status }) => <span className={`badge badge-${status}`}>{STATUS_LABEL[status] ?? status}</span>;

export function Alert({ kind = 'error', children }) {
  return children ? <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div> : null;
}

export function Loading({ state, children }) {
  if (state.error) return <Alert>{state.error}</Alert>;
  if (!state.data) return <p className="muted pad">Loading…</p>;
  return children(state.data);
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

// Runs an async action, tracking busy/error state for a button or form.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn) => {
    setBusy(true); setError('');
    try { return await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return { busy, error, run };
}

export function PageHead({ title, sub, action }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {action}
    </header>
  );
}
