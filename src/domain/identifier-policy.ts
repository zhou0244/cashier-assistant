import type { Identifier, IdentifierType } from './models';
export const identifierTypeLabels: Record<IdentifierType, string> = {
  UPC_A: 'UPC-A', EAN_13: 'EAN-13', EAN_8: 'EAN-8', PLU: 'PLU', STORE_CODE: 'Store code', OTHER: 'Other code',
};
const lengths: Partial<Record<IdentifierType, number>> = { UPC_A: 12, EAN_13: 13, EAN_8: 8 };
export interface CodeValidation { valid: boolean; message: string }
/** Validate the exact stored string; never trim, pad, coerce or generate a check digit. */
export function validateIdentifier(code: string, type: IdentifierType): CodeValidation {
  if (code.length === 0 || /[^0-9]/.test(code)) return { valid: false, message: 'Code must contain ASCII digits only, without spaces.' };
  const length = lengths[type];
  if (length !== undefined) {
    if (code.length !== length) return { valid: false, message: `${identifierTypeLabels[type]} requires exactly ${length} digits, including the check digit.` };
    let sum = 0;
    for (let index = code.length - 2, weight = 3; index >= 0; index--, weight = weight === 3 ? 1 : 3) {
      sum += Number(code[index]) * weight;
    }
    if ((10 - sum % 10) % 10 !== Number(code.at(-1))) return { valid: false, message: 'Check digit does not match. Review the original code; it has not been corrected automatically.' };
    return { valid: true, message: 'Length and check digit valid. This does not prove product identity or register compatibility.' };
  }
  return { valid: true, message: 'Numeric format only. No UPC/EAN checksum or store compatibility is implied.' };
}
export interface IdentifierPresentation {
  validation: CodeValidation; canRenderBarcode: boolean; canCopy: boolean; checkoutReady: boolean; explanation: string;
}
export function identifierPresentation(identifier: Identifier, isDemo: boolean, hasConflict = false): IdentifierPresentation {
  const validation = validateIdentifier(identifier.code, identifier.type);
  const verified = identifier.verificationStatus === 'packaging_verified' || identifier.verificationStatus === 'pos_verified';
  const supportedType = identifier.type !== 'OTHER';
  const eligible = !isDemo && !hasConflict && identifier.isActive && verified && validation.valid && supportedType;
  let explanation: string;
  if (isDemo) explanation = 'Fictional candidate code — never use at checkout.';
  else if (hasConflict) explanation = 'Duplicate identifier association — resolve the conflicting product before checkout use.';
  else if (!identifier.isActive) explanation = 'Retired code — do not use at checkout.';
  else if (identifier.verificationStatus === 'rejected') explanation = 'Rejected code — do not use at checkout.';
  else if (!validation.valid) explanation = 'Invalid code — do not use at checkout, even if previously marked verified.';
  else if (!verified) explanation = 'Not checkout-ready. Requires manual review.';
  else if (!supportedType) explanation = 'Unknown code type — establish a supported identifier type before checkout use.';
  else if (identifier.verificationStatus === 'packaging_verified') explanation = 'Checked against packaging only. Register compatibility has not been verified.';
  else explanation = 'POS verified. Confirm the exact product before using your existing register.';
  return {
    validation, canCopy: eligible, checkoutReady: eligible && identifier.verificationStatus === 'pos_verified',
    canRenderBarcode: eligible && lengths[identifier.type] !== undefined, explanation,
  };
}
