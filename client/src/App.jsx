import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { api, getToken, setToken, Session } from './api.js';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import { Login, Register } from './pages/Auth.jsx';
import TeacherHome from './pages/TeacherHome.jsx';
import SchoolHome from './pages/SchoolHome.jsx';
import ManagerHome from './pages/ManagerHome.jsx';
import ManagedTeacher from './pages/ManagedTeacher.jsx';
import Jobs from './pages/Jobs.jsx';
import JobDetail from './pages/JobDetail.jsx';
import Applications from './pages/Applications.jsx';
import Updates from './pages/Updates.jsx';
import Profile from './pages/Profile.jsx';
import VacancyForm from './pages/VacancyForm.jsx';
import VacancyManage from './pages/VacancyManage.jsx';

const HOME = { teacher: TeacherHome, school: SchoolHome, agency: ManagerHome, college: ManagerHome };

export default function App() {
  const [meta, setMeta] = useState(null);
  const [me, setMe] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setMe(getToken() ? await api('/me') : null);
  }, []);

  useEffect(() => {
    Promise.all([api('/meta').then(setMeta), refresh().catch(() => setToken(null))])
      .catch((e) => setError(e.message))
      .finally(() => setReady(true));
  }, [refresh]);

  const signIn = async (token) => { setToken(token); await refresh(); };
  const signOut = () => { setToken(null); setMe(null); };

  if (!ready) return <p className="muted pad">Loading…</p>;
  if (error || !meta) return <div className="pad"><div className="alert alert-error">{error || 'Could not load the app.'}</div></div>;

  const role = me?.user.role;
  const Home = HOME[role];
  const seeker = role && role !== 'school';
  const manager = role === 'agency' || role === 'college';

  return (
    <Session.Provider value={{ meta, me, refresh, signIn, signOut }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={me ? <Navigate to="/home" replace /> : <Landing />} />
          <Route path="/login" element={me ? <Navigate to="/home" replace /> : <Login />} />
          <Route path="/register" element={me ? <Navigate to="/home" replace /> : <Register />} />
          {me ? (
            <Route element={<Layout />}>
              <Route path="/home" element={<Home />} />
              <Route path="/updates" element={<Updates />} />
              <Route path="/profile" element={<Profile />} />
              {seeker && <>
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/jobs/:id" element={<JobDetail />} />
                <Route path="/applications" element={<Applications />} />
              </>}
              {manager && <>
                <Route path="/teachers/new" element={<ManagedTeacher />} />
                <Route path="/teachers/:id" element={<ManagedTeacher />} />
              </>}
              {role === 'school' && <>
                <Route path="/vacancies/new" element={<VacancyForm />} />
                <Route path="/vacancies/:id" element={<VacancyManage />} />
                <Route path="/vacancies/:id/edit" element={<VacancyForm />} />
              </>}
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Route>
          ) : (
            <Route path="*" element={<Navigate to="/login" replace />} />
          )}
        </Routes>
      </BrowserRouter>
    </Session.Provider>
  );
}
