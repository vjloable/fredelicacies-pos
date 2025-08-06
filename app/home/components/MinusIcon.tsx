// components/icons/HomeIcon.tsx
export default function MinusIcon({ className, ...props }: { className?: string; [key: string]: any }) {
  return (
    <svg 
      className={className}
      width="15"
      height="3"
      viewBox="0 0 15 3"
      fill="none"
      {...props}
    >
    <path d="M0.89502 1.50031L14.3021 1.50031" stroke="#4C2E24" strokeWidth="3"/>
    </svg>
  );
}


