// ─────────────────────────────────────────────────────────────
// bargraph/EmptyArt.tsx
// Simple decorative empty-state SVG
// ─────────────────────────────────────────────────────────────

import React from 'react';

type EmptyDustProps = {
  className?: string;
};

export default function EmptyDust({ className = '' }: EmptyDustProps) {
  return (
    <svg
      className={className}
      width={80}
      height={80}
      viewBox="0 0 80 80"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Empty dust particles"
    >
      {/* scattered dots */}
      <circle cx={20} cy={25} r={2} />
      <circle cx={40} cy={18} r={1.5} opacity={0.8} />
      <circle cx={60} cy={30} r={2} opacity={0.6} />
      <circle cx={28} cy={50} r={1.5} opacity={0.7} />
      <circle cx={50} cy={55} r={2} opacity={0.9} />
      <circle cx={36} cy={70} r={1} opacity={0.5} />
      <circle cx={62} cy={65} r={1.5} opacity={0.6} />
      <circle cx={18} cy={62} r={1} opacity={0.4} />

      {/* optional little sparkle */}
      <path
        d="M70 20l1.5 2.2L74 24l-2.5 1.8L70 28l-1.5-2.2L66 24l2.5-1.8L70 20z"
        opacity={0.5}
      />
    </svg>
  );
}
