import { NavLink, Link, Outlet } from 'react-router-dom';
import { useSession } from '../api.js';

const ICONS = {
  home: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z',
  search: 'M10.5 4a6.5 6.5 0 1 0 4 11.6l4.4 4.4 1.4-1.4-4.4-4.4A6.5 6.5 0 0 0 10.5 4Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z',
  doc: 'M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 8v2h8v-2H8Zm0 4v2h8v-2H8Zm0-8v2h5V7H8Z',
  bell: 'M12 3a6 6 0 0 0-6 6v4l-2 3v1h16v-1l-2-3V9a6 6 0 0 0-6-6Zm-2.5 16a2.5 2.5 0 0 0 5 0h-5Z',
  user: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 10c4.4 0 8 2 8 4.5V21H4v-2.5C4 16 7.600 14 12 14Z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z',
};
const Icon = ({ name }) => <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d={ICONS[name]} /></svg>;

const NAV = {
  teacher: [['/home', 'Home', 'home'], ['/jobs', 'Search jobs', 'search'], ['/applications', 'Applications', 'doc']],
  school: [['/home', 'Vacancies', 'home'], ['/vacancies/new', 'Post vacancy', 'plus']],
  agency: [['/home', 'Teachers', 'home'], ['/jobs', 'Search jobs', 'search'], ['/applications', 'Applications', 'doc']],
};
NAV.college = NAV.agency;

export const Logo = () => (
  <span className="logo"><img src="/icon.svg" alt="" width="28" height="28" />TeachConnect</span>
);

export default function Layout() {
  const { me } = useSession();
  const items = [...NAV[me.user.role], ['/updates', 'Updates', 'bell'], ['/profile', 'Profile', 'user']];
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/home" className="plain"><Logo /></Link>
        <nav className="nav" aria-label="Main">
          {items.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/home'}>
              <span className="nav-icon">
                <Icon name={icon} />
                {to === '/updates' && me.unread > 0 && <span className="dot" aria-label={`${me.unread} unread`}>{me.unread > 9 ? '9+' : me.unread}</span>}
              </span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="content"><Outlet /></main>
    </div>
  );
}
