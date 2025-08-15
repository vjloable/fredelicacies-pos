// components/icons/DeleteIcon.tsx
export default function DeleteIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className}
      width="18" 
      height="18" 
      viewBox="0 0 18 18" 
      fill="none"
    >
      <path 
        d="M6 2V1C6 0.447715 6.44772 0 7 0H11C11.5523 0 12 0.447715 12 1V2H16C16.5523 2 17 2.44772 17 3C17 3.55228 16.5523 4 16 4H15V14C15 15.1046 14.1046 16 13 16H5C3.89543 16 3 15.1046 3 14V4H2C1.44772 4 1 3.55228 1 3C1 2.44772 1.44772 2 2 2H6ZM8 2V1H10V2H8ZM5 4V14H13V4H5ZM7 6C7.55228 6 8 6.44772 8 7V11C8 11.5523 7.55228 12 7 12C6.44772 12 6 11.5523 6 11V7C6 6.44772 6.44772 6 7 6ZM11 6C11.5523 6 12 6.44772 12 7V11C12 11.5523 11.5523 12 11 12C10.4477 12 10 11.5523 10 11V7C10 6.44772 10.4477 6 11 6Z" 
        fill="#DC2626" 
        transform="scale(0.75) translate(2.25, 1.5)"
      />
    </svg>
  );
}
