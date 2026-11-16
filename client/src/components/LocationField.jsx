import { currentPosition } from '../api.js';
import { Field, Textarea, useAction, Alert } from './ui.jsx';

// Address plus an optional GPS pin captured from the device.
export default function LocationField({ form, label = 'Address' }) {
  const [value, setValue] = form;
  const { busy, error, run } = useAction();
  const hasPin = value.lat != null && value.lng != null;

  const locate = () => run(async () => {
    const { lat, lng } = await currentPosition();
    setValue((v) => ({ ...v, lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) }));
  });

  const d = 0.008;
  const map = hasPin &&
    `https://www.openstreetmap.org/export/embed.html?bbox=${value.lng - d},${value.lat - d},${value.lng + d},${value.lat + d}&layer=mapnik&marker=${value.lat},${value.lng}`;

  return (
    <div className="field wide">
      <Field label={label}>
        <Textarea form={form} name="address" rows={2} placeholder="House / street, area, city, state, PIN code" />
      </Field>
      <div className="location-row">
        <button type="button" className="btn btn-outline btn-sm" onClick={locate} disabled={busy}>
          {busy ? 'Getting location…' : hasPin ? 'Update GPS location' : 'Use my current GPS location'}
        </button>
        {hasPin && (
          <>
            <span className="muted small">📍 {value.lat}, {value.lng}</span>
            <button type="button" className="link small" onClick={() => setValue((v) => ({ ...v, lat: null, lng: null }))}>Remove</button>
          </>
        )}
      </div>
      <Alert>{error}</Alert>
      {map && <iframe className="map" title="Location on map" src={map} loading="lazy" />}
    </div>
  );
}
