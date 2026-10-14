import { CircleHelp } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';
export function Help({ term, explanation }: { term: string; explanation: string }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState({ left: 16, top: 16 });
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || focused || pinned;
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const target = trigger.current?.getBoundingClientRect(); const tip = bubble.current?.getBoundingClientRect();
      if (!target || !tip) return;
      const left = Math.max(16, Math.min(target.left, window.innerWidth - tip.width - 16));
      const below = target.bottom + 8;
      const top = below + tip.height <= window.innerHeight - 16 ? below : Math.max(16, target.top - tip.height - 8);
      setPosition({ left, top });
    };
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, explanation]);
  return <span className="help" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
    <button ref={trigger} type="button" className="help-trigger" aria-label={`Explain ${term}`} aria-expanded={open} aria-describedby={open ? id : undefined}
      onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setPinned(false); }}
      onClick={() => { setPinned(!pinned); setHovered(false); setFocused(false); }}
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setHovered(false); setFocused(false); setPinned(false); } }}><CircleHelp size={20} aria-hidden="true" /></button>
    {open && <span ref={bubble} id={id} role="tooltip" className="help-bubble" style={position}>{explanation}</span>}
  </span>;
}
