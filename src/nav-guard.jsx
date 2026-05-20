import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { I } from './icons';
import { Button, Card, Field, cx } from './ui';

// Navigation guard — intercepts route/tab changes when a form is dirty.
// Usage:
//   1. Wrap your tree in <NavGuardProvider>.
//   2. In any nav handler, call navGuard.request(() => doNav()) instead of doNav().
//   3. In a form, call navGuard.setGuard({ isDirty, onSave, onDiscard }) on mount
//      and navGuard.clearGuard() on unmount. Use a ref so the predicate is fresh.

export const NavGuardContext = createContext({
  request: (run) => run(),
  setGuard: () => {},
  clearGuard: () => {},
});

export function NavGuardProvider({ children }) {
  // Set of currently-registered guards. Multiple components can each register
  // their own dirty state on the same screen (e.g. profile form + change
  // password card) — all are checked when a nav action is requested.
  const guardsRef = useRef(new Set());
  const [pending, setPending] = useState(null);
  const [hideSave, setHideSave] = useState(false);

  const value = useMemo(() => ({
    request(run) {
      const dirty = [...guardsRef.current].filter(g => g.isDirty());
      if (dirty.length) {
        // hideSave if any dirty guard says so (conservative — best when the
        // pending action couldn't actually persist that guard's changes).
        setHideSave(dirty.some(g => g.hideSave && g.hideSave()));
        setPending({ run, guards: dirty });
      } else run();
    },
    setGuard(g) { guardsRef.current.add(g); },
    clearGuard(g) {
      if (g) guardsRef.current.delete(g);
      else guardsRef.current.clear();
    },
  }), []);

  function runPending() {
    const p = pending;
    setPending(null);
    if (p) p.run();
  }

  function handleSave() {
    if (pending) for (const g of pending.guards) g.onSave && g.onSave();
    runPending();
  }
  function handleDiscard() {
    if (pending) for (const g of pending.guards) g.onDiscard && g.onDiscard();
    runPending();
  }
  function handleStay() {
    setPending(null);
  }

  return (
    <NavGuardContext.Provider value={value}>
      {children}
      <UnsavedChangesModal
        open={!!pending}
        onSave={handleSave}
        onDiscard={handleDiscard}
        onStay={handleStay}
        hideSave={hideSave}
      />
    </NavGuardContext.Provider>
  );
}

export function useNavGuard() {
  return useContext(NavGuardContext);
}

// Convenience hook for forms: pass a dirty flag, save/discard callbacks.
export function useDirtyGuard({ dirty, onSave, onDiscard, hideSave }) {
  const guard = useNavGuard();
  const dirtyRef = useRef(dirty);
  const saveRef = useRef(onSave);
  const discardRef = useRef(onDiscard);
  const hideSaveRef = useRef(hideSave);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => { saveRef.current = onSave; }, [onSave]);
  useEffect(() => { discardRef.current = onDiscard; }, [onDiscard]);
  useEffect(() => { hideSaveRef.current = hideSave; }, [hideSave]);

  useEffect(() => {
    const g = {
      isDirty: () => !!dirtyRef.current,
      onSave: () => saveRef.current && saveRef.current(),
      onDiscard: () => discardRef.current && discardRef.current(),
      hideSave: () => !!hideSaveRef.current,
    };
    guard.setGuard(g);
    return () => guard.clearGuard(g);
  }, []);

  return guard;
}

export function UnsavedChangesModal({ open, onSave, onDiscard, onStay, hideSave }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') onStay && onStay(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onStay]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 fadein"
      style={{ background: 'rgba(20,18,15,.42)' }}
      onClick={onStay}>
      <div
        className="relative w-full max-w-[440px] bg-surface rounded-2xl shadow-pop border border-line p-7"
        onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onStay}
          aria-label="Close"
          className="absolute top-4 right-4 w-7 h-7 inline-flex items-center justify-center rounded-md text-muted hover:text-ink hover:bg-bg/70 transition">
          <I.X size={16} />
        </button>
        <h3 className="font-serif text-[22px] text-ink leading-tight mb-2">Unsaved changes</h3>
        <p className="text-[14px] text-ink2 leading-relaxed mb-6">
          You have unsaved changes. What would you like to do?
        </p>
        <div className="space-y-2">
          {!hideSave && (
            <Button variant="accent" size="lg" className="w-full" onClick={onSave}>
              Save &amp; leave
            </Button>
          )}
          <Button variant="secondary" size="lg" className="w-full" onClick={onDiscard}>
            Leave without saving
          </Button>
          <Button variant="ghost" size="lg" className="w-full" onClick={onStay}>
            Keep editing
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChangePasswordCard — shared between admin and employee settings.
// Manages its own dirty state (any non-empty field), validation, and registers
// with the NavGuard so trying to leave with unsaved password edits triggers
// the unsaved-changes modal. Layout mirrors the original admin card so the
// two pages look identical.
// ---------------------------------------------------------------------------
export function ChangePasswordCard({ className = '' }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [nextTouched, setNextTouched] = useState(false);

  const dirty = current.length > 0 || next.length > 0 || confirm.length > 0;
  const tooShort = nextTouched && next.length > 0 && next.length < 6;
  const mismatch = confirmTouched && confirm.length > 0 && next !== confirm;
  const canSave =
    current.length > 0 &&
    next.length >= 6 &&
    confirm.length > 0 &&
    next === confirm;

  function reset() {
    setCurrent('');
    setNext('');
    setConfirm('');
    setConfirmTouched(false);
    setNextTouched(false);
  }
  function commit() {
    if (!canSave) return;
    reset();
    setSaved(true);
  }

  useDirtyGuard({
    dirty,
    onSave: () => { if (canSave) commit(); },
    onDiscard: reset,
    // If the user navigates away mid-edit and the form isn't valid yet, hide
    // the "Save & leave" option — they can only stay or discard.
    hideSave: !canSave,
  });

  // Any keystroke clears the recent-success indicator.
  const onChange = (setter) => (e) => {
    if (saved) setSaved(false);
    setter(e.target.value);
  };

  return (
    <Card className={cx('p-8', className)}>
      <h3 className="font-serif text-[24px] text-ink mb-6">Change password</h3>
      <div className="space-y-5">
        <Field label="Current password">
          <input
            type="password"
            placeholder="Enter current password"
            value={current}
            onChange={onChange(setCurrent)}
          />
        </Field>
        <Field
          label="New password"
          error={tooShort ? 'Must be at least 6 characters' : undefined}
        >
          <input
            type="password"
            placeholder="At least 6 characters"
            value={next}
            onChange={onChange(setNext)}
            onBlur={() => setNextTouched(true)}
          />
        </Field>
        <Field
          label="Confirm new password"
          error={mismatch ? "Passwords don't match" : undefined}
        >
          <input
            type="password"
            placeholder="Re-enter new password"
            value={confirm}
            onChange={onChange(setConfirm)}
            onBlur={() => setConfirmTouched(true)}
          />
        </Field>
      </div>
      <div className="mt-8 flex items-center justify-end gap-3">
        {saved && (
          <div className="flex items-center gap-1.5 text-[12.5px] text-accentInk font-medium fadein">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            Password updated
          </div>
        )}
        <Button variant="accent" disabled={!canSave} onClick={commit}>
          Update password
        </Button>
      </div>
    </Card>
  );
}

window.NavGuardProvider = NavGuardProvider;
window.useNavGuard = useNavGuard;
window.useDirtyGuard = useDirtyGuard;
window.UnsavedChangesModal = UnsavedChangesModal;
window.ChangePasswordCard = ChangePasswordCard;
