import { useEffect, useRef, useState } from 'react';
import { I } from './icons';
import { Button } from './ui';

// NotesSection — inline editable notes block used for both appointment notes
// and customer notes. Shows the current value (or a subtle empty state), and
// reveals a textarea + Save / Cancel on click.
//
// Props:
//   value        — string (the current note); falls back to appt.notes if
//                  `appt` is passed (back-compat for older call sites).
//   onSave       — (next: string) => void. If omitted, the section renders
//                  read-only: text shows but no Edit affordance.
//   label        — section eyebrow, default "Appointment notes".
//   placeholder  — textarea placeholder.
//   emptyText    — what to show when value is blank.
//   appt         — back-compat: when passed, value defaults to appt.notes.

export function NotesSection({
  value,
  onSave,
  label = 'Appointment notes',
  placeholder = 'Add any notes or special requests...',
  emptyText = 'No notes added.',
  appt,
}) {
  const current = value != null ? value : (appt && appt.notes) || '';
  const readOnly = typeof onSave !== 'function';

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const textareaRef = useRef(null);

  // Re-sync the draft whenever the underlying value changes OR the user
  // re-enters edit mode, so we never display stale text from a previous open.
  useEffect(() => {
    if (editing) {
      setDraft(current);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          const v = el.value;
          el.setSelectionRange(v.length, v.length);
        }
      });
    }
  }, [editing, current]);

  function handleSave() {
    onSave && onSave(draft.trim());
    setEditing(false);
  }
  function handleCancel() {
    setDraft(current);
    setEditing(false);
  }

  const hasNotes = !!(current && current.trim().length);

  if (editing && !readOnly) {
    return (
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">{label}</div>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full resize-y leading-snug"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleSave(); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); handleCancel(); }
          }}
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={handleCancel}>Cancel</Button>
          <Button variant="accent" size="sm" onClick={handleSave}>Save notes</Button>
        </div>
      </div>
    );
  }

  // Read-only render: just label + body, no Add/Edit affordances. When the
  // value is empty, the entire section collapses to nothing rather than
  // showing an interactive empty pill (because there's nothing to click).
  if (readOnly) {
    if (!hasNotes) return null;
    return (
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">{label}</div>
        <div className="rounded-lg border border-line bg-bg/40 px-3.5 py-2.5 text-[13px] text-ink2 leading-relaxed whitespace-pre-wrap">
          {current}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wider text-muted font-medium">{label}</div>
        <button
          onClick={() => setEditing(true)}
          className="text-[11.5px] font-medium text-accent hover:text-accentInk transition inline-flex items-center gap-1">
          {hasNotes ? <><I.Edit size={11} /> Edit</> : <><I.Plus size={11} strokeWidth={2.4} /> Add note</>}
        </button>
      </div>
      {hasNotes ? (
        <div
          onClick={() => setEditing(true)}
          className="rounded-lg border border-line bg-bg/40 px-3.5 py-2.5 text-[13px] text-ink2 leading-relaxed whitespace-pre-wrap cursor-text hover:border-line2 transition">
          {current}
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-full text-left rounded-lg border border-dashed border-line2 bg-bg/30 px-3.5 py-2.5 text-[12.5px] text-muted hover:border-ink2/40 hover:text-ink2 transition">
          {emptyText}
        </button>
      )}
    </div>
  );
}

window.NotesSection = NotesSection;
