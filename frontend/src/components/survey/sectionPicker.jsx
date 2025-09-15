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
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState('down'); // 'down' | 'up'

  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listboxId = 'section-listbox';
  const openedByPointer = useRef(false); // track how we opened
  const current = options.find((o) => o.value === value) || null;

  // Filtered options by search (label + value)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q)
    );
  }, [options, search]);

  // Keep activeIndex in range when list changes
  useEffect(() => {
    setActiveIndex((idx) =>
      filtered.length ? Math.min(Math.max(idx, 0), filtered.length - 1) : 0
    );
  }, [filtered.length]);

  // Click outside closes
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

  // Compute placement when open
  useEffect(() => {
    const computePlacement = () => {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      const viewportH = window.innerHeight || document.documentElement.clientHeight;
      const spaceBelow = viewportH - rect.bottom;
      const estimatedListHeight = Math.min(260, filtered.length * 44 + 12);
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
  }, [open, filtered.length]);

  // When opening, DO NOT seed search with the selected label (prevents “lock-in”)
  useEffect(() => {
    if (!open) return;
    // If opened by pointer, show full list (clear search).
    if (openedByPointer.current) {
      setSearch('');
    }
    const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // Keep activeIndex aligned to selected when open & present in filtered
  useEffect(() => {
    if (!open) return;
    const idx = filtered.findIndex((o) => o.value === value);
    if (idx >= 0) setActiveIndex(idx);
  }, [value, filtered, open]);

  const moveActive = useCallback(
    (delta) => {
      if (!filtered.length) return;
      setActiveIndex((idx) => (idx + delta + filtered.length) % filtered.length);
    },
    [filtered.length]
  );

  // Choose with source: 'pointer' or 'keyboard'
  const chooseIndex = useCallback(
    (idx, source = 'keyboard') => {
      const opt = filtered[idx];
      if (!opt) return;
      onChange && onChange(opt.value);
      // Only clear the search if selection was by pointer (click/tap).
      if (source === 'pointer') setSearch('');
      setOpen(false);
    },
    [filtered, onChange]
  );

  return (
    <div className="surveyStart" ref={wrapperRef}>
      {!open && <h3 className="begin-title1">Select Your Department</h3>}

      <div className="section-picker">
        <div
          role="combobox"
          aria-haspopup="listbox"
          aria-owns={listboxId}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && filtered[activeIndex]
              ? `opt-${filtered[activeIndex].value}`
              : undefined
          }
          className={`section-combobox ${open ? 'is-open' : ''}`}
          onMouseDown={() => { openedByPointer.current = true; }}
          onTouchStart={() => { openedByPointer.current = true; }}
          onClick={() => { setOpen(true); }}
        >
          <input
            ref={inputRef}
            type="text"
            className="section-input"
            aria-label="Select your department"
            placeholder={current ? current.label : 'MassArt Dept...'}
            value={open ? search : (current && current.label) || ''}
            inputMode="search"
            autoCapitalize="none"
            onFocus={() => { setOpen(true); }}
            onChange={(e) => {
              // typing = keyboard-driven filtering
              openedByPointer.current = false;
              if (!open) setOpen(true);
              setSearch(e.target.value);
            }}
            onKeyDown={(e) => {
              openedByPointer.current = false;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!open) setOpen(true);
                moveActive(1);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!open) setOpen(true);
                moveActive(-1);
              } else if (e.key === 'Home') {
                e.preventDefault();
                setActiveIndex(0);
              } else if (e.key === 'End') {
                e.preventDefault();
                setActiveIndex(Math.max(0, filtered.length - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (open) {
                  // selection by keyboard: do NOT clear search here
                  chooseIndex(activeIndex, 'keyboard');
                } else {
                  setOpen(true);
                }
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
              }
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <span className="section-chevron" aria-hidden>▾</span>
        </div>

        {open && (
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            className={`section-listbox ${placement === 'up' ? 'drop-up' : 'drop-down'}`}
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
              else if (e.key === 'Home') { e.preventDefault(); setActiveIndex(0); }
              else if (e.key === 'End') { e.preventDefault(); setActiveIndex(Math.max(0, filtered.length - 1)); }
              else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseIndex(activeIndex, 'keyboard'); }
              else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); inputRef.current && inputRef.current.focus(); }
            }}
          >
            {filtered.length === 0 && (
              <div className="section-empty" role="option" aria-disabled="true">
                No matches
              </div>
            )}

            {filtered.map((opt, idx) => {
              const selected = value === opt.value;
              const active = idx === activeIndex;
              return (
                <div
                  id={`opt-${opt.value}`}
                  key={opt.value}
                  role="option"
                  aria-selected={selected}
                  className={
                    'section-option' +
                    (active ? ' is-active' : '') +
                    (selected ? ' is-selected' : '')
                  }
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => chooseIndex(idx, 'pointer')}  // ← clear filter only on pointer
                >
                  <span className={'section-dot' + (selected ? ' is-selected' : '')} />
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
