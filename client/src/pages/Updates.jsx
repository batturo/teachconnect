import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, useLoad, useSession, ago } from '../api.js';
import { Loading, Empty, PageHead } from '../components/ui.jsx';

export default function Updates() {
  const { me, refresh } = useSession();
  const state = useLoad('/notifications');
  const isSchool = me.user.role === 'school';

  // Opening the page marks everything as read (the list keeps its "new" markers until reloaded).
  useEffect(() => {
    if (state.data?.some((n) => !n.is_read)) api('/notifications/read', { method: 'POST' }).then(refresh).catch(() => {});
  }, [state.data, refresh]);

  const link = (n) => !n.vacancy_id ? null
    : isSchool ? `/vacancies/${n.vacancy_id}`
    : `/jobs/${n.vacancy_id}${n.teacher_id ? `?teacher_id=${n.teacher_id}` : ''}`;

  return (
    <>
      <PageHead title="Updates" sub={isSchool ? 'Applications and reminders about your vacancies.' : 'New vacancies you are eligible for, and news on your applications.'} />
      <Loading state={state}>
        {(rows) => rows.length ? (
          <ul className="card list updates">
            {rows.map((n) => {
              const body = (
                <>
                  <span className={`update-dot type-${n.type}`} />
                  <div>
                    <strong>{n.title}</strong>
                    {n.body && <div className="muted small">{n.body}</div>}
                    <div className="muted small">{ago(n.created_at)}</div>
                  </div>
                </>
              );
              return (
                <li key={n.id} className={n.is_read ? '' : 'unread'}>
                  {link(n) ? <Link to={link(n)} className="update">{body}</Link> : <div className="update">{body}</div>}
                </li>
              );
            })}
          </ul>
        ) : <Empty title="No updates yet">{isSchool ? 'You will be told here when teachers apply.' : 'When a school posts a vacancy that fits the profile, it shows up here.'}</Empty>}
      </Loading>
    </>
  );
}
