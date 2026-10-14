import type { IdentifierType } from '../domain/models';
import { identifierTypeLabels } from '../domain/identifier-policy';
import { Help } from './Help';
const descriptions: Record<IdentifierType, string> = {
  UPC_A: 'UPC-A is a common product barcode with 12 numbers. Enter every number, including zeros at the start and the final checking digit.',
  EAN_13: 'EAN-13 is a product barcode with 13 numbers. Enter all 13, including zeros at the start and the final checking digit.',
  EAN_8: 'EAN-8 is a shorter product barcode with 8 numbers, often used on small packages. Enter all 8 numbers.',
  PLU: 'PLU means price look-up. It is a short code often used for loose produce. This app shows it as numbers to enter by hand, without making a barcode.',
  STORE_CODE: 'A number used by your store to identify a product. Check it at your register. It is shown as numbers to enter by hand.',
  OTHER: 'A code whose type is not yet known. Choose its actual type before marking it checked or using it at checkout.',
};
export function CodeType({ type }: { type: IdentifierType }) {
  return <span className="explained-term">{identifierTypeLabels[type]}<Help term={identifierTypeLabels[type]} explanation={descriptions[type]} /></span>;
}
