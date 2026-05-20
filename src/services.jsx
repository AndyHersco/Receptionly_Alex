import { useEffect, useMemo, useRef, useState } from 'react';
import { RESOURCES, SERVICES, SERVICE_CATEGORIES, STAFF } from './data';
import { I } from './icons';
import { UnsavedChangesModal, useDirtyGuard } from './nav-guard';
import { Button, Card, EmptyState, cx, showToast } from './ui';

// Services page — grouped list with category sidebar

export function ServicesPage({ onServiceDeleted }) {
  const [activeCat, setActiveCat] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editingSvc, setEditingSvc] = useState(null);
  const [extraServices, setExtraServices] = useState([]);
  const [serviceOverrides, setServiceOverrides] = useState({}); // id -> partial overrides
  const [deletedIds, setDeletedIds] = useState(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(null); // service object pending delete

  // Group services by category, in the order of SERVICE_CATEGORIES
  const allServices = useMemo(() => {
    const merged = [...SERVICES, ...extraServices]
      .filter(s => !deletedIds.has(s.id))
      .map(s => serviceOverrides[s.id] ? { ...s, ...serviceOverrides[s.id] } : s);
    return merged;
  }, [extraServices, serviceOverrides, deletedIds]);

  function performDelete(svc) {
    // 1. Mark deleted in this page's local view (covers extraServices too).
    setDeletedIds(prev => {
      const n = new Set(prev);
      n.add(svc.id);
      return n;
    });
    // 2. Mutate the global SERVICES array so other pages stop showing it.
    const idx = window.SERVICES.findIndex(s => s.id === svc.id);
    if (idx !== -1) window.SERVICES.splice(idx, 1);
    // 3. Remove from any staff service lists.
    (window.STAFF || []).forEach(s => {
      if (Array.isArray(s.services)) s.services = s.services.filter(id => id !== svc.id);
    });
    // 4. Remove from any resource service lists.
    (window.RESOURCES || []).forEach(r => {
      if (Array.isArray(r.services)) r.services = r.services.filter(id => id !== svc.id);
    });
    // 5. Bubble to app shell so appointments referencing this service are
    //    cleared and any open detail modal closes.
    if (typeof onServiceDeleted === 'function') onServiceDeleted(svc.id);
    // 6. Drop any pending override / extra entry — no longer relevant.
    setServiceOverrides(prev => {
      if (!prev[svc.id]) return prev;
      const n = { ...prev };
      delete n[svc.id];
      return n;
    });
    setExtraServices(prev => prev.filter(s => s.id !== svc.id));
    setConfirmDelete(null);
    showToast({ title: 'Service deleted', body: `\u201C${svc.name}\u201D was removed from your menu.` });
  }
  const visibleCategories = useMemo(() => {
    if (activeCat === 'all') {
      return SERVICE_CATEGORIES
        .map(c => ({ cat: c, services: allServices.filter(s => s.category === c.id) }))
        .filter(g => g.services.length > 0);
    }
    const c = SERVICE_CATEGORIES.find(c => c.id === activeCat);
    return c ? [{ cat: c, services: allServices.filter(s => s.category === c.id) }] : [];
  }, [activeCat, allServices]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium mb-2">Offering</div>
          <h1 className="font-serif text-[40px] leading-[1.05] text-ink">Services</h1>
          <p className="text-[14px] text-ink2 mt-1.5 max-w-2xl">Manage everything you offer — durations, pricing, and who can perform it.</p>
        </div>
        <Button variant="accent" onClick={() => setShowAdd(true)} className="shrink-0">
          <I.Plus size={14} />
          Add service
        </Button>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: '232px 1fr' }}>
        {/* Sidebar */}
        <Card className="p-2 self-start sticky top-20">
          <CatItem
            label="All services"
            count={allServices.length}
            active={activeCat === 'all'}
            onClick={() => setActiveCat('all')}
          />
          {SERVICE_CATEGORIES.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => {
            const count = allServices.filter(s => s.category === c.id).length;
            return (
              <CatItem
                key={c.id}
                label={c.name}
                count={count}
                active={activeCat === c.id}
                onClick={() => setActiveCat(c.id)}
              />
            );
          })}
        </Card>

        {/* Grouped service cards */}
        <div className="space-y-5 min-w-0">
          {visibleCategories.map(({ cat, services }) => (
            <Card key={cat.id} className="overflow-hidden">
              <div className="px-6 pt-5 pb-4 flex items-baseline gap-2.5 border-b border-line/70">
                <h2 className="text-[20px] font-semibold text-ink">{cat.name}</h2>
                <span className="text-[13px] text-muted">{services.length} {services.length === 1 ? 'service' : 'services'}</span>
              </div>
              <div>
                {services.map((svc, i) => (
                  <ServiceRow
                    key={svc.id}
                    svc={svc}
                    isLast={i === services.length - 1}
                    onEdit={() => setEditingSvc(svc)}
                    onDelete={() => setConfirmDelete(svc)}
                  />
                ))}
              </div>
            </Card>
          ))}
          {visibleCategories.length === 0 && (
            <Card className="p-10">
              <EmptyState title="No services" body="Try a different category or add a new service to get started." />
            </Card>
          )}
        </div>
      </div>

      {showAdd && (
        <ServiceModal
          initialCategory={activeCat}
          onClose={() => setShowAdd(false)}
          onSubmit={(svc) => {
            setExtraServices(prev => [...prev, svc]);
            setShowAdd(false);
          }}
        />
      )}

      {editingSvc && (
        <ServiceModal
          existing={editingSvc}
          onClose={() => setEditingSvc(null)}
          onSubmit={(svc) => {
            setServiceOverrides(prev => ({ ...prev, [svc.id]: svc }));
            setEditingSvc(null);
          }}
          onDelete={() => { setEditingSvc(null); setConfirmDelete(editingSvc); }}
        />
      )}

      {confirmDelete && (
        <DeleteServiceModal
          svc={confirmDelete}
          onConfirm={() => performDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

export function CatItem({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left transition',
        active
          ? 'bg-accentSoft text-accentInk font-semibold'
          : 'text-ink2 hover:bg-bg hover:text-ink'
      )}
    >
      <span className="text-[14px] truncate">{label}</span>
      <span className={cx('text-[12.5px] tabular-nums shrink-0 ml-2', active ? 'text-accentInk/70' : 'text-muted')}>
        {count}
      </span>
    </button>
  );
}

export function ServiceRow({ svc, isLast, onEdit, onDelete }) {
  const resources = RESOURCES.filter(r => r.services.includes(svc.id) && r.active);
  const staffList = svc.staff || [];

  return (
    <div
      className={cx(
        'group flex items-start gap-4 px-6 py-5 transition hover:bg-bg/40',
        !isLast && 'border-b border-line/70'
      )}
    >
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Title + chips */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-1">
          <h3 className="text-[16px] font-semibold text-ink">{svc.name}</h3>
          {svc.online === false && (
            <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-line text-[12px] font-medium text-ink2">
              Not online
            </span>
          )}
          {resources.map(r => (
            <span
              key={r.id}
              className="inline-flex items-center h-6 px-2.5 rounded-full bg-warmSoft text-[12px] font-medium"
              style={{ color: '#7A3F1F' }}
            >
              {r.name}
            </span>
          ))}
        </div>

        {/* Description */}
        {svc.desc && (
          <div className="text-[13.5px] text-ink2 mb-2.5">{svc.desc}</div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-4 text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <I.Clock size={13} />
            <span className="tabular-nums">{svc.duration} min</span>
          </span>
          <span>{staffList.length} {staffList.length === 1 ? 'staff' : 'staff'}</span>
          {svc.bufferAfter > 0 && <span>+{svc.bufferAfter}m buffer</span>}
        </div>
      </div>

      {/* Price + actions */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-[18px] font-semibold text-ink tabular-nums min-w-[60px] text-right">
          ${svc.price}
        </div>
        <button
          aria-label="Edit"
          onClick={onEdit}
          className="w-9 h-9 rounded-lg bg-white border border-line2 text-ink2 hover:text-ink hover:border-ink2/40 hover:bg-bg/50 flex items-center justify-center transition"
        >
          <I.Edit size={14} />
        </button>
        <button
          aria-label={`Delete ${svc.name}`}
          title="Delete"
          onClick={onDelete}
          className="w-9 h-9 rounded-lg text-white flex items-center justify-center transition"
          style={{ background: '#B8556A' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#a04457'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#B8556A'; }}
        >
          <I.Trash size={14} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Service modal — dual purpose for Add and Edit
// ─────────────────────────────────────────────────────────────

export function ServiceModal({ onClose, onSubmit, onDelete, initialCategory, existing }) {
  const isEdit = !!existing;

  // Resources for an existing service: combine the single `resource` field with
  // any RESOURCES that list this service in their `services` array.
  function initialResources() {
    if (!existing) return [];
    const set = new Set();
    if (existing.resource) set.add(existing.resource);
    RESOURCES.forEach(r => { if (r.services && r.services.includes(existing.id)) set.add(r.id); });
    return [...set];
  }

  // Capture initial values for dirty-checking
  const initial = useMemo(() => ({
    name: existing?.name || '',
    category: existing?.category || (initialCategory && initialCategory !== 'all' ? initialCategory : ''),
    duration: existing?.duration ?? '',
    price: existing?.price ?? '',
    bufferAfter: existing?.bufferAfter ?? 0,
    resources: initialResources().sort().join(','),
  }), []);

  const [name, setName] = useState(initial.name);
  const [category, setCategory] = useState(initial.category);
  const [duration, setDuration] = useState(initial.duration);
  const [price, setPrice] = useState(initial.price);
  const [bufferAfter, setBufferAfter] = useState(initial.bufferAfter);
  const [resources, setResources] = useState(initialResources);
  const [errors, setErrors] = useState({});
  const nameRef = useRef(null);

  useEffect(() => { nameRef.current && nameRef.current.focus(); }, []);

  function toggleResource(id) {
    setResources(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  }

  // Dirty if any field differs from its initial value
  const dirty =
    String(name) !== String(initial.name) ||
    String(category) !== String(initial.category) ||
    String(duration) !== String(initial.duration) ||
    String(price) !== String(initial.price) ||
    Number(bufferAfter) !== Number(initial.bufferAfter) ||
    resources.slice().sort().join(',') !== initial.resources;

  // Track close-attempt so we can show the unsaved-changes confirmation
  const [confirmClose, setConfirmClose] = useState(false);

  function requestClose() {
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  // Register with NavGuard so sidebar / tab / page navigation while the
  // modal is open also pops the unsaved-changes prompt.
  // For the Add flow we hide "Save & leave" — the service doesn't exist yet
  // and the user should explicitly come back to finish creating it.
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

  function handleSubmit() {
    const errs = {};
    if (!name.trim()) errs.name = 'Service name is required';
    if (!category) errs.category = 'Choose a category';
    if (duration === '' || Number(duration) <= 0) errs.duration = 'Enter a duration';
    if (price === '' || Number(price) < 0) errs.price = 'Enter a price';
    if (Object.keys(errs).length) { setErrors(errs); return false; }

    onSubmit({
      id: existing?.id || ('svc_new_' + Date.now()),
      name: name.trim(),
      category,
      duration: Number(duration),
      price: Number(price),
      bufferAfter: Number(bufferAfter) || 0,
      resource: resources[0] || null,
      online: existing?.online ?? true,
      desc: existing?.desc || '',
      staff: existing?.staff || STAFF.map(s => s.id),
    });
  }

  const activeResources = RESOURCES.filter(r => r.active);
  const isValid = name.trim() && category && duration !== '' && Number(duration) > 0 && price !== '' && Number(price) >= 0;
  const canSubmit = isValid && dirty;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 fadein"
      style={{ background: 'rgba(20,18,15,.42)' }}
      onClick={requestClose}
    >
      <div
        className="relative w-full max-w-[640px] max-h-[92vh] flex flex-col bg-surface rounded-2xl shadow-pop border border-line overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-3 shrink-0">
          <h2 className="font-serif text-[24px] text-ink leading-none">{isEdit ? 'Edit service' : 'Add service'}</h2>
          <button
            onClick={requestClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-ink2 hover:bg-bg transition"
            aria-label="Close"
          >
            <I.X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-4 space-y-4">
          {/* Service name */}
          <div>
            <FieldLabel required>Service name</FieldLabel>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); if (errors.name) setErrors(er => ({ ...er, name: undefined })); }}
              placeholder="e.g. Balayage"
              className={cx('!h-11', errors.name && '!border-rose')}
            />
            {errors.name && <div className="mt-1.5 text-[12px] text-rose font-medium">{errors.name}</div>}
          </div>

          {/* Category + Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Category</FieldLabel>
              <select
                value={category}
                onChange={e => { setCategory(e.target.value); if (errors.category) setErrors(er => ({ ...er, category: undefined })); }}
                className={cx('!h-11', !category && 'text-muted', errors.category && '!border-rose')}
                required
              >
                <option value="" disabled>Choose category…</option>
                {SERVICE_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel required>Duration (minutes)</FieldLabel>
              <input
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={e => { setDuration(e.target.value); if (errors.duration) setErrors(er => ({ ...er, duration: undefined })); }}
                placeholder="e.g. 60"
                className={cx('!h-11', errors.duration && '!border-rose')}
              />
            </div>
          </div>

          {/* Price + Buffer time — two-column, mirrors Category + Duration above. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Price ($)</FieldLabel>
              <input
                type="number"
                min={0}
                step={1}
                value={price}
                onChange={e => { setPrice(e.target.value); if (errors.price) setErrors(er => ({ ...er, price: undefined })); }}
                placeholder="e.g. 80"
                className={cx('!h-11', errors.price && '!border-rose')}
              />
            </div>

            <div>
              <FieldLabel optional>Buffer time</FieldLabel>
              <select
                value={String(bufferAfter)}
                onChange={e => setBufferAfter(Number(e.target.value))}
                className="!h-11">
                <option value="0">No buffer</option>
                {Array.from({ length: 12 }, (_, i) => (i + 1) * 5).map(m => (
                  <option key={m} value={m}>{m} minutes</option>
                ))}
              </select>
              <div className="mt-1.5 text-[12px] text-muted leading-relaxed">
                Extra time after the service before another appointment can be booked.
              </div>
            </div>
          </div>

          {/* Resources required */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-[13px] font-medium text-ink">Resources required</div>
              <div className="text-[12px] text-muted">Select all rooms or equipment this service needs</div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {activeResources.map(r => {
                const checked = resources.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleResource(r.id)}
                    className={cx(
                      'flex items-center justify-between gap-3 px-3 h-11 rounded-lg border text-left transition',
                      checked
                        ? 'border-accent bg-accentSoft/60'
                        : 'border-line2 bg-white hover:border-ink2/30'
                    )}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cx(
                          'w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition',
                          checked ? 'bg-accent border-accent' : 'bg-white border-line2'
                        )}
                      >
                        {checked && <I.Check size={11} className="text-white" strokeWidth={3} />}
                      </span>
                      <span className="text-[13.5px] text-ink truncate">{r.name}</span>
                    </span>
                    <span className="text-[11.5px] text-muted shrink-0">{r.type}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 flex items-center justify-between gap-3 border-t border-line/70 bg-bg/30 shrink-0">
          <div>
            {isEdit && onDelete && (
              <Button type="button" variant="danger" size="lg" onClick={onDelete}>
                <I.Trash size={14} /> Delete
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" size="lg" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="button" variant="accent" size="lg" onClick={handleSubmit} disabled={!canSubmit}>
              {isEdit ? 'Save changes' : 'Add service'}
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
          if (ok !== false) {
            setConfirmClose(false);
            // onSubmit closes the modal via parent
          }
        }}
        onDiscard={() => { setConfirmClose(false); onClose(); }}
        onStay={() => setConfirmClose(false)}
      />
    </div>
  );
}

export function FieldLabel({ children, required, optional }) {
  return (
    <div className="text-[13px] font-medium text-ink mb-1.5">
      {children}
      {required && <span className="text-rose ml-0.5">*</span>}
      {optional && <span className="text-muted font-normal"> (optional)</span>}
    </div>
  );
}

window.ServicesPage = ServicesPage;
window.ServiceModal = ServiceModal;

// ────────────────────────────────────────────────────────────
// DeleteServiceModal — destructive confirmation for service removal
// ────────────────────────────────────────────────────────────

export function DeleteServiceModal({ svc, onConfirm, onCancel }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel && onCancel(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Quick impact summary: staff who can perform this, future appts referencing it.
  const staffCount = (window.STAFF || []).filter(s => Array.isArray(s.services) && s.services.includes(svc.id)).length;
  const apptCount = (window.APPOINTMENTS || []).filter(a => a.serviceId === svc.id).length;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 fadein"
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
            <h3 className="font-serif text-[22px] text-ink leading-tight">Delete this service?</h3>
            <p className="text-[12.5px] text-muted mt-0.5 truncate">{svc.name} · {svc.duration} min · ${svc.price}</p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-roseSoft bg-roseSoft/40 px-3.5 py-2.5 text-[12.5px] text-[#7A2A3D] leading-relaxed">
          <span className="font-medium">{svc.name}</span> will be removed from your menu and from{' '}
          <span className="font-medium">{staffCount}</span> staff member{staffCount === 1 ? '' : 's'}.{' '}
          {apptCount > 0 && <>Any of the <span className="font-medium">{apptCount}</span> demo appointment{apptCount === 1 ? '' : 's'} that referenced it will also be cleared.</>}
        </div>

        <div className="mt-6 flex items-center gap-2 justify-end">
          <Button variant="secondary" size="lg" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" size="lg" onClick={onConfirm}>
            <I.Trash size={14} /> Delete service
          </Button>
        </div>
      </div>
    </div>
  );
}

window.DeleteServiceModal = DeleteServiceModal;
