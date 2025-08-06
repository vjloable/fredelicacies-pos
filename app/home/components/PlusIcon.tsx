// components/icons/HomeIcon.tsx
export default function PlusIcon({ className, ...props }: { className?: string; [key: string]: any }) {
  return (
    <svg 
      className={className}
      width="15" 
      height="15" 
      viewBox="0 0 15 15" 
      fill="none"
      {...props}
    >
    <path d="M0.89502 7.50028H7.59854M14.3021 7.50028L7.59854 7.50028M7.59854 7.50028V0.796753M7.59854 7.50028L7.59854 14.2038" stroke="#4C2E24" strokeWidth="3"/>
    </svg>
  );
}


