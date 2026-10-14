import JsBarcode from 'jsbarcode';
import type { Identifier } from '../domain/models';
import { identifierPresentation } from '../domain/identifier-policy';
const formats = { UPC_A: 'UPC', EAN_13: 'EAN13', EAN_8: 'EAN8' } as const;
/** The renderer checks policy itself, rather than relying on a UI visibility check. */
export function renderBarcodeSvg(identifier: Identifier, isDemo: boolean, hasConflict = false): string | null {
  if (!identifierPresentation(identifier, isDemo, hasConflict).canRenderBarcode) return null;
  const format = formats[identifier.type as keyof typeof formats];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, identifier.code, {
    format, width: 2, height: 100, displayValue: false,
    background: '#ffffff', lineColor: '#000000', marginLeft: 22, marginRight: 22, marginTop: 10, marginBottom: 10,
  });
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${identifier.type.replaceAll('_', '-')} barcode for ${identifier.code}`);
  return svg.outerHTML;
}
