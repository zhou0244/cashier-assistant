import { Help } from './Help';
import { plainMessage } from '../ui/words';
import { useState } from 'react';
import type { CatalogRepository } from '../data/repository';
import { MAX_BACKUP_BYTES, readBackupJson, type Backup, type ImportPlan } from '../imports/backup';
import type { Catalog } from '../domain/models';
export function Settings({ store, catalog, onImported }: { store: CatalogRepository; catalog: Catalog; onImported: (productId?: string) => Promise<void> }) {
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState<Backup>(); const [plan, setPlan] = useState<ImportPlan>();
  const [trusted, setTrusted] = useState(false); const [acknowledged, setAcknowledged] = useState(false);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(''); setMessage(''); try { await action(); } catch (failure) { setError(failure instanceof Error ? plainMessage(failure.message) : 'Action failed. Local catalog was not replaced.'); } finally { setBusy(false); }
  }
  return <section className="maintenance settings"><h1>Settings</h1>
    <p className="muted">Your products are saved on this device. Download a backup and keep it somewhere safe.</p>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}{busy && <p role="status">Working…</p>}
    <fieldset disabled={busy}><h2>Back up your products <Help term="backup file" explanation="A downloaded copy of your products, codes and past changes. It uses the JSON file format so this app can restore them later. Keep it outside your browser." /></h2><p className="muted">Saves all products, codes, sources, past changes, favourites and uploaded photos.</p>
      <button className="primary" onClick={() => { void run(async () => {
        const data = await store.exportBackup(); const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
        anchor.href = url; anchor.download = `cashier-assistant-${data.exportedAt.slice(0, 10)}.json`; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage('Backup download requested. Confirm the file was saved.');
      }); }}>Download backup</button>
      <label htmlFor="backup-file">Choose a backup file to restore<input id="backup-file" type="file" accept=".json,application/json" onChange={event => {
        const file = event.target.files?.[0]; setBackup(undefined); setPlan(undefined); setAcknowledged(false); setTrusted(false); event.target.value = '';
        if (file) void run(async () => {
          if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup exceeds the 50 MB personal-import limit.');
          const parsed = readBackupJson(await file.text()); const preview = await store.previewBackup(parsed, false); setBackup(parsed); setPlan(preview);
        });
      }} /></label>
      {backup && <>
        <label className="checkbox"><input type="checkbox" checked={trusted} onChange={event => {
          const value = event.target.checked; setTrusted(value); setAcknowledged(false); setPlan(undefined);
          void run(async () => setPlan(await store.previewBackup(backup, value)));
        }} />This is my own backup. Keep the checks I recorded earlier, where the codes are still valid.</label>
        <p className="notice">Unless this is your own backup, added codes need checking again. Earlier checks stay in the history. Your existing edits will not be replaced. Your own backup can restore edited examples over unchanged starting examples, but they still cannot be used at checkout.</p>
        {plan && <div className="import-preview"><h3>What will be added</h3>
          <p>{plan.additions.categories.length} new groups · {plan.additions.products.length} new products · {plan.additions.identifiers.length} new codes · {plan.additions.events.length} past changes · {plan.skipped} already saved and left unchanged.</p>
          {plan.demoProducts.length + plan.demoIdentifiers.length > 0 && <p>{plan.demoProducts.length} example products and {plan.demoIdentifiers.length} example codes restored over unchanged starting examples.</p>}
          {plan.errors.map((issue, index) => <p key={index} className="error">{plainMessage(issue)}</p>)}{plan.warnings.map((issue, index) => <p key={index} className="notice">{plainMessage(issue)}</p>)}
          <label className="checkbox"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />I checked what will be added and where this backup came from.</label>
          <button className="primary" disabled={!acknowledged || plan.errors.length > 0} onClick={() => { void run(async () => {
            await store.importBackup(backup, trusted, acknowledged); await onImported(); setBackup(undefined); setPlan(undefined); setMessage('Backup added. Check any new codes before checkout.');
          }); }}>Add from this backup</button>
        </div>}
      </>}
    </fieldset>
  </section>;
}
