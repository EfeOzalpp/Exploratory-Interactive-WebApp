// graphPicker.jsx
import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { ROLE_SECTIONS } from "../components/survey/sections";
import useSectionCounts from "../utils/useSectionCounts";

const SPECIAL = [
  { id: "all",           label: "Everyone" },
  { id: "all-massart",   label: "MassArt " },
  { id: "all-students",  label: "All Students" },
  { id: "all-staff",     label: "All Faculty/Staff" },
  { id: "visitor",       label: "Visitors" },
];

const CHOOSE_STUDENT = "__choose-student";
const CHOOSE_STAFF   = "__choose-staff";
const GO_BACK        = "__go-back";

export default function GraphPicker({ value = "all", onChange }) {
  const { counts } = useSectionCounts();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(null); // null | 'student' | 'staff'
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState("down");

  const wrapperRef = useRef(null);
  const buttonRef  = useRef(null);
  const listRef    = useRef(null);

  const BASE_STUDENT = useMemo(
    () => ROLE_SECTIONS.student.map(s => ({ id: s.value, label: s.label })),
    []
  );
  const BASE_STAFF = useMemo(
    () => ROLE_SECTIONS.staff.map(s => ({ id: s.value, label: s.label })),
    []
  );

  const sortByCountThenAlpha = useCallback((items) => {
    return [...items].sort((a, b) => {
      const cb = counts?.[b.id] ?? 0;
      const ca = counts?.[a.id] ?? 0;
      if (cb !== ca) return cb - ca;
      return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    });
  }, [counts]);

  const STUDENT_OPTS = useMemo(() => sortByCountThenAlpha(BASE_STUDENT), [BASE_STUDENT, sortByCountThenAlpha]);
  const STAFF_OPTS   = useMemo(() => sortByCountThenAlpha(BASE_STAFF),   [BASE_STAFF,   sortByCountThenAlpha]);

  const MAIN_OPTS = useMemo(
    () => [
      ...SPECIAL,
      { id: CHOOSE_STUDENT, label: "Select Student Department" },
      { id: CHOOSE_STAFF,   label: "Select Faculty Department" },
    ],
    []
  );
  
  // Close on click/tap outside (only while open)
  useEffect(() => {
    if (!open) return;

    const onDocPointerDown = (e) => {
      const el = wrapperRef.current;
      if (!el) return;
      // If the click is fully outside the picker, close it
      if (!el.contains(e.target)) {
        setOpen(false);
      }
    };

    const onWindowBlur = () => setOpen(false);

    // capture:true ensures we see it before inner handlers
    document.addEventListener("pointerdown", onDocPointerDown, true);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, []);

  const VISIBLE_OPTS = useMemo(() => {
    if (mode === "student") return [{ id: GO_BACK, label: "‹ Back" }, ...STUDENT_OPTS];
    if (mode === "staff")   return [{ id: GO_BACK, label: "‹ Back" }, ...STAFF_OPTS];
    return MAIN_OPTS;
  }, [mode, MAIN_OPTS, STUDENT_OPTS, STAFF_OPTS]);

  // *** Updated trigger label logic ***
  const triggerCoreLabel = useMemo(() => {
    if (mode === "student") return "Student Departments";
    if (mode === "staff")   return "Faculty Departments";
    const found = MAIN_OPTS.find(o => o.id === value);
    return found ? found.label : "Choose a section…";
  }, [mode, value, MAIN_OPTS]);

  const openRef = useRef(false);
  useEffect(() => { openRef.current = open; }, [open]);

    // tell the app that the picker popover is open/closed
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("gp:menu-open", { detail: { open } }));
    // if we just closed, also ensure hover=false gets sent once
    if (!open) window.dispatchEvent(new CustomEvent("gp:menu-hover", { detail: { hover: false } }));
  }, [open]);

  // Only broadcast hover while the popover is OPEN
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const onEnter = () => {
      if (!openRef.current) return;
      window.dispatchEvent(new CustomEvent("gp:menu-hover", { detail: { hover: true } }));
    };
    const onLeave = () => {
      if (!openRef.current) return;
      window.dispatchEvent(new CustomEvent("gp:menu-hover", { detail: { hover: false } }));
    };

    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);

    return () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []); // listeners set once; openRef gates dispatch

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

  useEffect(() => {
    setActiveIndex((idx) => Math.min(Math.max(idx, 0), Math.max(0, VISIBLE_OPTS.length - 1)));
  }, [VISIBLE_OPTS.length]);

// Replace your current wheel/touch effect with this:
useEffect(() => {
  if (!open) return;
  const el = listRef.current;
  if (!el) return;

  // Let the element do its native scrolling, just don't bubble to the scene/page
  const stopPropWheel = (e) => {
    e.stopPropagation(); // ok in passive listeners
    // no preventDefault() -> native scroll works
  };

  const stopPropTouch = (e) => {
    // allow natural touch scrolling inside the list
    e.stopPropagation(); // don't bubble to outer listeners
  };

  // Passive = true is fine since we’re not calling preventDefault
  el.addEventListener("wheel", stopPropWheel, { passive: true });
  el.addEventListener("touchstart", stopPropTouch, { passive: true });
  el.addEventListener("touchmove", stopPropTouch, { passive: true });

  return () => {
    el.removeEventListener("wheel", stopPropWheel, { passive: true });
    el.removeEventListener("touchstart", stopPropTouch, { passive: true });
    el.removeEventListener("touchmove", stopPropTouch, { passive: true });
  };
}, [open]);

  const moveActive = useCallback(
    (delta) => setActiveIndex((idx) => (idx + delta + VISIBLE_OPTS.length) % VISIBLE_OPTS.length),
    [VISIBLE_OPTS.length]
  );

  const chooseIndex = useCallback((idx) => {
    const opt = VISIBLE_OPTS[idx];
    if (!opt) return;

    if (opt.id === CHOOSE_STUDENT) { setMode("student"); return; }
    if (opt.id === CHOOSE_STAFF)   { setMode("staff");   return; }
    if (opt.id === GO_BACK)        { setMode(null);      return; }

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
        <span className="gp-trigger-label">Sorting {triggerCoreLabel}</span>
        <span className="gp-trigger-chevron" aria-hidden>
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
            const isBack = opt.id === GO_BACK;
            const isChooser = opt.id === CHOOSE_STUDENT || opt.id === CHOOSE_STAFF;
            const showCount = !(isBack || isChooser);
            const showDot = !isBack;
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
              {isBack ? (
                  <>
                    <span className="gp-back-icon" aria-hidden>
                      <svg
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                      >
                        <polyline
                          points="15 18 9 12 15 6"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="gp-label">{opt.label.replace("‹ ", "")}</span>
                  </>
                ) : (
                  <>
                    {showDot && <span className={`gp-dot${value === opt.id ? " is-selected" : ""}`} />}
                    <span className="gp-label">{opt.label}</span>
                    {showCount && <span className="gp-count">({n})</span>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
