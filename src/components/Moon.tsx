import { useId } from "react";
export default function Moon({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      className={`moon ${className}`}
      viewBox="0 0 600 600"
      role="img"
      aria-label="Moon / Луна"
    >
      <defs>
        <radialGradient id={`${id}surface`} cx="30%" cy="26%" r="77%">
          <stop stopColor="#d1d5ce" />
          <stop offset="0.5" stopColor="#858d90" />
          <stop offset="0.85" stopColor="#343f4a" />
          <stop offset="1" stopColor="#101f30" />
        </radialGradient>
        <radialGradient id={`${id}crater`}>
          <stop stopColor="#1f2c35" stopOpacity="0.6" />
          <stop offset="0.75" stopColor="#c7cecb" stopOpacity="0.08" />
          <stop offset="1" stopColor="#d9ddcf" stopOpacity="0.35" />
        </radialGradient>
        <clipPath id={`${id}clip`}>
          <circle cx="300" cy="300" r="246" />
        </clipPath>
        <filter id={`${id}noise`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.045"
            numOctaves="4"
            seed="12"
          />
          <feColorMatrix type="saturate" values="0" />
          <feBlend in="SourceGraphic" mode="multiply" />
        </filter>
      </defs>
      <circle cx="300" cy="300" r="247" fill="#78c1cb" opacity="0.1" />
      <g clipPath={`url(#${id}clip)`}>
        <circle cx="300" cy="300" r="246" fill={`url(#${id}surface)`} />
        <g fill="#263740" opacity="0.22">
          <ellipse cx="218" cy="220" rx="75" ry="65" />
          <ellipse cx="328" cy="156" rx="64" ry="52" />
          <ellipse cx="203" cy="345" rx="60" ry="100" />
          <ellipse cx="391" cy="297" rx="71" ry="51" />
        </g>
        <rect
          x="45"
          y="45"
          width="510"
          height="510"
          filter={`url(#${id}noise)`}
          opacity="0.23"
          fill="#b3b6ae"
        />
        {Array.from({ length: 55 }, (_, i) => {
          const x = 80 + ((i * 89.7) % 445);
          const y = 75 + ((i * 137.3) % 450);
          const r = 3 + ((i * 7.3) % 29);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={r}
              fill={`url(#${id}crater)`}
              opacity={0.25 + (i % 5) * 0.1}
            />
          );
        })}
      </g>
      <ellipse
        cx="300"
        cy="300"
        rx="281"
        ry="103"
        fill="none"
        stroke="#56d0d9"
        strokeWidth="1"
        strokeOpacity="0.4"
        transform="rotate(-44 300 300)"
      />
      <circle cx="480" cy="104" r="5" fill="#74f2e0" />
      <circle
        cx="480"
        cy="104"
        r="12"
        fill="none"
        stroke="#74f2e0"
        strokeOpacity="0.4"
      />
    </svg>
  );
}
