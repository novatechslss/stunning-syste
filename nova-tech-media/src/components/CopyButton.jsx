import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useToast } from './Toast.jsx';

async function writeClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand && document.execCommand('copy');
  document.body.removeChild(ta);
  if (!ok) throw new Error('copy failed');
}

export default function CopyButton({ label, value, what, disabled, variant = 'ghost' }) {
  const [done, setDone] = useState(false);
  const { push } = useToast();
  const isDisabled = disabled || !value;
  async function onClick() {
    try {
      await writeClipboard(value);
      setDone(true);
      push(`${what || label} copied`, 'success');
      setTimeout(() => setDone(false), 1600);
    } catch {
      push('Copy failed. Select the text and copy it manually.', 'error');
    }
  }
  return (
    <button type="button" className={`btn btn-${variant}`} onClick={onClick} disabled={isDisabled}>
      {done ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      <span>{label}</span>
    </button>
  );
}
