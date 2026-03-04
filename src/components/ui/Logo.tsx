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
      {/* Rounded square background */}
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="4"
        fill="url(#logo-gradient)"
      />

      {/* Lightning bolt */}
      <path
        d="M13 3L8 13H12L11 21L16 11H12L13 3Z"
        fill="white"
        stroke="white"
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Gradient definition */}
      <defs>
        <linearGradient
          id="logo-gradient"
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#f757af" />
          <stop offset="100%" stopColor="#9b59b6" />
        </linearGradient>
      </defs>
    </svg>
  );
}
