import { Link } from 'react-router-dom';
import { salaryText, ago, useSession } from '../api.js';

export function Requirements({ v, experience = true }) {
  const { meta } = useSession();
  const level = meta.levels.find((l) => l.id === v.min_level)?.label;
  const parts = [
    level && `${level} or higher`,
    v.teaching_qual,
    experience && (v.min_exp_years > 0 ? `${v.min_exp_years}+ yrs experience` : 'Freshers welcome'),
  ].filter(Boolean);
  return <>{parts.join(' · ') || 'No minimum qualification'}</>;
}

export default function VacancyCard({ v, to }) {
  return (
    <Link to={to ?? `/jobs/${v.id}`} className="card vacancy-card">
      <div className="vc-top">
        <div>
          <h3>{v.title}</h3>
          <p className="vc-school">{v.school_name}{v.school_board && <span className="muted"> · {v.school_board}</span>}</p>
        </div>
        {v.applied ? <span className="badge badge-applied">Applied</span>
          : v.eligible === true ? <span className="badge badge-eligible">Eligible</span>
          : v.eligible === false ? <span className="badge badge-muted">Not a match</span> : null}
      </div>
      <p className="vc-salary">{salaryText(v)}</p>
      <p className="muted small"><Requirements v={v} /></p>
      <p className="muted small vc-foot">
        <span>{v.school_address || 'Address not provided'}{v.distance_km != null && ` · ${v.distance_km} km away`}</span>
        <span>{ago(v.created_at)}</span>
      </p>
    </Link>
  );
}
