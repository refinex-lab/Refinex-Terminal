/**
 * Refinex Terminal Logo Component
 *
 * A small SVG logo that can be used in the sidebar header and other UI elements.
 */

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className = "", size = 24 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Lightning bolt - adapts to theme */}
      <path
        d="M13 3L8 13H12L11 21L16 11H12L13 3Z"
        fill="var(--ui-foreground)"
        stroke="var(--ui-foreground)"
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}
