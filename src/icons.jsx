// Stroke-based line icons. 1.6 stroke, 18px viewBox 24.
export const Icon = ({ d, size=18, stroke=1.6, fill='none', className='' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill} stroke="currentColor"
       strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

export const I = {
  Dashboard: (p) => <Icon {...p} d="M4 13l8-8 8 8M6 11v9h12v-9" />,
  Calendar: (p) => <Icon {...p} d={<g><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></g>} />,
  List: (p) => <Icon {...p} d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  Users: (p) => <Icon {...p} d={<g><circle cx="9" cy="9" r="3"/><path d="M3 19c0-3 2.5-5 6-5s6 2 6 5"/><circle cx="17" cy="8" r="2.5"/><path d="M15 14c3.5 0 6 1.7 6 4.5"/></g>} />,
  Sparkles: (p) => <Icon {...p} d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3zM18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14z" />,
  Scissors: (p) => <Icon {...p} d={<g><circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8 9l12 8M8 15l12-8"/></g>} />,
  Door: (p) => <Icon {...p} d={<g><rect x="5" y="3" width="14" height="18" rx="1"/><circle cx="15" cy="12" r="0.6" fill="currentColor"/></g>} />,
  Globe: (p) => <Icon {...p} d={<g><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></g>} />,
  Phone: (p) => <Icon {...p} d="M5 4l3 0 1.5 4-2 1.5a12 12 0 006 6L15 13.5l4 1.5v3a2 2 0 01-2 2A14 14 0 013 6a2 2 0 012-2z" />,
  Bell: (p) => <Icon {...p} d="M6 16V11a6 6 0 0112 0v5l1.5 2H4.5L6 16zM10 20a2 2 0 004 0" />,
  AlertTriangle: (p) => <Icon {...p} d={<g><path d="M12 4l9.5 16.5H2.5L12 4z"/><path d="M12 10v5M12 18h.01"/></g>} />,
  Chart: (p) => <Icon {...p} d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
  Settings: (p) => <Icon {...p} d={<g><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5l1.6.9-2 3.4-1.8-.5a7 7 0 01-1.6.9l-.4 1.8h-4l-.4-1.8a7 7 0 01-1.6-.9l-1.8.5-2-3.4 1.6-.9a7 7 0 010-1.8L4.4 11.6l2-3.4 1.8.5a7 7 0 011.6-.9L10.2 6h4l.4 1.8a7 7 0 011.6.9l1.8-.5 2 3.4-1.6.9a7 7 0 010 1.8z"/></g>} />,
  Search: (p) => <Icon {...p} d={<g><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></g>} />,
  Plus: (p) => <Icon {...p} d="M5 12h14M12 5v14" />,
  Minus: (p) => <Icon {...p} d="M5 12h14" />,
  Check: (p) => <Icon {...p} d="M4 12l5 5 11-12" />,
  X: (p) => <Icon {...p} d="M6 6l12 12M18 6L6 18" />,
  ChevronRight: (p) => <Icon {...p} d="M9 5l7 7-7 7" />,
  ChevronLeft: (p) => <Icon {...p} d="M15 5l-7 7 7 7" />,
  ChevronDown: (p) => <Icon {...p} d="M5 9l7 7 7-7" />,
  ChevronUp: (p) => <Icon {...p} d="M5 15l7-7 7 7" />,
  Clock: (p) => <Icon {...p} d={<g><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></g>} />,
  Mail: (p) => <Icon {...p} d={<g><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></g>} />,
  Map: (p) => <Icon {...p} d={<g><path d="M12 21s-7-7.5-7-12a7 7 0 0114 0c0 4.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></g>} />,
  Dollar: (p) => <Icon {...p} d="M12 3v18M16 7H10a2.5 2.5 0 000 5h4a2.5 2.5 0 010 5H8" />,
  Filter: (p) => <Icon {...p} d="M4 5h16l-6 8v6l-4-2v-4L4 5z" />,
  Drag: (p) => <Icon {...p} d="M9 4v16M15 4v16" />,
  More: (p) => <Icon {...p} d={<g><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></g>} />,
  Edit: (p) => <Icon {...p} d="M4 20l4-1 11-11-3-3L5 16l-1 4zM13 6l3 3" />,
  Trash: (p) => <Icon {...p} d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  Tag: (p) => <Icon {...p} d="M4 4h7l9 9-7 7-9-9V4zM8 8h.01" />,
  Bolt: (p) => <Icon {...p} d="M13 3L4 14h6l-1 7 9-11h-6l1-7z" />,
  Sparkle: (p) => <Icon {...p} d="M12 3v6M12 15v6M3 12h6M15 12h6M5 5l4 4M15 15l4 4M5 19l4-4M15 9l4-4" />,
  Mic: (p) => <Icon {...p} d="M12 14a3 3 0 003-3V6a3 3 0 00-6 0v5a3 3 0 003 3zM5 11a7 7 0 0014 0M12 18v4" />,
  Star: (p) => <Icon {...p} d="M12 3l2.6 6 6.4.6-4.8 4.4 1.4 6.4L12 17l-5.6 3.4L7.8 14 3 9.6l6.4-.6L12 3z" />,
  Link: (p) => <Icon {...p} d="M10 14a4 4 0 005.6 0l3-3a4 4 0 00-5.6-5.6L11.5 7M14 10a4 4 0 00-5.6 0l-3 3a4 4 0 005.6 5.6L12.5 17" />,
  Copy: (p) => <Icon {...p} d={<g><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/></g>} />,
  Eye: (p) => <Icon {...p} d={<g><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></g>} />,
  Lightning: (p) => <Icon {...p} d="M13 3L4 14h6l-1 7 9-11h-6l1-7z" />,
  Refresh: (p) => <Icon {...p} d="M4 12a8 8 0 0114-5l2-2v6h-6l2-2a6 6 0 10-2 8" />,
  Image: (p) => <Icon {...p} d={<g><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M3 17l5-4 4 3 4-5 5 6"/></g>} />,
  Building: (p) => <Icon {...p} d={<g><rect x="4" y="3" width="16" height="18"/><path d="M9 7h.01M9 11h.01M9 15h.01M15 7h.01M15 11h.01M15 15h.01M10 21v-4h4v4"/></g>} />,
  Lock: (p) => <Icon {...p} d={<g><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></g>} />,
  Coffee: (p) => <Icon {...p} d={<g><path d="M4 8h13v6a4 4 0 01-4 4H8a4 4 0 01-4-4V8z"/><path d="M17 10h2a2 2 0 010 4h-2M7 3v2M10 3v2M13 3v2"/></g>} />,
  Menu: (p) => <Icon {...p} d="M3 6h18M3 12h18M3 18h18" />,
  Download: (p) => <Icon {...p} d="M12 4v12M7 11l5 5 5-5M5 20h14" />,
  Logo: ({size=24, className=''}) => (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className}>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#1A1815"/>
      <path d="M9 22V12c0-1.5 1-2.5 2.5-2.5h9c1.5 0 2.5 1 2.5 2.5v2" stroke="#FAF8F4" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M9 22h14" stroke="#FAF8F4" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M11 22v3M21 22v3" stroke="#FAF8F4" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="16" cy="16" r="2.4" fill="#3F5D43"/>
    </svg>
  ),
};

Object.assign(window, { Icon, I });
