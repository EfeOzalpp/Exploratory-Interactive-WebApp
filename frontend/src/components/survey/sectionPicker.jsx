// src/components/survey/sectionPicker.jsx
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';

export default function SectionPickerIntro({
  value,
  onChange,
  onBegin,
  error,
  sections = [],
}) {
  const options = useMemo(() => sections, [sections]);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(
    Math.max(0, options.findIndex((o) => o.value === value))
  );
  const [placement, setPlacement] = useState('down');

  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const listboxId = 'section-listbox';

  const current = options.find((o) => o.value === value);

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, []);

  useEffect(() => {
    const computePlacement = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportH = window.innerHeight || document.documentElement.clientHeight;
      const spaceBelow = viewportH - rect.bottom;
      const estimatedListHeight = Math.min(260, options.length * 44 + 12);
      setPlacement(spaceBelow >= estimatedListHeight ? 'down' : 'up');
    };
    if (open) computePlacement();
    const onWin = () => open && computePlacement();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open, options.length]);

  const moveActive = useCallback(
    (delta) => {
      setActiveIndex((idx) => (idx + delta + options.length) % options.length);
    },
    [options.length]
  );

  const chooseIndex = useCallback(
    (idx) => {
      const opt = options[idx];
      if (!opt) return;
      onChange?.(opt.value);
      setOpen(false);
      if (buttonRef.current) buttonRef.current.focus();
    },
    [onChange, options]
  );

  useEffect(() => {
    const idx = options.findIndex((o) => o.value === value);
    if (idx >= 0) setActiveIndex(idx);
  }, [value, options]);

  return (
    <div className="surveyStart">
      <h3 className="begin-title1">Select Your Department</h3>

      <div ref={wrapperRef} className="section-picker">
        {open && placement === 'up' && (
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-activedescendant={
              options[activeIndex] ? `opt-${options[activeIndex].value}` : undefined
            }
            className="section-listbox drop-up"
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
              else if (e.key === 'Home') { e.preventDefault(); setActiveIndex(0); }
              else if (e.key === 'End') { e.preventDefault(); setActiveIndex(options.length - 1); }
              else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseIndex(activeIndex); }
              else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); if (buttonRef.current) buttonRef.current.focus(); }
            }}
          >
            {options.map((opt, idx) => {
              const selected = value === opt.value;
              const active = idx === activeIndex;
              return (
                <div
                  id={`opt-${opt.value}`}
                  key={opt.value}
                  role="option"
                  aria-selected={selected}
                  className={`section-option${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => chooseIndex(idx)}
                >
                  <span className={`section-dot${selected ? ' is-selected' : ''}`} />
                  <span className="section-label">{opt.label}</span>
                </div>
              );
            })}
          </div>
        )}

        <button
          ref={buttonRef}
          type="button"
          aria-label="My MassArt..."
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          className="section-trigger"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); moveActive(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); if (!open) setOpen(true); moveActive(-1); }
            else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!open) setOpen(true); else chooseIndex(activeIndex); }
            else if (e.key === 'Escape') { setOpen(false); }
          }}
        >
          <span>{current ? current.label : 'MassArt...'}</span>
          <span className="section-chevron">▾</span>
        </button>

        {open && placement === 'down' && (
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-activedescendant={
              options[activeIndex] ? `opt-${options[activeIndex].value}` : undefined
            }
            className="section-listbox drop-down"
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
              else if (e.key === 'Home') { e.preventDefault(); setActiveIndex(0); }
              else if (e.key === 'End') { e.preventDefault(); setActiveIndex(options.length - 1); }
              else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseIndex(activeIndex); }
              else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); if (buttonRef.current) buttonRef.current.focus(); }
            }}
          >
            {options.map((opt, idx) => {
              const selected = value === opt.value;
              const active = idx === activeIndex;
              return (
                <div
                  id={`opt-${opt.value}`}
                  key={opt.value}
                  role="option"
                  aria-selected={selected}
                  className={`section-option${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => chooseIndex(idx)}
                >
                  <span className={`section-dot${selected ? ' is-selected' : ''}`} />
                  <span className="section-label">{opt.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <div className="error-container">
          <h2>{error}</h2>
          {!/section/i.test(error) && <p className="email-tag">Mail: eozalp@massart.edu</p>}
        </div>
      )}

      <button className="begin-button" onClick={onBegin}>
        <h4>Next</h4>
      </button>
    </div>
  );
}
