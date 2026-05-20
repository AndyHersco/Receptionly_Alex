import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { STAFF, STATUS } from './data';
import { I } from './icons';

// Shared UI primitives — buttons, cards, badges, etc.

export function cx(...args) {return args.filter(Boolean).join(' ');}

// Button — the single source of truth for every clickable action in the app.
// Variants:
//   accent     primary call-to-action (green) — Save, Add, Confirm, Continue
//   primary    dark/ink — secondary CTAs, segmented "active" states
//   secondary  white w/ border — Cancel and other neutral actions
//   ghost      bare text — low-emphasis Cancel / Back
//   danger     destructive (rose) — Delete, Remove, Cancel appointment
//   softAccent muted accent — supporting accent actions
// Sizes:
//   sm  h-8  / 13px   — inline table/row actions, dense toolbars
//   md  h-9  / 13.5px — default
//   lg  h-10 / 14px   — modal action buttons, primary page CTAs
export function Button({ children, variant = 'primary', size = 'md', className = '', style, ...props }) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition leading-none whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'h-8 px-3 text-[13px]', md: 'h-9 px-3.5 text-[13.5px]', lg: 'h-10 px-4 text-[14px]' };
  const variants = {
    primary: 'bg-ink text-white hover:bg-[#2a2722] active:bg-[#0f0e0c]',
    accent: 'bg-accent text-white hover:bg-[#36513a] active:bg-[#2A3F2D]',
    secondary: 'bg-white text-ink border border-line2 hover:bg-bg hover:border-ink2/40',
    ghost: 'text-ink2 hover:text-ink hover:bg-line/60',
    danger: 'bg-rose text-white hover:bg-[#a04457] active:bg-[#8a3a4a]',
    softAccent: 'bg-accentSoft text-accentInk hover:bg-[#dce6da]'
  };
  return <button className={cx(base, sizes[size], variants[variant], className)} style={style} {...props}>{children}</button>;
}

// CopyButton — copies `value` to the clipboard and flips the label to "Copied"
// for ~1.4s. Falls back to a hidden textarea + execCommand on environments
// without navigator.clipboard. All copy affordances across the app go
// through this so behavior and styling stay consistent.
export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  size = 'md',
  variant = 'secondary',
  className = '',
  iconSize,
  showToastOnCopy = false,
  ...rest
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);
  const isz = iconSize != null ? iconSize : size === 'sm' ? 13 : 14;
  function doCopy(e) {
    e && e.preventDefault && e.preventDefault();
    const text = typeof value === 'function' ? value() : value == null ? '' : String(value);
    const finish = () => {
      setCopied(true);
      if (showToastOnCopy) showToast({ title: copiedLabel, body: text });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(finish, () => {
        // Fall back if clipboard API rejects (e.g. iframe permission).
        legacyCopy(text);
        finish();
      });
    } else {
      legacyCopy(text);
      finish();
    }
  }
  useEffect(() => () => {if (timerRef.current) clearTimeout(timerRef.current);}, []);
  return (
    <Button variant={variant} size={size} className={className} onClick={doCopy} aria-live="polite" {...rest}>
      {copied ?
      <><I.Check size={isz} /> {copiedLabel}</> :
      <><I.Copy size={isz} /> {label}</>}
    </Button>);

}

export function legacyCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch (e) {/* swallow */}
}

export function Card({ children, className = '', ...rest }) {
  return <div className={cx('bg-surface rounded-xl2 border border-line shadow-card', className)} {...rest}>{children}</div>;
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'bg-line text-ink2',
    accent: 'bg-accentSoft text-accentInk',
    warm: 'bg-warmSoft text-[#7A3F1F]',
    rose: 'bg-roseSoft text-[#7A2A3D]',
    amber: 'bg-amberSoft text-[#6B4D00]',
    outline: 'bg-white border border-line2 text-ink2'
  };
  return <span className={cx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-medium', tones[tone], className)}>{children}</span>;
}

export function StatusPill({ status }) {
  const s = STATUS[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11.5px] font-medium" style={{ background: s.soft, color: s.ink }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>);

}

export function StaffAvatar({ staff, size = 28, ring = false }) {
  const s = typeof staff === 'string' ? STAFF.find((x) => x.id === staff) : staff;
  if (!s) return null;
  const baseClass = cx('rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 overflow-hidden', ring && 'ring-2 ring-white');
  if (s.avatar) {
    return (
      <img
        src={s.avatar}
        alt={s.name}
        title={s.name}
        className={baseClass}
        style={{ width: size, height: size, objectFit: 'cover', background: s.color }} />);


  }
  const style = { width: size, height: size, background: s.color, fontSize: Math.max(10, size * 0.38) };
  return (
    <div className={baseClass}
    style={style} title={s.name}>{s.initials}</div>);

}

// ─────────────────────────────────────────────────────────────────
// Logo / image upload primitives — shared by onboarding, settings,
// and the employee profile editor. Centralised so file-type and
// max-size limits stay consistent across the app.
// ─────────────────────────────────────────────────────────────────
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
export const ACCEPTED_IMAGE_EXTS = '.png,.jpg,.jpeg,.svg,.webp';
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateImageFile(file) {
  if (!file) return 'No file selected.';
  // Some SVGs come through as empty/octet-stream — fall back to extension.
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const okType = ACCEPTED_IMAGE_TYPES.includes(type);
  const okExt = /\.(png|jpe?g|svg|webp)$/i.test(name);
  if (!okType && !okExt) return 'Please use a PNG, JPG, SVG, or WEBP file.';
  if (file.size > MAX_IMAGE_BYTES) return 'File is too large — max size is 10 MB.';
  return null;
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Could not read the file.'));
    fr.onload = () => resolve(String(fr.result || ''));
    fr.readAsDataURL(file);
  });
}

// Display helper: renders the brand logo if present, otherwise falls
// back to the monogram square that the app used before logos existed.
export function BusinessMark({ logo, monogram, size = 32, rounded = 'md', className = '', alt = '' }) {
  const radius = rounded === 'full' ? '9999px' : '8px';
  const style = { width: size, height: size, borderRadius: radius };
  if (logo) {
    return (
      <img
        src={logo}
        alt={alt}
        className={cx('object-cover flex-shrink-0 bg-bg border border-line/60', className)}
        style={style} />);


  }
  return (
    <div
      className={cx('bg-ink text-white font-serif flex items-center justify-center flex-shrink-0', className)}
      style={{ ...style, fontSize: Math.max(10, size * 0.42) }}>

      {monogram}
    </div>);

}

// Editable logo control. Click anywhere on the swatch to pick a file;
// drag-and-drop is supported too. The parent owns the value (data URL
// or null) and the dirty/save state.
export function LogoUploader({
  value,
  onChange,
  onRemove,
  size = 88,
  shape = 'rounded', // 'rounded' | 'round'
  placeholderLabel = 'Add logo',
  helper })
{
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);

  async function handleFile(file) {
    const err = validateImageFile(file);
    if (err) {setError(err);return;}
    try {
      const data = await readFileAsDataURL(file);
      setError('');
      onChange && onChange(data, file);
    } catch (e) {
      setError(e.message || 'Could not read the file.');
    }
  }

  function onPick(e) {
    const f = e.target.files && e.target.files[0];
    if (f) handleFile(f);
    e.target.value = '';
  }
  function onDrop(e) {
    e.preventDefault();setDrag(false);
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  const radius = shape === 'round' ? '9999px' : '14px';
  return (
    <div className="flex items-start gap-4">
      <div
        onClick={() => inputRef.current && inputRef.current.click()}
        onKeyDown={(e) => {if (e.key === 'Enter' || e.key === ' ') {e.preventDefault();inputRef.current && inputRef.current.click();}}}
        onDragOver={(e) => {e.preventDefault();setDrag(true);}}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-label={value ? 'Replace logo' : 'Upload logo'}
        className={cx(
          'relative group cursor-pointer overflow-hidden border bg-bg/60 flex items-center justify-center flex-shrink-0 transition',
          drag ? 'border-accent ring-2 ring-accent/30' : value ? 'border-line2 hover:border-ink2/50' : 'border-dashed border-line2 hover:border-ink2/50'
        )}
        style={{ width: size, height: size, borderRadius: radius }}>

        {value ?
        <img src={value} alt="Logo preview" className="w-full h-full object-cover" /> :

        <div className="flex flex-col items-center justify-center text-muted text-center px-2 pointer-events-none">
            <I.Image size={Math.max(14, size * 0.28)} />
            <span className="text-[10px] mt-1 font-medium tracking-wide uppercase">{placeholderLabel}</span>
          </div>
        }
        <span className="absolute inset-0 bg-ink/60 text-white text-[11.5px] font-medium flex items-center justify-center opacity-0 group-hover:opacity-100 transition pointer-events-none">
          {value ? 'Replace' : 'Upload'}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current && inputRef.current.click()}>
            <I.Image size={13} /> {value ? 'Replace logo' : 'Upload logo'}
          </Button>
          {value && onRemove &&
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => {setError('');onRemove();}}>
            <I.Trash size={13} /> Remove
          </Button>
          }
        </div>
        <p className="text-[11.5px] text-muted leading-relaxed">
          {helper || 'PNG, JPG, SVG, or WEBP up to 10 MB. Square images look best — your logo appears as a small rounded icon.'}
        </p>
        {error && <p className="text-[11.5px] text-rose mt-1.5 leading-relaxed">{error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_EXTS}
        onChange={onPick}
        className="hidden" />

    </div>);

}

export function CustomerAvatar({ name, size = 28 }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('');
  const style = { width: size, height: size, background: '#EDE9E0', color: '#5C5852', fontSize: Math.max(10, size * 0.38) };
  return <div className="rounded-full flex items-center justify-center font-semibold flex-shrink-0" style={style}>{initials}</div>;
}

export function SectionHeader({ eyebrow, title, subtitle, right, className = '' }) {
  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-4 mb-5', className)}>
      <div>
        {eyebrow && <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium mb-2">{eyebrow}</div>}
        <h1 className="font-serif text-[40px] leading-[1.05] text-ink">{title}</h1>
        {subtitle && <p className="text-[14px] text-ink2 mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {right}
    </div>);

}

export function EmptyState({ title, body, action }) {
  return (
    <div className="text-center py-16 px-6 border border-dashed border-line2 rounded-xl2 bg-white/40">
      <div className="font-serif text-2xl text-ink mb-1.5">{title}</div>
      <div className="text-sm text-ink2 max-w-md mx-auto mb-4">{body}</div>
      {action}
    </div>);

}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none" data-dirty-trigger="toggle">
      <span className={cx('w-9 h-5 rounded-full p-0.5 transition relative', checked ? 'bg-accent' : 'bg-line2')}
      onClick={() => onChange(!checked)}>
        <span className={cx('block w-4 h-4 bg-white rounded-full shadow-sm transition transform', checked && 'translate-x-4')} />
      </span>
      {label && <span className="text-sm text-ink">{label}</span>}
    </label>);

}

export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={cx('inline-flex p-1 bg-line/60 rounded-lg', className)}>
      {tabs.map((t) =>
      <button key={t.value} onClick={() => onChange(t.value)}
      className={cx('px-3 h-7 rounded-md text-[13px] font-medium transition',
      value === t.value ? 'bg-white text-ink shadow-card' : 'text-ink2 hover:text-ink')}>
          {t.label}
        </button>
      )}
    </div>);

}

export function Field({ label, hint, children, optional, plain, error }) {
  return (
    <label className={cx('block', error && 'field-error')} style={{ padding: "0px" }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12.5px] font-medium text-ink">
          {label}
          {!plain && (optional ?
          <span className="text-muted font-normal"> (optional)</span> :
          <span className="text-rose ml-0.5">*</span>)}
        </span>
        {hint && !error && <span className="text-[11.5px] text-muted">{hint}</span>}
      </div>
      {children}
      {error &&
      <div className="mt-1.5 flex items-center gap-1 text-[11.5px] text-rose font-medium">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          {error}
        </div>
      }
    </label>);

}

export function Modal({ open, onClose, children, maxWidth = 'max-w-2xl' }) {
  useEffect(() => {
    function onKey(e) {if (e.key === 'Escape') onClose && onClose();}
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 fadein" style={{ background: 'rgba(20,18,15,.32)' }} onClick={onClose}>
      <div className={cx('relative w-full max-h-[90vh] overflow-auto bg-surface rounded-2xl shadow-pop border border-line', maxWidth)}
      onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>);

}

export function Drawer({ open, onClose, children, width = 440 }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 fadein" style={{ background: 'rgba(20,18,15,.32)' }} onClick={onClose}>
      <div className="absolute right-0 top-0 h-full bg-surface border-l border-line shadow-pop overflow-auto"
      style={{ width }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────────────────
// Toast — minimal global notification. Call `showToast({title, body?})` from
// anywhere; mount <ToastHost /> once at the app root so notifications render.
// ─────────────────────────────────────────────────────────────────────────
export function showToast(opts) {
  const detail = typeof opts === 'string' ? { title: opts } : opts || {};
  window.dispatchEvent(new CustomEvent('__toast', { detail }));
}

export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    function onToast(e) {
      const id = 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const item = { id, title: '', body: '', tone: 'success', ...(e.detail || {}) };
      setItems((prev) => [...prev, item]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 3600);
    }
    window.addEventListener('__toast', onToast);
    return () => window.removeEventListener('__toast', onToast);
  }, []);
  if (items.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[80] flex flex-col gap-2 pointer-events-none">
      {items.map((t) => {
        const isError = t.tone === 'error';
        return (
          <div
            key={t.id}
            className="pointer-events-auto bg-surface rounded-xl border border-line shadow-pop px-4 py-3 flex items-start gap-3 min-w-[280px] max-w-[380px] fadein">

            <div className={cx(
              'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
              isError ? 'bg-roseSoft text-rose' : 'bg-accentSoft text-accent'
            )}>
              {isError ? <I.X size={14} strokeWidth={2.5} /> : <I.Check size={14} strokeWidth={2.5} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-medium text-ink leading-tight">{t.title}</div>
              {t.body && <div className="text-[12.5px] text-ink2 mt-0.5 leading-snug">{t.body}</div>}
            </div>
          </div>
        );
      })}
    </div>);

}

Object.assign(window, { cx, Button, Card, Badge, StatusPill, StaffAvatar, CustomerAvatar, SectionHeader, EmptyState, Toggle, Tabs, Field, Modal, Drawer, TimePicker, showToast, ToastHost, BusinessMark, LogoUploader, validateImageFile, readFileAsDataURL, MAX_IMAGE_BYTES, ACCEPTED_IMAGE_EXTS });

// ─────────────────────────────────────────────────────────────────────────
// formatPhoneInput — progressive (123) 456-7890 formatter.
// Strips non-digits, caps at 10, and rebuilds the parens/space/dash markup
// so it can be called on every keystroke. Returns '' for empty input so the
// placeholder stays visible.
//
// isValidPhone — true once exactly 10 digits have been entered.
// ─────────────────────────────────────────────────────────────────────────
export function formatPhoneInput(input) {
  const digits = String(input || '').replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length < 4) return '(' + digits;
  if (digits.length < 7) return '(' + digits.slice(0, 3) + ') ' + digits.slice(3);
  return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
}
export function isValidPhone(input) {
  return /^\d{10}$/.test(String(input || '').replace(/\D/g, ''));
}
Object.assign(window, { formatPhoneInput, isValidPhone });

// ─────────────────────────────────────────────────────────────────────────
// DatePill + DatePickerPopover — calendar-icon trigger button that opens a
// styled month-grid date picker. Used by the admin and employee Calendar
// pages. Mon-first to match the app's week convention.
// ─────────────────────────────────────────────────────────────────────────

export function DatePill({ date, onChange, isToday, label, className = '' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e) {if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);}
    function onKey(e) {if (e.key === 'Escape') setOpen(false);}
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const displayLabel = label || date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  return (
    <div ref={wrapRef} className={cx('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cx(
          'h-9 px-3 inline-flex items-center gap-2 rounded-lg bg-surface border transition text-[13px] text-ink font-medium',
          open ? 'border-line2 ring-2 ring-accent/15' : 'border-line hover:border-line2'
        )}>
        <I.Calendar size={14} className="text-ink2" />
        <span>{displayLabel}</span>
        {isToday && <span className="ml-1 text-[10.5px] uppercase tracking-wider text-accent">Today</span>}
      </button>
      {open &&
      <DatePickerPopover
        date={date}
        anchorRef={triggerRef}
        onPick={(d) => {onChange(d);setOpen(false);}} />

      }
    </div>);

}

export function DatePickerPopover({ date, onPick, minDate, maxDate, align = 'right', anchorRef }) {
  // Anchor month-view on the selected date when one is set; otherwise on today.
  const anchor = date instanceof Date ? date : new Date();
  const [view, setView] = useState(() => new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  function prevMonth() {setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1));}
  function nextMonth() {setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1));}

  // ──────────────────────────────────────────────────────────────
  // Viewport-aware positioning. When an anchorRef is supplied, the
  // popover is rendered with position: fixed and pinned to the
  // trigger's bounding rect — this escapes any parent overflow
  // (cards, modals, drawers) and flips above/clamps to viewport
  // when there isn't room below. Falls back to absolute positioning
  // for any legacy callers that don't pass an anchorRef.
  // ──────────────────────────────────────────────────────────────
  const POP_W = 300;
  const POP_H_EST = 360;  // approximate full height for flip calc
  const MARGIN = 8;
  const [coord, setCoord] = useState(null);
  const popRef = useRef(null);

  useEffect(() => {
    if (!anchorRef) return;
    function compute() {
      const trig = anchorRef.current;
      if (!trig) return;
      const r = trig.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Mobile: center horizontally for narrow viewports.
      const w = Math.min(POP_W, vw - MARGIN * 2);
      let left;
      if (vw < 360 + MARGIN * 2) {
        left = Math.max(MARGIN, (vw - w) / 2);
      } else if (align === 'right') {
        left = r.right - w;
        if (left < MARGIN) left = r.left;
      } else {
        left = r.left;
        if (left + w > vw - MARGIN) left = r.right - w;
      }
      left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN));

      // Prefer below; flip above when there isn't room; clamp to viewport.
      const popH = popRef.current ? popRef.current.offsetHeight : POP_H_EST;
      const spaceBelow = vh - r.bottom - MARGIN;
      const spaceAbove = r.top - MARGIN;
      let top;
      if (spaceBelow >= popH + MARGIN || spaceBelow >= spaceAbove) {
        top = r.bottom + MARGIN;
        // If even the below path overflows, clamp upward into viewport.
        if (top + popH > vh - MARGIN) top = Math.max(MARGIN, vh - popH - MARGIN);
      } else {
        top = r.top - popH - MARGIN;
        if (top < MARGIN) top = Math.max(MARGIN, vh - popH - MARGIN);
      }
      setCoord({ top, left, width: w });
    }
    compute();
    // Recompute on scroll (any scroll container) and resize so the popover
    // tracks the trigger if the user scrolls the underlying page.
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [anchorRef, align]);

  // Build 6×7 grid, Monday-first.
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);gridStart.setDate(first.getDate() - startOffset);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);d.setDate(gridStart.getDate() + i);return d;
  });

  const dows = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const today = new Date();today.setHours(0, 0, 0, 0);
  const sel = date instanceof Date ? (() => { const s = new Date(date); s.setHours(0,0,0,0); return s; })() : null;
  const minD = minDate instanceof Date ? (() => { const m = new Date(minDate); m.setHours(0,0,0,0); return m; })() : null;
  const maxD = maxDate instanceof Date ? (() => { const m = new Date(maxDate); m.setHours(0,0,0,0); return m; })() : null;

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  }

  function isDisabled(d) {
    const dd = new Date(d); dd.setHours(0,0,0,0);
    if (minD && dd < minD) return true;
    if (maxD && dd > maxD) return true;
    return false;
  }

  // Fixed (anchored) when we have an anchorRef + computed coord; otherwise
  // fall back to the legacy absolute placement.
  const usingFixed = !!anchorRef;
  const wrapperStyle = usingFixed
    ? {
        position: 'fixed',
        top: coord ? coord.top : -9999,
        left: coord ? coord.left : -9999,
        width: coord ? coord.width : POP_W,
        // Hide until measured to avoid a one-frame flash at the wrong spot.
        visibility: coord ? 'visible' : 'hidden',
        zIndex: 9999,
      }
    : { width: POP_W };

  return (
    <div
      ref={popRef}
      style={wrapperStyle}
      className={cx(
        'bg-surface rounded-xl2 border border-line shadow-pop p-4 fadein',
        !usingFixed && cx('absolute top-full mt-2 z-50', align === 'left' ? 'left-0' : 'right-0')
      )}>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          aria-label="Previous month"
          className="h-7 w-7 rounded-md inline-flex items-center justify-center text-ink2 hover:text-ink hover:bg-bg/70 transition">
          <I.ChevronLeft size={14} />
        </button>
        <div className="text-[13.5px] font-medium text-ink">
          {view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <button
          type="button"
          onClick={nextMonth}
          aria-label="Next month"
          className="h-7 w-7 rounded-md inline-flex items-center justify-center text-ink2 hover:text-ink hover:bg-bg/70 transition">
          <I.ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {dows.map((d) =>
        <div key={d} className="text-[10.5px] uppercase tracking-wider text-muted text-center py-1">{d}</div>
        )}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === view.getMonth();
          const isT = sameDay(d, today);
          const isS = sel && sameDay(d, sel);
          const dis = isDisabled(d);
          return (
            <button
              key={i}
              type="button"
              disabled={dis}
              onClick={() => !dis && onPick(d)}
              className={cx(
                'h-9 rounded-md text-[13px] tabular-nums transition inline-flex items-center justify-center',
                dis ?
                'text-muted/30 cursor-not-allowed' :
                isS ?
                'bg-accent text-white font-semibold' :
                isT ?
                'text-accent font-semibold ring-1 ring-accent/40 hover:bg-accentSoft/50' :
                inMonth ?
                'text-ink hover:bg-bg/70' :
                'text-muted/50 hover:bg-bg/40'
              )}>
              {d.getDate()}
            </button>);

        })}
      </div>
      <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
        <button
          type="button"
          onClick={() => onPick(new Date())}
          className="text-[12px] font-medium text-accent hover:underline">
          Jump to today
        </button>
        <button
          type="button"
          onClick={() => setView(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
          className="text-[12px] text-muted hover:text-ink2 transition">
          This month
        </button>
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────────────────
// DateInput — drop-in replacement for <input type="date"> with the same
// string YYYY-MM-DD API. Opens the shared DatePickerPopover so every date
// selection in the app uses one unified calendar visual.
//
// Props:
//   value     "YYYY-MM-DD" string ('' for empty)
//   onChange  (value: "YYYY-MM-DD") => void
//   min, max  "YYYY-MM-DD" strings (optional) — bound the selectable range
//   placeholder  shown when value is empty (default "Pick a date")
//   className    extra classes to merge into the trigger button (the global
//                input style is mirrored so existing utility overrides like
//                "!h-11" / "!text-[13px]" still work)
//   invalid      adds a rose border to mirror the !border-rose pattern
//   disabled
//   align     'left' | 'right' — popover horizontal anchor; defaults to
//             'left' since form fields are read left-to-right
// ─────────────────────────────────────────────────────────────────────────

export function DateInput({
  value = '',
  onChange,
  min,
  max,
  placeholder = 'Pick a date',
  className = '',
  invalid = false,
  disabled = false,
  align = 'left',
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  // Separate ref for the portal wrapper so outside-click detection works
  // even though the calendar is rendered outside the component's DOM subtree.
  const calendarPortalRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      const inWrap   = wrapRef.current        && wrapRef.current.contains(e.target);
      const inPortal = calendarPortalRef.current && calendarPortalRef.current.contains(e.target);
      if (!inWrap && !inPortal) setOpen(false);
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Parse the YYYY-MM-DD string as a LOCAL date — `new Date('2026-05-14')`
  // would parse as UTC midnight and shift days backwards in negative-UTC zones.
  function parseLocal(s) {
    if (!s || typeof s !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  function fmtKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  const dateObj = parseLocal(value);
  const minObj = parseLocal(min);
  const maxObj = parseLocal(max);

  const display = dateObj
    ? dateObj.toLocaleDateString('en-US',
        dateObj.getFullYear() === new Date().getFullYear()
          ? { month: 'short', day: 'numeric' }
          : { month: 'short', day: 'numeric', year: 'numeric' }
      )
    : placeholder;

  return (
    <div ref={wrapRef} className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        aria-label={ariaLabel}
        className={cx(
          // Mirror the global input baseline: white bg, line border, 14px,
          // h-10 (40px). Sizing/!important overrides on the caller still win.
          'w-full inline-flex items-center justify-between gap-2 bg-white border rounded-lg px-3 h-10 text-[14px] text-ink transition',
          'hover:border-ink2/40',
          open && 'border-line2 ring-2 ring-accent/15',
          invalid ? 'border-rose' : 'border-line2',
          disabled && 'opacity-60 cursor-not-allowed hover:border-line2',
          !dateObj && 'text-muted',
          className
        )}>
        <span className="truncate text-left">{display}</span>
        <I.Calendar size={14} className="text-ink2 shrink-0" />
      </button>
      {open && createPortal(
        // Render the calendar into document.body so no ancestor overflow:hidden
        // or CSS transform (e.g. from the fadein animation on a parent popover)
        // can ever clip or re-contain this fixed-position element.
        <div ref={calendarPortalRef}>
          <DatePickerPopover
            date={dateObj || new Date()}
            minDate={minObj || undefined}
            maxDate={maxObj || undefined}
            align={align}
            anchorRef={triggerRef}
            onPick={(d) => { onChange && onChange(fmtKey(d)); setOpen(false); }}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
Object.assign(window, { DateInput });

// ─────────────────────────────────────────────────────────────────────────
// TimePicker — refined replacement for ugly native <input type="time">
// Usage: <TimePicker value="14:30" onChange={(v) => setTime(v)} />
// value: "HH:MM" 24-hour string
// ─────────────────────────────────────────────────────────────────────────

export function TimePicker({ value = '09:00', onChange, disabled, className = '', minuteStep = 5, placeholder, size = 'md' }) {
  const [open, setOpen] = useState(false);
  const [popPos, setPopPos] = useState('below'); // 'below' | 'above'
  const triggerRef = useRef(null);
  const popRef = useRef(null);

  // Parse value
  const [h24, m] = (value || '09:00').split(':').map(Number);
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = (h24 + 11) % 12 + 1;

  // Display
  const displayHour = String(h12);
  const displayMin = String(m).padStart(2, '0');
  const display = `${displayHour}:${displayMin} ${period}`;

  function update({ hour = h12, minute = m, ampm = period }) {
    let h = hour % 12;
    if (ampm === 'PM') h += 12;
    const newVal = `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    onChange && onChange(newVal);
  }

  // Open/close handling — also flips popover above the trigger near the viewport bottom
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (popRef.current && popRef.current.contains(e.target)) return;
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      setOpen(false);
    }
    function onKey(e) {if (e.key === 'Escape') setOpen(false);}
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    setPopPos(spaceBelow < 340 ? 'above' : 'below');
  }, [open]);

  // Auto-scroll selected items into view when popover opens
  useEffect(() => {
    if (!open || !popRef.current) return;
    requestAnimationFrame(() => {
      popRef.current.querySelectorAll('[data-selected="true"]').forEach((el) => {
        const col = el.closest('[data-tp-col]');
        if (col) col.scrollTop = el.offsetTop - col.clientHeight / 2 + el.clientHeight / 2;
      });
    });
  }, [open]);

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) => i * minuteStep);
  const sizes = {
    sm: { height: 'h-9', text: 'text-[13px]' },
    md: { height: 'h-10', text: 'text-[13.5px]' },
    lg: { height: 'h-11', text: 'text-[14px]' }
  };
  const sz = sizes[size] || sizes.md;

  return (
    <div className={cx('relative inline-block w-full', className)}>
      {/* Trigger — matches the look of normal inputs */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cx(
          'w-full inline-flex items-center justify-between gap-2 px-3 rounded-lg bg-white border text-left transition whitespace-nowrap',
          'tabular-nums font-medium',
          sz.height, sz.text,
          open ? 'border-accent ring-2 ring-accent/20' : 'border-line2 hover:border-ink2/40',
          disabled && 'opacity-50 cursor-not-allowed'
        )}>
        
        <span className={value ? 'text-ink' : 'text-muted'}>
          {value ? display : placeholder || 'Select time'}
        </span>
        <I.Clock size={14} className="text-muted shrink-0" />
      </button>

      {/* Popover */}
      {open &&
      <div
        ref={popRef}
        className={cx(
          'absolute left-0 z-50 w-[260px] bg-surface rounded-xl2 border border-line shadow-pop overflow-hidden',
          popPos === 'below' ? 'top-full mt-2' : 'bottom-full mb-2'
        )}
        style={{ animation: 'fadein .15s ease both' }}>
        
          {/* Header — large readout */}
          <div className="px-5 pt-4 pb-3 flex items-baseline gap-1 border-b border-line/70 bg-bg/40">
            <span className="font-serif text-[28px] leading-none text-ink tabular-nums">
              {displayHour}<span className="text-ink2">:</span>{displayMin}
            </span>
            <span className="text-[12px] uppercase tracking-[0.14em] text-muted font-medium ml-1.5">{period}</span>
            <span className="ml-auto text-[10.5px] uppercase tracking-[0.14em] text-muted">Time</span>
          </div>

          {/* Three columns */}
          <div className="grid grid-cols-3 gap-px bg-line/60 relative" style={{ height: '220px' }}>
            {/* Hours */}
            <TimeCol label="Hour" hideFade>
              {hours.map((hh) =>
            <TimeOption
              key={hh}
              selected={hh === h12}
              onClick={() => update({ hour: hh })}>
              
                  {hh}
                </TimeOption>
            )}
            </TimeCol>

            {/* Minutes */}
            <TimeCol label="Min" hideFade>
              {minutes.map((mm) =>
            <TimeOption
              key={mm}
              selected={mm === m || minutes.indexOf(m) === -1 && mm === Math.round(m / minuteStep) * minuteStep}
              onClick={() => update({ minute: mm })}>
              
                  {String(mm).padStart(2, '0')}
                </TimeOption>
            )}
            </TimeCol>

            {/* Period */}
            <TimeCol label="AM/PM" hideFade>
              {['AM', 'PM'].map((p) =>
            <TimeOption
              key={p}
              selected={p === period}
              onClick={() => update({ ampm: p })}>
              
                  {p}
                </TimeOption>
            )}
            </TimeCol>
          </div>

          {/* Footer */}
          <div className="px-3 py-2.5 flex items-center justify-end gap-2 border-t border-line/70 bg-bg/40">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      }
    </div>);

}

export function TimeCol({ label, children, hideFade }) {
  const scrollRef = useRef(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

  function updateFades() {
    const el = scrollRef.current;
    if (!el) return;
    setShowTopFade(el.scrollTop > 4);
    setShowBottomFade(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }

  useEffect(() => {updateFades();}, []);

  return (
    <div className="bg-white flex flex-col min-w-0 relative">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted font-medium text-center pt-2 pb-1.5 border-b border-line/50">
        {label}
      </div>
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          data-tp-col
          onScroll={updateFades}
          className="absolute inset-0 overflow-y-auto px-1.5 py-1.5 tp-scroll">
          
          {children}
        </div>
        {/* Fade overlays — hint that more content is scrollable */}
        {!hideFade ? null : null}
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 h-5 transition-opacity"
          style={{
            background: 'linear-gradient(to bottom, #fff, rgba(255,255,255,0))',
            opacity: showTopFade ? 1 : 0
          }} />
        
        <div
          className="pointer-events-none absolute left-0 right-0 bottom-0 h-6 transition-opacity"
          style={{
            background: 'linear-gradient(to top, #fff, rgba(255,255,255,0))',
            opacity: showBottomFade ? 1 : 0
          }} />
        
      </div>
    </div>);

}

export function TimeOption({ selected, onClick, children }) {
  return (
    <button
      type="button"
      data-selected={selected ? 'true' : 'false'}
      data-dirty-trigger="time"
      onClick={onClick}
      className={cx(
        'w-full h-8 my-0.5 rounded-md text-[13.5px] tabular-nums font-medium transition flex items-center justify-center',
        selected ?
        'bg-accent text-white shadow-card' :
        'text-ink2 hover:bg-bg hover:text-ink'
      )}>
      
      {children}
    </button>);

}