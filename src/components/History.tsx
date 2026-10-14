import { useEffect, useState } from 'react';
import type { ChangeEvent, Source } from '../domain/models';
import type { CatalogRepository } from '../data/repository';
import { eventLabel, historyFields } from '../ui/history';
import { displayDate, plainMessage } from '../ui/words';
import { CodeType } from './CodeType';
import { Credits } from './Credits';
import { Help } from './Help';
export function History({ productId, store, sources }: { productId: string; store: CatalogRepository; sources: Source[] }) {
  const [events, setEvents] = useState<ChangeEvent[]>(); const [error, setError] = useState('');
  useEffect(() => { let active = true; store.getHistory(productId).then(history => { if (active) setEvents(history); }).catch(() => { if (active) setError('Past changes could not be opened. Try again.'); }); return () => { active = false; }; }, [productId, store]);
  return <section className="history"><h2>Change history <Help term="change history" explanation="Every edit keeps a copy of the old and new details, who or what the information came from, and your reason. Past entries cannot be changed or removed." /></h2><p className="muted">See what changed, where the details came from and why they were updated.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {!events && !error && <p role="status">Loading past changes…</p>}
    {events?.map(event => <details key={event.id}><summary>{eventLabel(event.eventType)} · {displayDate(event.timestamp)}</summary><p>{event.reason && plainMessage(event.reason)}</p><div className="history-snapshots">{([['Before', event.before], ['After', event.after]] as const).map(([label, value]) => <div key={label}><strong>{label}</strong><dl className="history-fields">{historyFields(value, sources).map((field, index) => <div key={`${field.label}:${index}`}><dt>{field.label}</dt><dd>{field.codeType ? <CodeType type={field.codeType} /> : field.source ? <Credits text={field.value} url={field.source.externalUrl} /> : field.value}</dd></div>)}</dl></div>)}</div></details>)}
    {events?.length === 0 && <p>No changes saved yet.</p>}
  </section>;
}
