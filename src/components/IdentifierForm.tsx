import { plainMessage } from '../ui/words';
import { CodeType } from './CodeType';
import { useState } from 'react';
import type { Identifier, Product, VerificationStatus } from '../domain/models';
import { statusLabels } from '../domain/models';
import { identifierTypeLabels, validateIdentifier } from '../domain/identifier-policy';
import { identifierConflicts, type IdentifierInput, type VerificationInput, type EvidenceInput } from '../domain/maintenance';
export type IdentifierAction = 'add' | 'correct' | 'verify' | 'retire';
export function IdentifierForm({ action, identifier, product, identifiers, products, onSave, onCancel }: {
  action: IdentifierAction; identifier?: Identifier; product: Product; identifiers: Identifier[]; products: Product[];
  onSave: (input: IdentifierInput, verification: VerificationInput) => Promise<void>; onCancel: () => void;
}) {
  const [code, setCode] = useState(identifier?.code ?? ''); const [type, setType] = useState<Identifier['type']>(identifier?.type ?? 'UPC_A');
  const [status, setStatus] = useState<VerificationStatus>('packaging_verified');
  const [source, setSource] = useState<EvidenceInput>({ type: action === 'verify' ? 'packaging' : 'manual', attribution: '' });
  const [reason, setReason] = useState(''); const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const validation = validateIdentifier(code, type);
  const conflicts = identifierConflicts({ id: identifier?.id ?? '', code, type }, identifiers);
  const verified = status === 'packaging_verified' || status === 'pos_verified';
  const title = { add: 'Add code', correct: 'Correct this code', verify: 'Check this code', retire: 'Stop using this code' }[action];
  return <section className="maintenance"><h1>{title}</h1><p>{product.name} · {product.brand}</p>
    <form onSubmit={async event => {
      event.preventDefault(); setError(''); setBusy(true);
      try { await onSave({ code, type, source, reason }, { status, source, reason, confirmed }); }
      catch (failure) { setError(failure instanceof Error ? plainMessage(failure.message) : 'Could not save this code.'); }
      finally { setBusy(false); }
    }}><fieldset disabled={busy}>
      {action === 'add' || action === 'correct' ? <>
        {identifier && <p className="notice">Original: <CodeType type={identifier.type} /> {identifier.code} · {statusLabels[identifier.verificationStatus]}. The new code will need checking. The old code stays in the change history.</p>}
        <label htmlFor="identifier-type">Code type<select id="identifier-type" value={type} onChange={event => setType(event.target.value as Identifier['type'])}>{Object.entries(identifierTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><p className="muted">Selected type: <CodeType type={type} /></p>
        <label htmlFor="identifier-code">Code number<input id="identifier-code" autoFocus inputMode="numeric" type="text" required value={code} onChange={event => setCode(event.target.value)} /></label>
        {code && <p className={validation.valid ? 'muted' : 'error'}>{plainMessage(validation.message)}</p>}
      </> : <div><CodeType type={type} /><p className="candidate-code">{code}</p></div>}
      {conflicts.length > 0 && <p role="alert" className="error">This code is already linked to: {conflicts.map(conflict => products.find(record => record.id === conflict.productId)?.name ?? 'Unknown product').join(', ')}. Check the existing products and stop using any incorrect link before adding or checking this code.</p>}
      {action === 'verify' && <>
        {product.isDemo && <p className="notice">Made-up examples cannot be marked as checked.</p>}
        <label htmlFor="verification-status">Check status<select id="verification-status" value={status} onChange={event => {
          const next = event.target.value as VerificationStatus; setStatus(next); setConfirmed(false); setSource({ ...source, type: next === 'packaging_verified' ? 'packaging' : 'manual' });
        }}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <p className="notice">Choose “Checked on package” after comparing the printed code and brand. Choose “Checked at register” only after confirming the register identifies that exact product. Online information and a passing barcode check cannot do this for you.</p>
        {verified && <label className="checkbox"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required />{status === 'packaging_verified' ? 'I checked the brand and printed code on the package.' : 'I independently confirmed this exact product and code at the existing register.'}</label>}
      </>}
      {action !== 'retire' && <>
        <label htmlFor="source-type">Where did you find it?<select id="source-type" value={source.type} onChange={event => setSource({ ...source, type: event.target.value as EvidenceInput['type'] })}><option value="manual">I checked it myself</option><option value="packaging">Product package</option><option value="authorized_reference">A reference I am allowed to use</option></select></label>
        <label htmlFor="source-description">Source details / who to credit<textarea id="source-description" required value={source.attribution} onChange={event => setSource({ ...source, attribution: event.target.value })} /></label>
        <label htmlFor="source-url">Source website link (optional)<input id="source-url" type="url" value={source.externalUrl ?? ''} onChange={event => setSource({ ...source, externalUrl: event.target.value })} /></label>
      </>}
      <label htmlFor="identifier-reason">Reason for change<textarea id="identifier-reason" required value={reason} onChange={event => setReason(event.target.value)} /></label>
      {action === 'retire' && <p className="notice">This code will no longer appear in search or be offered for checkout. The code and its past changes stay saved.</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="actions"><button className="primary" type="submit" disabled={(action === 'add' || action === 'correct') && (!validation.valid || conflicts.length > 0) || action === 'verify' && verified && (product.isDemo || !confirmed || conflicts.length > 0)}>{busy ? 'Saving…' : action === 'retire' ? 'Stop using code' : 'Save code'}</button><button type="button" onClick={onCancel}>Cancel</button></div>
    </fieldset></form>
  </section>;
}
