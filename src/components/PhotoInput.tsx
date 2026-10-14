import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { preparePhoto } from '../photos/prepare';
export function PhotoInput({ value, onChange, onBusy, kind = 'product' }: { value?: string; onChange: (photo?: string) => void; onBusy: (busy: boolean) => void; kind?: 'product' | 'barcode' }) {
  const barcode = kind === 'barcode'; const title = barcode ? 'Barcode photo' : 'Add photo';
  const gallery = useRef<HTMLInputElement>(null); const camera = useRef<HTMLInputElement>(null);
  const active = useRef(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function select(file?: File) {
    if (!file) return;
    setError(''); setBusy(true); onBusy(true);
    try { const photo = await preparePhoto(file); if (active.current) onChange(photo); }
    catch (failure) { if (active.current) setError(failure instanceof Error ? failure.message : 'Could not add this photo.'); }
    finally { if (active.current) { setBusy(false); onBusy(false); } }
  }
  return <div className="photo-input" role="group" aria-label={title}>
    {barcode ? <h3>{title}</h3> : <h2>{title}</h2>}
    {value && <img className="photo-preview" src={value} alt={barcode ? 'Selected barcode photo' : 'Selected product photo'} />}
    <div className="actions">
      <button type="button" disabled={busy} aria-label={barcode ? 'Choose barcode photo from gallery' : undefined} onClick={() => gallery.current?.click()}><ImagePlus size={18} aria-hidden="true" />Choose from gallery</button>
      <button type="button" disabled={busy} aria-label={barcode ? 'Take barcode photo' : undefined} onClick={() => camera.current?.click()}><Camera size={18} aria-hidden="true" />Take photo</button>
      {value && <button type="button" disabled={busy} aria-label={barcode ? 'Remove barcode photo' : undefined} onClick={() => { setError(''); onChange(undefined); }}><Trash2 size={18} aria-hidden="true" />Remove photo</button>}
    </div>
    <input hidden ref={gallery} type="file" accept="image/*" aria-label={barcode ? 'Select barcode image from gallery' : 'Choose photo from gallery'} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void select(file); }} />
    <input hidden ref={camera} type="file" accept="image/*" capture="environment" aria-label={barcode ? 'Capture barcode image' : 'Take a product photo'} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void select(file); }} />
    {busy && <p role="status">Preparing photo…</p>}{error && <p role="alert" className="error">{error}</p>}
  </div>;
}
