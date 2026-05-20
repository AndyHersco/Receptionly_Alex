import { useEffect, useMemo, useState } from 'react';
import { RESOURCES, SERVICES } from './data';
import { I } from './icons';
import { UnsavedChangesModal, useDirtyGuard } from './nav-guard';
import { FieldLabel } from './services';
import { Button, Card, SectionHeader, cx, showToast } from './ui';

// Resources page

export function ResourcesPage() {
  const [extras, setExtras] = useState([]); // user-added resources
  const [overrides, setOverrides] = useState({}); // id -> { name?, type?, qty?, customType? }
  const [unitStatus, setUnitStatus] = useState({}); // id -> array<boolean>
  const [tombstoned, setTombstoned] = useState({}); // id -> boolean
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [confirmUnit, setConfirmUnit] = useState(null); // {unit} pending one-unit delete
  const [confirmResource, setConfirmResource] = useState(null); // resource pending full delete

  const baseAll = useMemo(() => {
    return [...RESOURCES, ...extras]
      .filter(r => !tombstoned[r.id])
      .map(r => ({ ...r, ...(overrides[r.id] || {}) }));
  }, [extras, overrides, tombstoned]);

  // Expand each resource into individual units. If qty > 1, suffix with "1", "2", etc.
  const units = useMemo(() => {
    const list = [];
    for (const r of baseAll) {
      const qty = Math.max(1, Number(r.qty) || 1);
      const statusArr = unitStatus[r.id];
      for (let i = 0; i < qty; i++) {
        const active = statusArr && statusArr[i] !== undefined
          ? statusArr[i]
          : (r.active !== false);
        const name = qty === 1 ? r.name : `${r.name} ${i + 1}`;
        list.push({
          unitId: `${r.id}__${i}`,
          resourceId: r.id,
          unitIndex: i,
          name,
          type: r.type,
          services: r.services || [],
          active,
        });
      }
    }
    return list;
  }, [baseAll, unitStatus]);

  const activeUnits = units.filter(u => u.active);
  const inactiveUnits = units.filter(u => !u.active);
  const editing = editId ? baseAll.find(r => r.id === editId) : null;

  function toggleUnit(u) {
    setUnitStatus(prev => {
      const r = baseAll.find(x => x.id === u.resourceId);
      const qty = Math.max(1, Number(r?.qty) || 1);
      const cur = (prev[u.resourceId] || Array(qty).fill(true)).slice();
      while (cur.length < qty) cur.push(true);
      cur[u.unitIndex] = !u.active;
      return { ...prev, [u.resourceId]: cur };
    });
  }

  function deleteUnit(u) {
    const r = baseAll.find(x => x.id === u.resourceId);
    const newQty = Math.max(0, (Number(r?.qty) || 1) - 1);
    if (newQty === 0) {
      setTombstoned(t => ({ ...t, [u.resourceId]: true }));
      setUnitStatus(prev => { const n = { ...prev }; delete n[u.resourceId]; return n; });
      showToast({ title: 'Resource deleted', body: `${u.name} was removed.` });
    } else {
      setOverrides(o => ({ ...o, [u.resourceId]: { ...(o[u.resourceId] || {}), qty: newQty } }));
      setUnitStatus(prev => {
        const cur = (prev[u.resourceId] || []).slice();
        cur.splice(u.unitIndex, 1);
        return { ...prev, [u.resourceId]: cur };
      });
      showToast({ title: 'Unit removed', body: `${u.name} was removed from this resource group.` });
    }
    setConfirmUnit(null);
  }

  function handleSave(payload) {
    if (editing) {
      setOverrides(o => ({ ...o, [editing.id]: { ...(o[editing.id] || {}), ...payload } }));
      setEditId(null);
    } else {
      const id = 'res_new_' + Date.now();
      setExtras(x => [...x, { id, services: [], active: true, ...payload }]);
      setShowAdd(false);
    }
  }

  function handleDelete(id) {
    const r = baseAll.find(x => x.id === id);
    setTombstoned(t => ({ ...t, [id]: true }));
    setUnitStatus(prev => { const n = { ...prev }; delete n[id]; return n; });
    setEditId(null);
    setConfirmResource(null);
    if (r) showToast({ title: 'Resource deleted', body: `${r.name} was removed.` });
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Setup"
        title="Resources"
        subtitle="Physical spaces and tools that limit simultaneous bookings — chairs, rooms, stations."
        right={<Button variant="accent" onClick={() => setShowAdd(true)} className="whitespace-nowrap"><I.Plus size={14}/> Add resource</Button>}
      />

      {/* ACTIVE */}
      <section>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium mb-2.5">Active</div>
        {activeUnits.length === 0 ? (
          <div className="rounded-xl2 border border-dashed border-line2 bg-white/40 px-6 py-10 text-center">
            <div className="font-serif text-[20px] text-ink mb-1">No active resources</div>
            <div className="text-[13px] text-ink2">Add a resource or reactivate one below to make it bookable.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeUnits.map(u => (
              <ResourceCard
                key={u.unitId}
                unit={u}
                onToggle={() => toggleUnit(u)}
                onDelete={() => setConfirmUnit(u)}
                onEdit={() => setEditId(u.resourceId)}
              />
            ))}
          </div>
        )}
      </section>

      {/* INACTIVE */}
      {inactiveUnits.length > 0 && (
        <section>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium mb-2.5">Inactive</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inactiveUnits.map(u => (
              <ResourceCard
                key={u.unitId}
                unit={u}
                onToggle={() => toggleUnit(u)}
                onDelete={() => setConfirmUnit(u)}
                onEdit={() => setEditId(u.resourceId)}
                dim
              />
            ))}
          </div>
        </section>
      )}

      {(showAdd || editing) && (
        <ResourceModal
          existing={editing}
          onClose={() => { setShowAdd(false); setEditId(null); }}
          onSubmit={handleSave}
          onDelete={editing ? () => setConfirmResource(editing) : null}
        />
      )}

      {confirmUnit && (
        <DeleteResourceModal
          mode="unit"
          target={confirmUnit}
          onConfirm={() => deleteUnit(confirmUnit)}
          onCancel={() => setConfirmUnit(null)}
        />
      )}
      {confirmResource && (
        <DeleteResourceModal
          mode="resource"
          target={confirmResource}
          onConfirm={() => handleDelete(confirmResource.id)}
          onCancel={() => setConfirmResource(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Single resource unit card
// ─────────────────────────────────────────────────────────────

export function ResourceCard({ unit, onToggle, onDelete, onEdit, dim }) {
  const services = (unit.services || [])
    .map(sid => SERVICES.find(s => s.id === sid))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Card className={cx('p-5 flex flex-col', dim && 'opacity-90')}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className={cx('font-serif text-[20px] leading-tight', dim ? 'text-ink2' : 'text-ink')}>{unit.name}</div>
          <div className="text-[13px] text-muted mt-0.5 truncate">{unit.type || 'Other'}</div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          title={unit.active ? 'Click to deactivate' : 'Click to activate'}
          className={cx(
            'inline-flex items-center h-6 px-2 rounded-full text-[11px] font-medium tracking-wide transition flex-shrink-0',
            unit.active
              ? 'bg-accentSoft text-accentInk hover:bg-[#dde6db]'
              : 'bg-line text-muted hover:text-ink2 hover:bg-line2'
          )}
        >
          {unit.active ? 'Active' : 'Off'}
        </button>
      </div>

      <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted font-medium mb-2">Used for</div>
      <div className="flex flex-wrap gap-1.5 min-h-[28px] mb-4">
        {services.length === 0 && (
          <span className="text-[12px] text-muted italic">No services linked</span>
        )}
        {services.map(s => (
          <span
            key={s.id}
            className="inline-flex items-center h-7 px-2.5 rounded-md bg-white border border-line2 text-[12px] text-ink2"
          >
            {s.name}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${unit.name}`}
          title="Delete"
          className="inline-flex items-center justify-center w-10 h-9 rounded-md bg-roseSoft text-rose hover:bg-[#efd0d7] transition"
        >
          <I.Trash size={14} />
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-white border border-line2 text-[13px] text-ink font-medium hover:bg-bg hover:border-ink2/40 transition"
        >
          <I.Edit size={13} /> Edit
        </button>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Resource add / edit modal
// ─────────────────────────────────────────────────────────────

export function ResourceModal({ onClose, onSubmit, onDelete, existing }) {
  const isEdit = !!existing;
  const TYPES = ['Barber Chair', 'Salon Chair', 'Color Station', 'Treatment Room', 'Massage Room', 'Nail Station', 'Other'];

  const initial = useMemo(() => ({
    name: existing?.name || '',
    type: existing?.type || '',
    qty: existing?.qty ?? 1,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [name, setName] = useState(initial.name);
  const [type, setType] = useState(initial.type);
  const [qty, setQty] = useState(initial.qty);
  const [errors, setErrors] = useState({});
  const [confirmClose, setConfirmClose] = useState(false);

  const dirty =
    String(name) !== String(initial.name) ||
    String(type) !== String(initial.type) ||
    Number(qty) !== Number(initial.qty);

  const isValid = name.trim() && type && Number(qty) >= 1;
  const canSubmit = isValid && (isEdit ? dirty : true);

  function handleSubmit() {
    const errs = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!type) errs.type = 'Choose a type';
    if (!qty || Number(qty) < 1) errs.qty = 'Quantity must be at least 1';
    setErrors(errs);
    if (Object.keys(errs).length) return false;
    onSubmit({ name: name.trim(), type, qty: Number(qty) });
    return true;
  }

  function requestClose() {
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  // Route nav / sidebar / tab changes through the same unsaved-changes prompt.
  // For Add we hide "Save & leave" — the resource doesn't exist yet.
  useDirtyGuard({
    dirty,
    onSave: () => { if (canSubmit) handleSubmit(); },
    onDiscard: () => onClose(),
    hideSave: !isEdit,
  });

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') requestClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 fadein"
      style={{ background: 'rgba(20,18,15,.42)' }}
      onClick={requestClose}
    >
      <div
        className="relative w-full max-w-md bg-surface rounded-2xl shadow-pop border border-line"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="font-serif text-[22px] text-ink leading-none whitespace-nowrap">{isEdit ? 'Edit resource' : 'Add resource'}</h2>
          <button
            onClick={requestClose}
            className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-ink2 hover:bg-bg transition"
            aria-label="Close"
          >
            <I.X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 space-y-4">
          <div>
            <FieldLabel required>Name</FieldLabel>
            <input
              value={name}
              onChange={e => { setName(e.target.value); if (errors.name) setErrors(er => ({ ...er, name: undefined })); }}
              placeholder="e.g. Salon Chair 3"
              className={cx('!h-11', errors.name && '!border-rose')}
              autoFocus
            />
            {errors.name && <div className="text-[12px] text-rose mt-1">{errors.name}</div>}
          </div>

          <div>
            <FieldLabel required>Type</FieldLabel>
            <select
              value={type}
              onChange={e => { setType(e.target.value); if (errors.type) setErrors(er => ({ ...er, type: undefined })); }}
              className={cx('!h-11', !type && 'text-muted', errors.type && '!border-rose')}
              required
            >
              <option value="" disabled>Select type…</option>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.type && <div className="text-[12px] text-rose mt-1">{errors.type}</div>}
          </div>

          <div>
            <FieldLabel required>Quantity</FieldLabel>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQty(q => Math.max(1, (Number(q) || 1) - 1))}
                className="w-11 h-11 rounded-lg border border-line2 text-ink2 hover:bg-bg hover:text-ink hover:border-ink2/40 flex items-center justify-center flex-shrink-0 transition"
                aria-label="Decrease quantity"
              ><I.Minus size={14} /></button>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={e => { setQty(Math.max(1, parseInt(e.target.value || '1', 10) || 1)); if (errors.qty) setErrors(er => ({ ...er, qty: undefined })); }}
                className={cx('!h-11 text-center min-w-0 flex-1', errors.qty && '!border-rose')}
              />
              <button
                type="button"
                onClick={() => setQty(q => (Number(q) || 1) + 1)}
                className="w-11 h-11 rounded-lg border border-line2 text-ink2 hover:bg-bg hover:text-ink hover:border-ink2/40 flex items-center justify-center flex-shrink-0 transition"
                aria-label="Increase quantity"
              ><I.Plus size={14} /></button>
            </div>
            {Number(qty) > 1 && name.trim() && (
              <div className="text-[11.5px] text-muted mt-1.5">
                Creates <span className="text-ink2 font-medium">{name.trim()} 1</span>{Number(qty) >= 2 && <>, <span className="text-ink2 font-medium">{name.trim()} 2</span></>}{Number(qty) > 2 && <>, …</>}
              </div>
            )}
            {errors.qty && <div className="text-[12px] text-rose mt-1">{errors.qty}</div>}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-1 flex items-center justify-between gap-2">
          <div>
            {isEdit && onDelete && (
              <Button type="button" variant="danger" size="lg" onClick={onDelete}>
                <I.Trash size={14} /> Delete
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="lg" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="button" variant="accent" size="lg" onClick={handleSubmit} disabled={!canSubmit}>
              {isEdit ? 'Save changes' : 'Add resource'}
            </Button>
          </div>
        </div>
      </div>

      {/* Unsaved-changes confirmation */}
      <UnsavedChangesModal
        open={confirmClose}
        hideSave={!isEdit}
        onSave={() => {
          const ok = handleSubmit();
          if (ok) setConfirmClose(false);
        }}
        onDiscard={() => { setConfirmClose(false); onClose(); }}
        onStay={() => setConfirmClose(false)}
      />
    </div>
  );
}

window.ResourcesPage = ResourcesPage;

// ────────────────────────────────────────────────────────────
// DeleteResourceModal — destructive confirmation for a single unit or a
// whole resource group. `mode` switches the copy.
// ────────────────────────────────────────────────────────────

export function DeleteResourceModal({ mode, target, onConfirm, onCancel }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel && onCancel(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const isUnit = mode === 'unit';
  const title = isUnit ? 'Delete this unit?' : 'Delete this resource?';
  const name  = isUnit ? target.name : target.name;
  const subtitle = isUnit ? `${target.type || 'Resource'}` : `${target.type || 'Resource'} · qty ${target.qty || 1}`;
  const body = isUnit
    ? <>This will remove <span className="font-medium">{name}</span> from the schedule. Any services that depend on this resource may temporarily lose availability.</>
    : <>This will remove <span className="font-medium">{name}</span> and any of its units from your schedule. Services that depend on it may lose availability until you add a replacement.</>;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 fadein"
      style={{ background: 'rgba(20,18,15,.42)' }}
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-[460px] bg-surface rounded-2xl shadow-pop border border-line p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          aria-label="Close"
          className="absolute top-4 right-4 w-7 h-7 inline-flex items-center justify-center rounded-md text-muted hover:text-ink hover:bg-bg/70 transition"
        >
          <I.X size={16} />
        </button>

        <div className="flex items-start gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-roseSoft text-rose flex items-center justify-center flex-shrink-0">
            <I.Trash size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-[22px] text-ink leading-tight">{title}</h3>
            <p className="text-[12.5px] text-muted mt-0.5 truncate">{name} · {subtitle}</p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-roseSoft bg-roseSoft/40 px-3.5 py-2.5 text-[12.5px] text-[#7A2A3D] leading-relaxed">
          {body}
        </div>

        <div className="mt-6 flex items-center gap-2 justify-end">
          <Button variant="secondary" size="lg" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" size="lg" onClick={onConfirm}>
            <I.Trash size={14} /> {isUnit ? 'Delete unit' : 'Delete resource'}
          </Button>
        </div>
      </div>
    </div>
  );
}

window.DeleteResourceModal = DeleteResourceModal;
