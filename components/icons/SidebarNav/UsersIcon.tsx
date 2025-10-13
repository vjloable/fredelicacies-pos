interface UsersIconProps {
  className?: string;
}

export default function UsersIcon({ className = "" }: UsersIconProps) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
      <path d="M20.5 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/>
      <path d="M19 19a5 5 0 00-2.5-4.33"/>
      <path d="M3.5 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/>
      <path d="M5 19a5 5 0 012.5-4.33"/>
    </svg>
  );
}