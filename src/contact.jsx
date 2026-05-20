import { useState } from 'react';
import { I } from './icons';
import { Button, Card, Field, formatPhoneInput, isValidPhone } from './ui';

// Contact Us page — custom Formspree contact form. Submits via fetch
// JSON so we stay on-page and can show inline success / error states
// that match the rest of the app. Uses the existing Field / Button /
// Card primitives + the shared phone formatter so styling, focus
// states, and validation feel native to the SaaS.

export const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xaqkqwlo';

export const CONTACT_REASONS = [
'General question',
'Billing or subscription',
'Technical issue',
'Feature request',
'Feedback',
'Other'];


export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [business, setBusiness] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState(CONTACT_REASONS[0]);
  const [message, setMessage] = useState('');

  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const errors = {
    name: !name.trim() ? 'Name is required' : '',
    email: !email.trim() ?
    'Email is required' :
    !emailRe.test(email.trim()) ?
    'Enter a valid email' :
    '',
    business: !business.trim() ? 'Business name is required' : '',
    phone: phone && !isValidPhone(phone) ? 'Enter a 10-digit phone number' : '',
    message: !message.trim() ? 'Message is required' : ''
  };
  const hasErrors = !!(errors.name || errors.email || errors.business || errors.phone || errors.message);
  const formFilled = name.trim() && email.trim() && business.trim() && message.trim() && !errors.email && !errors.phone;
  const canSubmit = formFilled && !submitting;

  function markTouched(key) {setTouched((t) => ({ ...t, [key]: true }));}

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError('');
    setTouched({ name: true, email: true, business: true, phone: true, message: true });
    if (hasErrors) return;
    setSubmitting(true);
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          business: business.trim(),
          phone: phone.trim(),
          subject,
          message: message.trim(),
          _subject: `Contact form: ${subject}${business ? ` — ${business.trim()}` : ''}`
        })
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        let body = {};
        try {body = await res.json();} catch (_) {}
        const detail = body.errors && body.errors[0] && body.errors[0].message || body.error;
        setSubmitError(detail || 'Something went wrong sending your message. Please try again.');
      }
    } catch (err) {
      setSubmitError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setName('');setEmail('');setBusiness('');setPhone('');
    setSubject(CONTACT_REASONS[0]);setMessage('');
    setTouched({});setSubmitError('');setSubmitted(false);
  }

  // ── Success state ──────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="max-w-[640px] mx-auto">
        <Card className="p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-accentSoft text-accent mx-auto flex items-center justify-center mb-4">
            <I.Check size={26} stroke={2.2} />
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-ink">Thanks — we'll get back to you soon</h2>
          <p className="text-[13.5px] text-ink2 mt-2 max-w-md mx-auto">
            Your message is on its way. Someone from the team typically replies within one business day.
          </p>
          <div className="mt-6 inline-flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={resetForm}>Send another message</Button>
          </div>
        </Card>
      </div>);

  }

  // ── Form ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-[640px] mx-auto">
      <Card className="p-6 md:p-10">
        <div className="text-center mb-6">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted font-medium mb-1.5">Support</div>
          <h2 className="font-serif text-[34px] leading-tight text-ink">Contact Us</h2>
          <p className="text-[13.5px] text-ink2 mt-1.5 max-w-md mx-auto">
            Questions, feedback, or a feature request? Send us a note and we'll get back to you within one business day.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4 contact-form">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name" error={touched.name ? errors.name : ''}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => markTouched('name')}
                placeholder="Jane Cooper"
                maxLength={120}
                autoComplete="name"
                aria-invalid={!!(touched.name && errors.name)} />
              
            </Field>
            <Field
              label="Email"
              error={touched.email ? errors.email : ''}>
              
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => markTouched('email')}
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={!!(touched.email && errors.email)} />
              
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Business name" error={touched.business ? errors.business : ''}>
              <input
                type="text"
                value={business}
                onChange={(e) => setBusiness(e.target.value)}
                onBlur={() => markTouched('business')}
                placeholder="e.g. Avalon Salon & Spa"
                maxLength={160}
                autoComplete="organization"
                aria-invalid={!!(touched.business && errors.business)} />
              
            </Field>
            <Field
              label="Phone number"
              optional
              error={touched.phone ? errors.phone : ''}>
              
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                onBlur={() => markTouched('phone')}
                placeholder="(123) 456-7890"
                autoComplete="tel"
                aria-invalid={!!(touched.phone && errors.phone)} />
              
            </Field>
          </div>

          <Field label="What's this about?">
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="contact-select" style={{ padding: "0px 36px 0px 7px" }}>
              {CONTACT_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>

          <Field
            label="Message"
            error={touched.message ? errors.message : ''}>
            
            <textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onBlur={() => markTouched('message')}
              placeholder="Tell us a little about what you need…"
              aria-invalid={!!(touched.message && errors.message)}
              style={{ minHeight: 140, padding: "5px 12px 10px 7px" }}
              maxLength={4000} />
            
          </Field>

          {submitError &&
          <div className="flex items-start gap-2 rounded-lg border border-rose/40 bg-roseSoft/50 px-3.5 py-2.5 text-[12.5px] text-[#7A2A3D]">
              <I.Bell size={14} className="mt-0.5 flex-shrink-0" />
              <div>{submitError}</div>
            </div>
          }

          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-[11.5px] text-muted">
              By submitting, you'll receive a reply at the email above.
            </span>
            <Button type="submit" variant="accent" disabled={!canSubmit}>
              {submitting ?
              <>
                  <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Sending…
                </> :

              <>
                  <I.Mail size={14} /> Send Message
                </>
              }
            </Button>
          </div>
        </form>
      </Card>
      <style>{`
        /* Make the native <select> visually match the other form inputs:
           same font, line-height, and a custom chevron that lines up with
           the input padding. Without this, the browser default font + arrow
           leaks through and looks inconsistent with the rest of the form. */
        .contact-select {
          font-family: inherit;
          font-size: 14px;
          line-height: 1.4;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          padding-right: 36px;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235C5852' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
          background-repeat: no-repeat;
          background-position: right 12px center;
        }
        /* Keep the message textarea on the same type scale as the inputs. */
        .contact-form textarea,
        .contact-form input,
        .contact-form select {
          font-family: inherit;
          font-size: 14px;
        }
        .contact-form textarea::placeholder,
        .contact-form input::placeholder { color: #8A857B; }
      `}</style>
    </div>);

}

window.ContactPage = ContactPage;