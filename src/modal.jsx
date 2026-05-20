import { useState } from 'react';
import { ACCOUNT, CUSTOMERS, SERVICES, SERVICE_CATEGORIES, STAFF, fmt12, parseDay } from './data';
import { I } from './icons';
import { NotesSection } from './notes-section';
import { RescheduleModal } from './reschedule';
import { Button, CustomerAvatar, Modal, StaffAvatar, StatusPill, showToast } from './ui';

// Appointment detail modal

export function AppointmentModal({ appt, onClose, onUpdate }) {
  if (!appt) return null;
  const svc = SERVICES.find(s => s.id === appt.serviceId);
  const staff = STAFF.find(s => s.id === appt.staffId);
  const cust = CUSTOMERS.find(c => c.id === appt.customerId);
  // If the referenced service was deleted while this modal was open, bail.
  if (!svc || !staff || !cust) { onClose && onClose(); return null; }
  const cat = SERVICE_CATEGORIES.find(c => c.id === svc.category);
  const [rescheduling, setRescheduling] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  function setStatus(s) { onUpdate({ ...appt, status: s }); }

  function handleComplete() {
    setStatus('completed');
    setConfirmingCancel(false);
    onClose && onClose();
    showToast({ title: 'Appointment marked as complete', body: `${svc.name} with ${cust.name}.` });
  }

  function handleNoShow() {
    setStatus('no_show');
    setConfirmingCancel(false);
    onClose && onClose();
    showToast({ title: 'Marked as no-show', body: `${cust.name} didn't show for ${svc.name}.` });
  }

  function handleCancel() {
    setStatus('canceled');
    setConfirmingCancel(false);
    onClose && onClose();
    showToast({ title: 'Appointment successfully canceled', body: `${cust.name}'s ${svc.name} was canceled.` });
  }

  function handleRestore() {
    setStatus('confirmed');
    setConfirmingCancel(false);
    onClose && onClose();
    showToast({ title: 'Appointment restored', body: `${cust.name}'s ${svc.name} is back on the books.` });
  }

  function handleReopen() {
    setStatus('confirmed');
    setConfirmingCancel(false);
    onClose && onClose();
    showToast({ title: 'Appointment reopened', body: `${cust.name}'s ${svc.name} is active again.` });
  }

  function handleRescheduleConfirm(updated) {
    onUpdate(updated);
    setRescheduling(false);
    setConfirmingCancel(false);
    onClose && onClose();
    const when = parseDay(updated.day).toLocaleDateString('en-US',{ weekday:'short', month:'short', day:'numeric' });
    showToast({ title: 'Appointment successfully rescheduled', body: `Moved to ${when} at ${fmt12(updated.start)}.` });
  }

  const sourceLabel = {
    walkin:'Walk-in', phone:'Phone', online:'Online',
    ai: ACCOUNT.aiAgentEnabled !== false ? 'AI Receptionist' : 'Online',
  }[appt.source] || appt.source;

  // While the reschedule popup is open, hide the parent appointment modal so
  // only one dialog has Escape/backdrop focus.
  if (rescheduling) {
    return (
      <RescheduleModal
        appt={appt}
        onClose={() => setRescheduling(false)}
        onConfirm={handleRescheduleConfirm}
      />
    );
  }

  const isCompleted = appt.status === 'completed';
  const isNoShow    = appt.status === 'no_show';
  const isCanceled  = appt.status === 'canceled';
  const isClosed    = isCompleted || isNoShow || isCanceled;

  return (
    <Modal open onClose={onClose} maxWidth="max-w-xl">
      <div className="p-6 border-b border-line flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted font-medium mb-1">{cat.name} · {sourceLabel}</div>
          <div className="font-serif text-[28px] leading-tight text-ink">{svc.name}</div>
          <div className="text-sm text-ink2 mt-1">{appt.duration} min · ${svc.price}</div>
        </div>
        <button onClick={onClose} className="text-ink2 hover:text-ink p-1.5 -m-1.5"><I.X /></button>
      </div>

      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CustomerAvatar name={cust.name} size={40} />
            <div>
              <div className="font-medium text-ink">{cust.name}</div>
              <div className="text-[13px] text-ink2 flex items-center gap-3">
                <span className="inline-flex items-center gap-1"><I.Phone size={12} /> {cust.phone}</span>
                <span className="inline-flex items-center gap-1"><I.Mail size={12} /> {cust.email}</span>
              </div>
            </div>
          </div>
          <StatusPill status={appt.status} />
        </div>

        {/* Customer notes — pulled from the client profile, read-only here.
            Edit them on the Customers page. */}
        {cust.notes && cust.notes.trim() && (
          <NotesSection value={cust.notes} label="Customer notes" />
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-line p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Staff</div>
            <div className="flex items-center gap-2"><StaffAvatar staff={staff} size={24} /> <span className="font-medium text-ink">{staff.name}</span></div>
            <div className="text-[12.5px] text-ink2 mt-0.5">{staff.role}</div>
          </div>
          <div className="rounded-lg border border-line p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted mb-1">When</div>
            <div className="font-medium text-ink">{parseDay(appt.day).toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'})}</div>
            <div className="text-[12.5px] text-ink2 mt-0.5">{fmt12(appt.start)} – {fmt12(appt.end)}</div>
          </div>
        </div>

        {/* Status banners */}
        {isCompleted && (
          <div className="rounded-lg border border-accent/25 bg-accentSoft/50 px-3.5 py-2.5 flex items-center gap-2.5 text-[13px] text-accentInk">
            <I.Check size={14} className="text-accent shrink-0"/>
            <span><span className="font-medium">Completed.</span> This appointment is closed and can no longer be changed.</span>
          </div>
        )}
        {isNoShow && (
          <div className="rounded-lg border px-3.5 py-2.5 flex items-center gap-2.5 text-[13px]" style={{ borderColor: '#D4B776', background: '#FBF4DD', color: '#6B4D00' }}>
            <I.AlertTriangle size={14} className="shrink-0" style={{ color: '#A07A1E' }}/>
            <span><span className="font-medium">No-show.</span> Client didn't arrive. Reopen to bring the appointment back.</span>
          </div>
        )}
        {isCanceled && (
          <div className="rounded-lg border border-rose/25 bg-roseSoft/50 px-3.5 py-2.5 flex items-center gap-2.5 text-[13px] text-rose">
            <I.X size={14} className="text-rose shrink-0"/>
            <span><span className="font-medium">Canceled.</span> Restore the appointment to bring it back.</span>
          </div>
        )}

        {/* Notes — inline editable, always visible (with empty state). */}
        <NotesSection
          appt={appt}
          onSave={(notes) => onUpdate({ ...appt, notes })}
        />
      </div>

      <div className="px-6 py-4 bg-bg/60 border-t border-line">
        {confirmingCancel ? (
          <div className="flex flex-wrap items-center justify-between gap-3 fadein">
            <div className="text-[13px] text-ink">Cancel this appointment?</div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmingCancel(false)}>Keep it</Button>
              <Button variant="danger" size="sm" onClick={handleCancel}>Yes, cancel</Button>
            </div>
          </div>
        ) : isCompleted ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px] text-ink2">Reopen to reschedule or cancel.</div>
            <Button variant="accent" size="sm" onClick={handleReopen}>
              <I.Refresh size={14}/> Reopen appointment
            </Button>
          </div>
        ) : isNoShow ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px] text-ink2">Reopen if the client did arrive after all.</div>
            <Button variant="accent" size="sm" onClick={handleReopen}>
              <I.Refresh size={14}/> Reopen appointment
            </Button>
          </div>
        ) : isCanceled ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px] text-ink2">This appointment was canceled.</div>
            <Button variant="accent" size="sm" onClick={handleRestore}>
              <I.Refresh size={14}/> Restore appointment
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="accent" size="sm" onClick={handleComplete}><I.Check size={14}/> Mark completed</Button>
              <Button variant="secondary" size="sm" onClick={() => setRescheduling(true)}>Reschedule</Button>
              <Button variant="secondary" size="sm" onClick={handleNoShow}><I.AlertTriangle size={14}/> Mark no-show</Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="danger" size="sm" onClick={() => setConfirmingCancel(true)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

window.AppointmentModal = AppointmentModal;
