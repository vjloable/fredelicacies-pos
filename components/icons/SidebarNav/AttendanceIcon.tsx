// Face-scan frame: the face attendance kiosk system.
export default function AttendanceIcon({ className }: { className?: string; }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className={className}>
      <path d="M13 18.5V16C13 14.3431 14.3431 13 16 13H18.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M29.5 13H32C33.6569 13 35 14.3431 35 16V18.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M35 29.5V32C35 33.6569 33.6569 35 32 35H29.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M18.5 35H16C14.3431 35 13 33.6569 13 32V29.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="20.5" cy="21.5" r="1.5" fill="currentColor" />
      <circle cx="27.5" cy="21.5" r="1.5" fill="currentColor" />
      <path d="M20 27C21 28.3 22.4 29 24 29C25.6 29 27 28.3 28 27" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  );
}
