// graphPicker.jsx
import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { ROLE_SECTIONS } from "../components/survey/sections";
import useSectionCounts from "../utils/useSectionCounts";

// Quick views + special buckets (with counts)
const SPECIAL = [
  { id: "all",           label: "All (Everything)" },       // visitor + staff + student
  { id: "all-massart",   label: "All MassArt" },            // staff + student only
  { id: "all-students",  label: "All Students" },           // student sections
  { id: "all-staff",     label: "All Faculty/Staff" },      // staff sections
  { id: "visitor",       label: "Visitor" },                // visitor bucket
];

// Sentinel values (not real section ids)
const CHOOSE_STUDENT = "__choose-student";
const CHOOSE_STAFF   = "__choose-staff";
const GO_BACK        = "__go-back";

export default function GraphPicker({ value = "all", onChange }) {
  const { counts } = useSectionCounts(); // { id: number, ... }

  // dropdown UI state
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(null);           // null | 'student' | 'staff'
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState("down");

  const wrapperRef = useRef(null);
  const buttonRef  = useRef(null);
  const listRef    = useRef(null);

  // Flatten student/staff options with counts
  const STUDENT_OPTS = useMemo(
    () => ROLE_SECTIONS.student.map(s => ({ id: s.value, label: s.label })),
    []
  );
  const STAFF_OPTS = useMemo(
    () => ROLE_SECTIONS.staff.map(s => ({ id: s.value, label: s.label })),
    []
  );

  // Top-level menu
  const MAIN_OPTS = useMemo(
    () => [
      ...SPECIAL,
      { id: CHOOSE_STUDENT, label: "Select Department…" },
      { id: CHOOSE_STAFF,   label: "Select Faculty…"   },
    ],
    []
  );

  // Which list are we showing inside the popover
  const VISIBLE_OPTS = useMemo(() => {
    if (mode === "student") return [{ id: GO_BACK, label: "‹ Back" }, ...STUDENT_OPTS];
    if (mode === "staff")   return [{ id: GO_BACK, label: "‹ Back" }, ...STAFF_OPTS];
    return MAIN_OPTS;
  }, [mode, MAIN_OPTS, STUDENT_OPTS, STAFF_OPTS]);

  // Label in the trigger
  const triggerLabel = useMemo(() => {
    if (mode === "student") return "Select Department…";
    if (mode === "staff")   return "Select Faculty…";
    const found = MAIN_OPTS.find(o => o.id === value);
    return found ? found.label : "Choose a section…";
  }, [mode, value, MAIN_OPTS]);

  // Close on outside click
  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, []);

  // Compute up/down placement
  useEffect(() => {
    const computePlacement = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportH = window.innerHeight || document.documentElement.clientHeight;
      const spaceBelow = viewportH - rect.bottom;
      const estimatedListHeight = Math.min(300, VISIBLE_OPTS.length * 44 + 12);
      setPlacement(spaceBelow >= estimatedListHeight ? "down" : "up");
    };
    if (open) computePlacement();
    const onWin = () => open && computePlacement();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, VISIBLE_OPTS.length]);

  // Keep activeIndex within bounds if list size changes
  useEffect(() => {
    setActiveIndex((idx) => Math.min(Math.max(idx, 0), Math.max(0, VISIBLE_OPTS.length - 1)));
  }, [VISIBLE_OPTS.length]);

  const moveActive = useCallback(
    (delta) => setActiveIndex((idx) => (idx + delta + VISIBLE_OPTS.length) % VISIBLE_OPTS.length),
    [VISIBLE_OPTS.length]
  );

  const chooseIndex = useCallback((idx) => {
    const opt = VISIBLE_OPTS[idx];
    if (!opt) return;

    // Submenu handling
    if (opt.id === CHOOSE_STUDENT) { setMode("student"); return; }
    if (opt.id === CHOOSE_STAFF)   { setMode("staff");   return; }
    if (opt.id === GO_BACK)        { setMode(null);      return; }

    // Concrete selection (includes quick views + real sections)
    setMode(null);
    setOpen(false);
    onChange?.(opt.id);
    buttonRef.current?.focus();
  }, [VISIBLE_OPTS, onChange]);

  const onTriggerKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (!open) setOpen(true); moveActive(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (!open) setOpen(true); moveActive(-1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!open) setOpen(true); else chooseIndex(activeIndex); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  const onListKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
    else if (e.key === "Home") { e.preventDefault(); setActiveIndex(0); }
    else if (e.key === "End") { e.preventDefault(); setActiveIndex(VISIBLE_OPTS.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); chooseIndex(activeIndex); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); buttonRef.current?.focus(); }
  };

  const listboxId = "gp-listbox";

  return (
    <div ref={wrapperRef} className="gp-picker">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className="gp-trigger"
        onClick={() => setOpen(v => !v)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="gp-trigger-label">{triggerLabel}</span>
        <span className="gp-trigger-chevron" aria-hidden>▾</span>
      </button>

      {open && (
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-activedescendant={VISIBLE_OPTS[activeIndex] ? `gp-opt-${VISIBLE_OPTS[activeIndex].id}` : undefined}
          className={`gp-listbox ${placement === "down" ? "drop-down" : "drop-up"}`}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
        >
          {VISIBLE_OPTS.map((opt, idx) => {
            const active = idx === activeIndex;
            // Show counts for quick views + actual sections (not for Back)
            const showCount = opt.id !== GO_BACK;
            const n = counts?.[opt.id] ?? 0;

            return (
              <div
                id={`gp-opt-${opt.id}`}
                key={opt.id}
                role="option"
                aria-selected={value === opt.id}
                className={`gp-option${active ? " is-active" : ""}${value === opt.id ? " is-selected" : ""}`}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => chooseIndex(idx)}
              >
                <span className={`gp-dot${value === opt.id ? " is-selected" : ""}`} />
                <span className="gp-label">{opt.label}</span>
                {showCount && <span className="gp-count">({n})</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
