import { useMemo, useState, type ReactNode } from 'react';
import type { Identifier, Source } from '../domain/models';
import { statusLabels } from '../domain/models';
import { identifierPresentation, identifierTypeLabels } from '../domain/identifier-policy';
import { CodeType } from './CodeType';
import { Credits } from './Credits';
import { plainMessage, displayDate } from '../ui/words';
import { renderBarcodeSvg } from '../barcode/render';
export function IdentifierCard({ identifier, source, isDemo, hasConflict = false, children }: { identifier: Identifier; source?: Source; isDemo: boolean; hasConflict?: boolean; children?: ReactNode }) {
  const presentation = identifierPresentation(identifier, isDemo, hasConflict);
  const [copyStatus, setCopyStatus] = useState('');
  const barcode = useMemo(() => {
    try { return { markup: renderBarcodeSvg(identifier, isDemo, hasConflict), failed: false }; }
    catch { return { markup: null, failed: true }; }
  }, [identifier, isDemo, hasConflict]);
  async function copyCode() {
    if (!identifierPresentation(identifier, isDemo, hasConflict).canCopy) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(identifier.code);
      setCopyStatus('Code copied.');
    } catch { setCopyStatus('Copy unavailable. Select the numeric code to copy it manually.'); }
  }
  return <article className={`identifier ${presentation.checkoutReady ? 'checkout-ready' : ''}`} aria-label={`${identifierTypeLabels[identifier.type]} code`}>
    <div className="identifier-heading"><strong><CodeType type={identifier.type} /></strong><span className="badge">{statusLabels[identifier.verificationStatus]}</span></div>
    <p className={presentation.canCopy ? 'checkout-code' : 'candidate-code'}>{identifier.code}</p>
    <p className="muted">{plainMessage(presentation.explanation)}</p>
    {presentation.checkoutReady && <p className="ready-label">Ready to use · Checked at register</p>}
    <p className={`validation-message ${presentation.validation.valid ? '' : 'invalid'}`}>{plainMessage(presentation.validation.message)}</p>
    {barcode.markup && <div className="barcode-artwork" dangerouslySetInnerHTML={{ __html: barcode.markup }} />}
    {barcode.failed && <p role="alert">The barcode could not be shown. You can type the checked code into the register.</p>}
    {presentation.canCopy && <>
      {!presentation.canRenderBarcode && <p className="muted">Type this code into the register by hand. It is not a barcode.</p>}
      <button className="copy-code" onClick={() => { void copyCode(); }}>Copy code</button>
      <p role="status" className="copy-status">{copyStatus}</p>
    </>}
    {identifier.verifiedAt && <p className="muted">Checked: {displayDate(identifier.verifiedAt)}{identifier.verificationMethod && ` · ${identifier.verificationMethod}`}</p>}
    <div className="source-credit">Where this came from: <Credits text={source?.attribution} url={source?.externalUrl} /></div>
    {children}
  </article>;
}
