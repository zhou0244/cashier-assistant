export function storageErrorMessage(error?: unknown): string {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : '';
  const guidance = error instanceof Error && ['SecurityError', 'InvalidStateError'].includes(error.name)
    ? 'Check whether Safari allows this site to save data, then reload.'
    : 'Close other tabs for this app, then reload. If it still fails, share the error details below.';
  return `Your saved products could not be opened. ${guidance} Your saved data has not been cleared.${detail ? ` Details: ${detail}` : ''}`;
}
