import React from 'react';
import { useGraph } from '../../context/graphContext.tsx';
import "../../styles/city.css";

export default function CityButton({
  isOpen,
  onToggle,
  shown = true,
}: {
  isOpen: boolean;
  onToggle: () => void;
  shown?: boolean;
}) {
  const { darkMode } = useGraph(); // ← global dark mode

  return (
    <div className={`city-button-boundary ${shown ? 'shown' : 'hidden'}`}>
      <div className="city-button-rotator">
        <button
          className={`city-button ${isOpen ? 'open' : ''} ${darkMode ? 'is-dark' : ''}`}
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close City menu' : 'Open City menu'}
          type="button"
        >
          <span className={`city-button-text ${isOpen ? 'hidden-text' : ''}`}>
            Full City
          </span>
          <Chevron className="city-chevron" isOpen={isOpen} />
        </button>
      </div>
    </div>
  );
}

function Chevron({ className = '', isOpen = false }: { className?: string; isOpen?: boolean }) {
  if (isOpen) {
    // "X" icon for close
    return (
      <svg
        className={className}
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }

  // Default chevron-down for closed
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
