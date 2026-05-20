import { useEffect, useMemo, useRef, useState } from 'react';
import { BUSINESS, CUSTOMERS, SERVICES, STAFF, fmt12, parseDay, todayKey } from './data';
import { I } from './icons';
import { UnsavedChangesModal, useDirtyGuard } from './nav-guard';
import { NotesSection } from './notes-section';
import { Button, Card, CustomerAvatar, EmptyState, Modal, SectionHeader, StatusPill, cx, showToast } from './ui';

// Customers / Client CRM

export function CustomersPage({ appointments, onOpen }) {
  const [search, setSearch] = useState('');
  const [extras, setExtras] = useState([]); // user-added clients
  const [overrides, setOverrides] = useState({}); // id -> partial overrides
  const [deletedIds, setDeletedIds] = useState(() => new Set());
  const [selected, setSelected] = useState(CUSTOMERS[0].id);
  const [confirmDelete, setConfirmDelete] = useState(null); // customer id pending delete
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);

  const allCustomers = useMemo(() => {
    return [...CUSTOMERS, ...extras]
      .filter(c => !deletedIds.has(c.id))
      .map(c => overrides[c.id] ? { ...c, ...overrides[c.id] } : c);
  }, [extras, overrides, deletedIds]);

  const filtered = allCustomers.filter(c =>
    (c.name + (c.phone || '') + (c.email || '')).toLowerCase().includes(search.toLowerCase())
  );

  // Keep selection valid if the selected customer was deleted/filtered out.
  useEffect(() => {
    if (!allCustomers.find(c => c.id === selected)) {
      setSelected(allCustomers[0]?.id || null);
    }
  }, [deletedIds]); // eslint-disable-line

  const customer = allCustomers.find(c => c.id === selected);
  const history = customer
    ? appointments.filter(a => a.customerId === customer.id).sort((a, b) => b.day.localeCompare(a.day))
    : [];
  const upcoming = history.filter(a => a.day >= todayKey() && a.status !== 'canceled' && a.status !== 'completed' && a.status !== 'no_show');
  const past = history.filter(a => a.day < todayKey() || a.status === 'completed' || a.status === 'no_show');

  function performDelete(id) {
    const target = allCustomers.find(c => c.id === id);
    setDeletedIds(prev => {
      const n = new Set(prev);
      n.add(id);
      return n;
    });
    setConfirmDelete(null);
    if (target) {
      showToast({ title: 'Client deleted', body: `${target.name} was removed from your client list.` });
    }
  }

  function handleAddClient(payload) {
    const id = 'c_new_' + Date.now();
    const newClient = {
      id,
      name: payload.name,
      phone: payload.phone || '',
      email: payload.email || '',
      notes: payload.notes || '',
      favorite: null,
      lastVisit: '—',
      visits: 0,
      noShows: 0,
    };
    setExtras(x => [newClient, ...x]);
    setSelected(id);
    setShowAdd(false);
  }

  function handleEditClient(payload) {
    if (!editId) return;
    setOverrides(o => ({
      ...o,
      [editId]: {
        ...(o[editId] || {}),
        name: payload.name,
        phone: payload.phone || '',
        email: payload.email || '',
        notes: payload.notes != null ? payload.notes : (o[editId]?.notes ?? ''),
      },
    }));
    setEditId(null);
  }

  // Save just the customer notes field without going through the full edit
  // modal — used by the inline NotesSection on the detail panel.
  function handleSaveNotes(id, notes) {
    setOverrides(o => ({
      ...o,
      [id]: { ...(o[id] || {}), notes },
    }));
  }

  const pending = confirmDelete ? allCustomers.find(c => c.id === confirmDelete) : null;
  const editingClient = editId ? allCustomers.find(c => c.id === editId) : null;

  // CSV export — one row per client, scoped to the current location. The
  // download filename uses today's date so re-exports don't collide.
  function exportCsv() {
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      // Wrap in quotes if it contains a comma, quote, or newline; double any embedded quotes.
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const header = ['Name', 'Phone', 'Email', 'Total visits', 'No-shows', 'Last visit', 'Favorite staff', 'Notes'];
    const rows = allCustomers.map(c => {
      const fav = c.favorite ? STAFF.find(s => s.id === c.favorite)?.name || '' : '';
      return [c.name, c.phone, c.email, c.visits ?? 0, c.noShows ?? 0, c.lastVisit || '', fav, c.notes || ''];
    });
    const csv = [header, ...rows].map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    const slug = (BUSINESS.name || 'clients').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    a.href = url;
    a.download = `${slug}-clients-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
    showToast({ title: 'Client list exported', body: `${rows.length} client${rows.length === 1 ? '' : 's'} saved as CSV.` });
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="CRM"
        title="Customers"
        subtitle="Client list with appointment history and preferences."
        right={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportCsv} disabled={allCustomers.length === 0}><I.Download size={14}/> Export CSV</Button>
            <Button variant="accent" onClick={() => setShowAdd(true)}><I.Plus size={14}/> Add client</Button>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 lg:col-span-4 p-2 self-start">
          <div className="p-2">
            <div className="relative">
              <I.Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, email" className="!pl-9" />
            </div>
          </div>
          <div className="divide-y divide-line max-h-[640px] overflow-auto">
            {filtered.map(c => (
              <div
                key={c.id}
                className={cx(
                  'group relative flex items-center transition',
                  selected === c.id ? 'bg-accentSoft/50' : 'hover:bg-bg/60'
                )}
              >
                <button
                  onClick={() => setSelected(c.id)}
                  className="flex-1 min-w-0 flex items-center gap-3 p-3 text-left"
                >
                  <CustomerAvatar name={c.name} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink truncate">{c.name}</div>
                    <div className="text-[12px] text-ink2 truncate">{c.phone}</div>
                  </div>
                  <div className="text-right pr-1">
                    <div className="text-[11px] text-muted">{c.visits} visits</div>
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(c.id); }}
                  title={`Delete ${c.name}`}
                  aria-label={`Delete ${c.name}`}
                  className="mr-2 w-8 h-8 rounded-md text-muted hover:text-rose hover:bg-roseSoft flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                >
                  <I.Trash size={14} />
                </button>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-4 py-10 text-center text-[13px] text-muted">No clients match your search.</div>
            )}
          </div>
        </Card>

        <div className="col-span-12 lg:col-span-8 space-y-5">
          {customer ? (
            <>
              <Card className="p-5">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <CustomerAvatar name={customer.name} size={56} />
                    <div className="min-w-0">
                      <div className="font-serif text-[28px] text-ink leading-tight">{customer.name}</div>
                      <div className="text-[13px] text-ink2 flex flex-wrap items-center gap-3 mt-0.5">
                        <span className="inline-flex items-center gap-1"><I.Phone size={12}/> {customer.phone}</span>
                        <span className="inline-flex items-center gap-1"><I.Mail size={12}/> {customer.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="secondary" size="sm" onClick={() => setEditId(customer.id)}><I.Edit size={13}/> Edit</Button>
                    <button
                      onClick={() => setConfirmDelete(customer.id)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-roseSoft text-rose hover:bg-[#efd0d7] transition text-[13px] font-medium"
                    >
                      <I.Trash size={13}/> Delete
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Total visits" value={customer.visits} />
                  <Stat label="Last visit" value={customer.lastVisit} small />
                </div>

                <div className="mt-5 pt-5 border-t border-line">
                  <NotesSection
                    value={customer.notes || ''}
                    label="Customer notes"
                    placeholder="Add preferences, allergies, special instructions, or internal notes..."
                    emptyText="No customer notes added."
                    onSave={(notes) => handleSaveNotes(customer.id, notes)}
                  />
                </div>

              </Card>

              <Card className="p-5">
                <h3 className="font-serif text-[22px] text-ink mb-3">Appointment history</h3>
                {upcoming.length > 0 && (
                  <>
                    <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">Upcoming</div>
                    <div className="space-y-1.5 mb-4">
                      {upcoming.map(a => <HistoryRow key={a.id} appt={a} onOpen={onOpen} />)}
                    </div>
                  </>
                )}
                {past.length > 0 ? (
                  <>
                    <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">Past</div>
                    <div className="space-y-1.5">
                      {past.map(a => <HistoryRow key={a.id} appt={a} onOpen={onOpen} />)}
                    </div>
                  </>
                ) : upcoming.length === 0 && (
                  <div className="text-[13.5px] text-muted italic">No appointments yet.</div>
                )}
              </Card>
            </>
          ) : (
            <Card className="p-10">
              <EmptyState
                title="No client selected"
                body="Pick a client from the list, or add a new one to get started."
              />
            </Card>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <Modal open={!!pending} onClose={() => setConfirmDelete(null)} maxWidth="max-w-md">
        {pending && (
          <div className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-roseSoft text-rose flex items-center justify-center flex-shrink-0">
                <I.Trash size={16} />
              </div>
              <div>
                <h3 className="font-serif text-[22px] text-ink leading-tight">Delete client?</h3>
                <p className="text-[13.5px] text-ink2 mt-1">
                  This will remove <span className="font-medium text-ink">{pending.name}</span> from your client list. Their past appointment history will stay on record but they won't appear here anymore.
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => performDelete(pending.id)}>
                <I.Trash size={13}/> Delete client
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / Edit client modal */}
      {(showAdd || editingClient) && (
        <ClientModal
          existing={editingClient}
          onClose={() => { setShowAdd(false); setEditId(null); }}
          onSubmit={editingClient ? handleEditClient : handleAddClient}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Add / Edit client modal
// ────────────────────────────────────────────────────────────

export function ClientModal({ onClose, onSubmit, existing }) {
  const isEdit = !!existing;

  const initial = useMemo(() => ({
    name: existing?.name || '',
    phone: existing?.phone || '',
    email: existing?.email || '',
    notes: existing?.notes || '',
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [notes, setNotes] = useState(initial.notes);
  const [errors, setErrors] = useState({});
  const [confirmClose, setConfirmClose] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => { nameRef.current && nameRef.current.focus(); }, []);

  const dirty =
    String(name).trim() !== String(initial.name).trim() ||
    String(phone).trim() !== String(initial.phone).trim() ||
    String(email).trim() !== String(initial.email).trim() ||
    String(notes).trim() !== String(initial.notes).trim();

  const isValid = name.trim().length > 0 && (
    !email.trim() || /.+@.+\..+/.test(email.trim())
  );

  // For Add: enabled once valid. For Edit: only when dirty AND valid.
  const canSubmit = isValid && (isEdit ? dirty : true);

  function handleSubmit() {
    const errs = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (email.trim() && !/.+@.+\..+/.test(email.trim())) errs.email = 'Enter a valid email';
    setErrors(errs);
    if (Object.keys(errs).length) return false;
    onSubmit({ name: name.trim(), phone: phone.trim(), email: email.trim(), notes: notes.trim() });
    return true;
  }

  function requestClose() {
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  // Guard sidebar / route navigation while open.
  useDirtyGuard({
    dirty,
    onSave: () => { if (canSubmit) handleSubmit(); },
    onDiscard: () => onClose(),
    hideSave: !isEdit, // Add flow: no "Save & leave" option
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
      onClick={requestClose}>
      <div
        className="relative w-full max-w-lg bg-surface rounded-2xl shadow-pop border border-line"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="font-serif text-[22px] text-ink leading-none whitespace-nowrap">{isEdit ? 'Edit client' : 'Add client'}</h2>
          <button
            onClick={requestClose}
            className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-ink2 hover:bg-bg transition"
            aria-label="Close">
            <I.X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-5 space-y-4">
          <div>
            <FieldLabel required>Name</FieldLabel>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); if (errors.name) setErrors(er => ({ ...er, name: undefined })); }}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="Full name"
              className={cx('!h-11', errors.name && '!border-rose')}
            />
            {errors.name && <div className="mt-1 text-[12px] text-rose font-medium">{errors.name}</div>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel optional>Phone</FieldLabel>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(415) 555-0000"
                className="!h-11"
              />
            </div>
            <div>
              <FieldLabel optional>Email</FieldLabel>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(er => ({ ...er, email: undefined })); }}
                placeholder="name@example.com"
                className={cx('!h-11', errors.email && '!border-rose')}
              />
              {errors.email && <div className="mt-1 text-[12px] text-rose font-medium">{errors.email}</div>}
            </div>
          </div>

          <div>
            <FieldLabel optional>Customer notes</FieldLabel>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add preferences, allergies, special instructions, or internal notes..."
              rows={3}
              className="w-full resize-y leading-snug"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-1 flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" size="lg" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="button" variant="accent" size="lg" onClick={handleSubmit} disabled={!canSubmit}>
            {isEdit ? 'Save changes' : 'Add client'}
          </Button>
        </div>
      </div>

      {/* Unsaved-changes confirmation (close attempt) */}
      <UnsavedChangesModal
        open={confirmClose}
        onSave={() => {
          if (canSubmit && handleSubmit()) setConfirmClose(false);
        }}
        onDiscard={() => { setConfirmClose(false); onClose(); }}
        onStay={() => setConfirmClose(false)}
        hideSave={!isEdit}
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

export function Stat({ label, value, small, tone }) {
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className={cx('mt-0.5', small ? 'text-[15px] font-medium' : 'font-serif text-[26px] leading-none', tone === 'rose' ? 'text-rose' : 'text-ink')}>{value}</div>
    </div>
  );
}

export function HistoryRow({ appt, onOpen }) {
  const svc = SERVICES.find(s => s.id === appt.serviceId);
  const staff = STAFF.find(s => s.id === appt.staffId);
  return (
    <button onClick={()=>onOpen(appt)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg/70 transition text-left">
      <div className="w-[80px]">
        <div className="text-[12.5px] font-medium text-ink">{parseDay(appt.day).toLocaleDateString('en-US',{month:'short', day:'numeric'})}</div>
        <div className="text-[11px] text-muted">{fmt12(appt.start)}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] text-ink truncate"><span className="font-medium">{svc.name}</span> · with {staff.name}</div>
        <div className="text-[11.5px] text-muted">${svc.price}</div>
      </div>
      <StatusPill status={appt.status} />
    </button>
  );
}

window.CustomersPage = CustomersPage;
