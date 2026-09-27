// components/icons/SidebarNav/CashOnHandIcon.tsx
export default function CashOnHandIcon({ className }: { className?: string }) {
  return (
    <svg
      width="49"
      height="48"
      viewBox="0 0 49 48"
      fill="none"
      className={className}
    >
      <rect
        x="13"
        y="16"
        width="23"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="24.5" cy="24" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M17 20.5C18.3807 20.5 19.5 19.3807 19.5 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M32 27.5C30.6193 27.5 29.5 28.6193 29.5 30"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
