import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, useLoad } from '../api.js';
import { Loading, Empty, PageHead, Alert, useAction } from '../components/ui.jsx';
import TeacherForm from '../components/TeacherForm.jsx';
import VacancyCard from '../components/VacancyCard.jsx';

// Add a teacher, or view/edit one together with the vacancies they are eligible for.
export default function ManagedTeacher() {
  const { id } = useParams();
  const navigate = useNavigate();
  const teacher = useLoad(id ? `/teachers/${id}` : null);
  const eligible = useLoad(id ? `/vacancies?eligible=1&teacher_id=${id}` : null);
  const { busy, error, run } = useAction();

  const back = <div><Link to="/home" className="link small">← All teachers</Link></div>;

  if (!id) {
    const create = async (body) => {
      const t = await api('/teachers', { method: 'POST', body });
      navigate(`/teachers/${t.id}`, { replace: true });
    };
    return (
      <div className="narrow stack">
        {back}
        <PageHead title="Add a teacher" sub="Fill in the teacher's details. Vacancies they are eligible for will then appear in your Updates." />
        <TeacherForm onSave={create} saveLabel="Add teacher" />
      </div>
    );
  }

  const save = async (body) => { await api(`/teachers/${id}`, { method: 'PUT', body }); await eligible.reload(); };
  const remove = () => {
    if (window.confirm('Remove this teacher and their applications?')) run(async () => { await api(`/teachers/${id}`, { method: 'DELETE' }); navigate('/home', { replace: true }); });
  };

  return (
    <Loading state={teacher}>
      {(t) => (
        <div className="narrow stack">
          {back}
          <PageHead title={t.name} action={<button className="btn btn-ghost btn-sm danger" onClick={remove} disabled={busy}>Remove teacher</button>} />
          <Alert>{error}</Alert>
          <section className="stack">
            <h2>Eligible vacancies</h2>
            <Loading state={eligible}>
              {(rows) => rows.length
                ? <div className="grid">{rows.map((v) => <VacancyCard key={v.id} v={v} to={`/jobs/${v.id}?teacher_id=${id}`} />)}</div>
                : <Empty title="No matching vacancies right now">You will get an update when a school posts one that fits this teacher.</Empty>}
            </Loading>
          </section>
          <h2>Profile</h2>
          <TeacherForm key={t.id} initial={t} onSave={save} />
        </div>
      )}
    </Loading>
  );
}
