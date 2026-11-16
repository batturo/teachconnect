import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

const BASE = (import.meta.env.VITE_API_URL || '') + '/api';
const TOKEN_KEY = 'teachconnect.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body && { 'Content-Type': 'application/json' }),
        ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
      },
      body: body && JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the server. Check your internet connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && getToken() && !path.startsWith('/auth/')) {
    setToken(null);
    window.location.assign('/login');
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

// Load data for a screen. Returns { data, error, loading, reload }.
export function useLoad(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const reload = useCallback(() => {
    if (!path) return setState({ data: null, error: null, loading: false });
    setState((s) => ({ ...s, loading: true }));
    return api(path)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((e) => setState({ data: null, error: e.message, loading: false }));
  }, [path]);
  useEffect(() => { reload(); }, [reload, ...deps]);
  return { ...state, reload };
}

export const Session = createContext(null);
export const useSession = () => useContext(Session);

// GPS position from the device: native plugin inside the mobile apps, browser API on the website.
export async function currentPosition() {
  if (Capacitor.isNativePlatform()) {
    const perm = await Geolocation.requestPermissions();
    if (perm.location === 'denied') throw new Error('Location permission was denied. Enable it in Settings.');
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  }
  if (!navigator.geolocation) throw new Error('This device does not support GPS location.');
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.code === 1 ? 'Location permission was denied.' : 'Could not get your location. Please try again.')),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

// ---------- formatting ----------
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export function salaryText(v) {
  const { salary_min: a, salary_max: b } = v;
  if (a == null && b == null) return 'Salary not disclosed';
  if (a != null && b != null && a !== b) return `${inr.format(a)} – ${inr.format(b)} / month`;
  return `${inr.format(a ?? b)} / month`;
}
export const dateText = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const dateTimeText = (iso) =>
  new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
export function ago(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  if (mins < 43200) return `${Math.round(mins / 1440)} d ago`;
  return dateText(iso);
}

export const ROLE_LABEL = { teacher: 'Teacher', school: 'School', agency: 'Work Agency', college: 'College' };
export const STATUS_LABEL = {
  applied: 'Applied', shortlisted: 'Shortlisted', interview_scheduled: 'Interview scheduled',
  hired: 'Selected', rejected: 'Not selected',
  active: 'Active', pending_verification: 'Needs verification', outdated: 'Outdated', closed: 'Closed',
};
