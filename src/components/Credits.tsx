export function Credits({ text, url }: { text?: string; url?: string }) {
  return <span className="credits">{text ?? 'Not recorded'}{url && <> · <a href={url} target="_blank" rel="noreferrer">Original source</a></>}</span>;
}
