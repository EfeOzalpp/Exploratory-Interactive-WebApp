import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';

export default function SectionPickerIntro({
  value,
  onChange,
  onBegin,
  error,
  sections = [],
  // NEW:
  placeholderOverride,        // e.g., "Your Major..."
  titleOverride,              // e.g., "Select Your Major"
}) {
  const hasHeaders = useMemo(
    () => Array.isArray(sections) && sections.some(s => s && s.type === 'header'),
    [sections]
  );

  const optionsWithHeaders = useMemo(() => {
    if (!Array.isArray(sections)) return [];
    return sections.map(s => (s?.type === 'header' ? { ...s } : { ...s, type: 'option' }));
  }, [sections]);

  const baseFocusable = useMemo(() => {
    const out = [];
    optionsWithHeaders.forEach((item, idx) => {
      if (item?.type !== 'header') out.push({ ...item, __listIndex: idx });
    });
    return out;
  }, [optionsWithHeaders]);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState('down');

  const wrapperRef = useRef(null);
  const inputRef   = useRef(null);
  const listRef    = useRef(null);
  const listboxId  = 'section-listbox';
  const openedByPointer = useRef(false);

  const current = useMemo(
    () => baseFocusable.find(o => o.value === value) || null,
    [baseFocusable, value]
  );

  const filteredFocusable = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return baseFocusable;
    return baseFocusable.filter((o) => {
      const labelMatch = (o.label || '').toLowerCase().includes(q);
      const valueMatch = (o.value || '').toLowerCase().includes(q);
      const aliasMatch = (o.aliases || []).some(a => (a || '').toLowerCase().includes(q));
      return labelMatch || valueMatch || aliasMatch;
    });
  }, [baseFocusable, search]);

  const displayedList = useMemo(() => {
    if (!hasHeaders) return filteredFocusable;

    const filteredSet = new Set(filteredFocusable.map(o => o.__listIndex));
    const out = [];
    let i = 0;
    while (i < optionsWithHeaders.length) {
      const item = optionsWithHeaders[i];
      if (item.type === 'header') {
        let j = i + 1, any = false;
        while (j < optionsWithHeaders.length && optionsWithHeaders[j].type !== 'header') {
          if (filteredSet.has(j)) { any = true; break; }
          j++;
        }
        if (any) {
          out.push(item);
          let k = i + 1;
          while (k < optionsWithHeaders.length && optionsWithHeaders[k].type !== 'header') {
            if (filteredSet.has(k)) out.push(optionsWithHeaders[k]);
            k++;
          }
          i = k;
          continue;
        } else {
          let k = i + 1;
          while (k < optionsWithHeaders.length && optionsWithHeaders[k].type !== 'header') k++;
          i = k;
          continue;
        }
      } else {
        if (filteredSet.has(i)) out.push(item);
        i++;
      }
    }
    return out;
  }, [hasHeaders, filteredFocusable, optionsWithHeaders]);

  const renderedFocusable = useMemo(() => {
    const out = [];
    displayedList.forEach((item, idx) => {
      if (item.type !== 'header') out.push({ ...item, __renderIndex: idx });
    });
    return out;
  }, [displayedList]);

  useEffect(() => {
    setActiveIndex((idx) =>
      renderedFocusable.length ? Math.min(Math.max(idx, 0), renderedFocusable.length - 1) : 0
    );
  }, [renderedFocusable.length]);

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
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      const viewportH = window.innerHeight || document.documentElement.clientHeight;
      const spaceBelow = viewportH - rect.bottom;
      const estimatedRowHeight = 44;
      const estimatedHeaders = displayedList.filter(x => x.type === 'header').length;
      const estimatedListHeight = Math.min(
        260,
        (displayedList.length * estimatedRowHeight) + (estimatedHeaders * 8) + 12
      );
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
  }, [open, displayedList]);

  useEffect(() => {
    if (!open) return;
    if (openedByPointer.current) setSearch('');
    const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const idx = renderedFocusable.findIndex(o => o.value === value);
    if (idx >= 0) setActiveIndex(idx);
  }, [value, renderedFocusable, open]);

  const moveActive = useCallback(
    (delta) => {
      if (!renderedFocusable.length) return;
      setActiveIndex((idx) => (idx + delta + renderedFocusable.length) % renderedFocusable.length);
    },
    [renderedFocusable.length]
  );

  const chooseIndex = useCallback(
    (focusIdx, source = 'keyboard') => {
      const opt = renderedFocusable[focusIdx];
      if (!opt) return;
      onChange && onChange(opt.value);
      if (source === 'pointer') setSearch('');
      setOpen(false);
    },
    [renderedFocusable, onChange]
  );

  const activeRenderedId = open && renderedFocusable[activeIndex]
    ? `opt-${renderedFocusable[activeIndex].value}`
    : undefined;

  // IMPORTANT: placeholder shows only when the input value is empty.
  // We keep the displayed value behavior untouched. We just let you override the placeholder text.
  const placeholderText = placeholderOverride ?? (current ? current.label : 'MassArt Dept...');

  return (
    <div className="surveyStart" ref={wrapperRef}>
      {!open && <h3 className="begin-title3">{titleOverride ?? 'Select Your Department'}</h3>}

      <div className="section-picker">
        <div
          role="combobox"
          aria-haspopup="listbox"
          aria-owns={listboxId}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeRenderedId}
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
            placeholder={placeholderText}
            value={open ? search : (current && current.label) || ''}
            inputMode="search"
            autoCapitalize="none"
            onFocus={() => { setOpen(true); }}
            onChange={(e) => {
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
                setActiveIndex(Math.max(0, renderedFocusable.length - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (open) {
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
          <span className="section-chevron" aria-hidden>
            <svg
              className="section-chevron-svg"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
            >
              <polyline
                points="6 9 12 15 18 9"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
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
              else if (e.key === 'Home')   { e.preventDefault(); setActiveIndex(0); }
              else if (e.key === 'End')    { e.preventDefault(); setActiveIndex(Math.max(0, renderedFocusable.length - 1)); }
              else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseIndex(activeIndex, 'keyboard'); }
              else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); inputRef.current && inputRef.current.focus(); }
            }}
          >
            {displayedList.length === 0 && (
              <div className="section-empty" role="option" aria-disabled="true">
                No matches
              </div>
            )}

            {displayedList.map((item, idx) => {
              if (item.type === 'header') {
                return (
                  <p
                    key={`hdr-${item.id || idx}`}
                    className="section-group-header"
                    role="presentation"
                    aria-hidden="true"
                  >
                    {item.label}
                  </p>
                );
              }
              const selected = value === item.value;
              const isActive = renderedFocusable[activeIndex]?.__renderIndex === idx;
              return (
                <div
                  id={`opt-${item.value}`}
                  key={item.value}
                  role="option"
                  aria-selected={selected}
                  className={
                    'section-option' +
                    (isActive ? ' is-active' : '') +
                    (selected ? ' is-selected' : '')
                  }
                  onMouseEnter={() => {
                    const focusIdx = renderedFocusable.findIndex(f => f.__renderIndex === idx);
                    if (focusIdx >= 0) setActiveIndex(focusIdx);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const focusIdx = renderedFocusable.findIndex(f => f.__renderIndex === idx);
                    if (focusIdx >= 0) chooseIndex(focusIdx, 'pointer');
                  }}
                >
                  <span className={'section-dot' + (selected ? ' is-selected' : '')} />
                  <span className="section-label">{item.label}</span>
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
        <span>Next</span>
      </button>
    </div>
  );
}
