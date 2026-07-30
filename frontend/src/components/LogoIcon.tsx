

const LogoIcon = ({ width = 40, height = 40, className = '', style = {}, showText = true }) => {
  // If showText is true, the SVG is wider to accommodate the text.
  const svgWidth = showText ? width * 4 : width;
  const viewBox = showText ? "0 0 400 100" : "0 0 100 100";

  return (
    <svg 
      width={svgWidth} 
      height={height} 
      viewBox={viewBox} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ filter: 'drop-shadow(0px 4px 8px rgba(0,0,0,0.3))', ...style }}
    >
      {/* --- ICON PART (0 to 100) --- */}
      {/* Outer Glow / Halo */}
      <circle cx="50" cy="50" r="45" stroke="var(--accent-blue)" strokeWidth="1" strokeDasharray="5 5" opacity="0.3" />
      
      {/* Abstract Building/Portal Shapes */}
      <path d="M 25 80 L 25 40 L 40 25 L 50 15 L 60 25 L 75 40 L 75 80 Z" fill="url(#gradient-portal)" />
      
      {/* Inner Glowing Core */}
      <rect x="42" y="45" width="16" height="35" rx="8" fill="url(#gradient-core)" />
      
      {/* Futuristic Accents */}
      <path d="M 35 60 L 35 80" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" />
      <path d="M 65 60 L 65 80" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" />
      
      {/* Green Tech Dot */}
      <circle cx="50" cy="35" r="4" fill="var(--accent-green)" />

      {/* --- TEXT PART (110 to 400) --- */}
      {showText && (
        <g transform="translate(110, 0)">
          {/* Main Title */}
          <text x="0" y="52" fontFamily="sans-serif" fontWeight="900" fontSize="42" fill="var(--text-primary)" letterSpacing="2">
            EL NARGES
          </text>
          
          {/* Subtitle */}
          <text x="2" y="85" fontFamily="sans-serif" fontWeight="bold" fontSize="22" fill="var(--text-muted)" letterSpacing="12">
            PORTAL
          </text>

          {/* Accent Line */}
          <rect x="2" y="93" width="60" height="4" rx="2" fill="var(--accent-blue)" />
          <rect x="66" y="93" width="20" height="4" rx="2" fill="var(--accent-green)" />
        </g>
      )}

      <defs>
        <linearGradient id="gradient-portal" x1="50" y1="15" x2="50" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent-blue)" />
          <stop offset="100%" stopColor="var(--bg-tertiary)" />
        </linearGradient>
        <linearGradient id="gradient-core" x1="50" y1="45" x2="50" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent-green)" />
          <stop offset="100%" stopColor="var(--accent-blue-bg)" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default LogoIcon;
