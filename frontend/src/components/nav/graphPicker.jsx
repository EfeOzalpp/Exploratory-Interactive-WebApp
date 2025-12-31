// graphPicker.jsx
import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { ROLE_SECTIONS } from "../survey/sectionPicker/sections";
import useSectionCounts from "../../utils/useSectionCounts";
import { useAppState } from "../../context/appStateContext.tsx";

const SPECIAL = [
  { id: "all",          label: "Everyone" },
  { id: "all-massart",  label: "MassArt " },
  { id: "all-students", label: "All Students" },
  { id: "all-staff",    label: "All Faculty/Staff" },
  { id: "visitor",      label: "Visitors" },
];

const CHOOSE_STUDENT = "__choose-student";
const CHOOSE_STAFF   = "__choose-staff";
const GO_BACK        = "__go-back";

// umbrella sections that sometimes exist outside ROLE_SECTIONS
const LEGACY_UMBRELLAS = [
  { id: "fine-arts",  label: "Fine Arts" },
  { id: "design",     label: "Design" },
  { id: "foundations",label: "Foundations" },
];

// show “(you)” on anything that is a real section; just exclude UI pseudo-ids & “all” buckets
const NON_PERSONAL_IDS = new Set([
  "all", "all-massart", "all-students", "all-staff",
  CHOOSE_STUDENT, CHOOSE_STAFF, GO_BACK,
  // NOTE: 'visitor' is intentionally NOT excluded, so visitors get (you)
]);

function titleFromId(id) {
  if (!id) return "";
  return id.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function GraphPicker({
  value = "all",
  onChange,
}) {
  const { counts } = useSectionCounts();
  const { mySection } = useAppState(); // ← user’s section from context (persisted in sessionStorage on submit)

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(null); // null | 'student' | 'staff'
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState("down");

  const wrapperRef = useRef(null);
  const buttonRef  = useRef(null);
  const listRef    = useRef(null);

  const yourIdsSet = useMemo(() => new Set(mySection ? [mySection] : []), [mySection]);

  // base lists
  const BASE_STUDENT = useMemo(() => {
    const base = ROLE_SECTIONS.student.map(s => ({ id: s.value, label: s.label }));
    // add legacy umbrellas if missing
    const have = new Set(base.map(x => x.id));
    LEGACY_UMBRELLAS.forEach(u => { if (!have.has(u.id)) base.push(u); });
    return base;
  }, []);

  const BASE_STAFF = useMemo(
    () => ROLE_SECTIONS.staff.map(s => ({ id: s.value, label: s.label })),
    []
  );

  // label lookup (also ensure unknown ids have a readable title)
  const ALL_LABELS = useMemo(() => {
    const list = [...SPECIAL, ...BASE_STUDENT, ...BASE_STAFF];
    const map = new Map(list.map(o => [o.id, o.label]));
    // ensure we can render labels for current value & mySection even if not in lists
    [value, mySection].forEach((id) => {
      if (id && !map.has(id)) map.set(id, titleFromId(id));
    });
    return map;
  }, [BASE_STUDENT, BASE_STAFF, value, mySection]);

  const sortByCountThenAlpha = useCallback((items) => {
    return [...items].sort((a, b) => {
      const cb = counts?.[b.id] ?? 0;
      const ca = counts?.[a.id] ?? 0;
      if (cb !== ca) return cb - ca;
      return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    });
  }, [counts]);

  const STUDENT_OPTS = useMemo(
    () => sortByCountThenAlpha(BASE_STUDENT),
    [BASE_STUDENT, sortByCountThenAlpha]
  );
  const STAFF_OPTS = useMemo(
    () => sortByCountThenAlpha(BASE_STAFF),
    [BASE_STAFF, sortByCountThenAlpha]
  );

  const MAIN_OPTS = useMemo(
    () => [
      ...SPECIAL,
      { id: CHOOSE_STUDENT, label: "Student Departments" },
      { id: CHOOSE_STAFF,   label: "Institutional Departments" },
    ],
    []
  );

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e) => {
      const el = wrapperRef.current;
      if (!el) return;
      if (!el.contains(e.target)) setOpen(false);
    };
    const onWindowBlur = () => setOpen(false);
    document.addEventListener("pointerdown", onDocPointerDown, true);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [open]);

  const VISIBLE_OPTS = useMemo(() => {
    if (mode === "student") return [{ id: GO_BACK, label: "‹ Back" }, ...STUDENT_OPTS];
    if (mode === "staff")   return [{ id: GO_BACK, label: "‹ Back" }, ...STAFF_OPTS];
    return MAIN_OPTS;
  }, [mode, MAIN_OPTS, STUDENT_OPTS, STAFF_OPTS]);

  // trigger text; append (you) when current selection is yours
  const triggerCoreLabel = useMemo(() => {
    if (open && mode === "student") return "Student Departments";
    if (open && mode === "staff")   return "Institutional Departments";
    const base = ALL_LABELS.get(value) || "Choose a section…";
    const isPersonal = yourIdsSet.has(value) && !NON_PERSONAL_IDS.has(value);
    return isPersonal ? `${base} (you)` : base;
  }, [open, mode, value, ALL_LABELS, yourIdsSet]);

  // broadcast open/close (for nav fade logic)
  const openRef = useRef(false);
  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("gp:menu-open", { detail: { open } }));
    if (!open) window.dispatchEvent(new CustomEvent("gp:menu-hover", { detail: { hover: false } }));
  }, [open]);

  // only send hover while open
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onEnter = () => openRef.current && window.dispatchEvent(new CustomEvent("gp:menu-hover", { detail: { hover: true } }));
    const onLeave = () => openRef.current && window.dispatchEvent(new CustomEvent("gp:menu-hover", { detail: { hover: false } }));
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
  }, []);

  // place list up/down based on viewport space
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
    setActiveIndex((idx) =>
      Math.min(Math.max(idx, 0), Math.max(0, VISIBLE_OPTS.length - 1))
    );
  }, [VISIBLE_OPTS.length]);

  // keep native scroll inside list; don't bubble to page/scene
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    const stopProp = (e) => { e.stopPropagation(); };
    el.addEventListener("wheel", stopProp, { passive: true });
    el.addEventListener("touchstart", stopProp, { passive: true });
    el.addEventListener("touchmove", stopProp, { passive: true });
    return () => {
      el.removeEventListener("wheel", stopProp, { passive: true });
      el.removeEventListener("touchstart", stopProp, { passive: true });
      el.removeEventListener("touchmove", stopProp, { passive: true });
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
        <span className="gp-trigger-label">🤝👥 Sorting {triggerCoreLabel}</span>
        <span className="gp-trigger-chevron" aria-hidden>
          <svg className="section-chevron-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
            <polyline points="6 9 12 15 18 9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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
            const showDot = !(isBack || isChooser);
            const n = counts?.[opt.id] ?? 0;

            const isPersonal = yourIdsSet.has(opt.id) && !NON_PERSONAL_IDS.has(opt.id);

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
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
                        <polyline points="15 18 9 12 15 6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="gp-label">{opt.label.replace("‹ ", "")}</span>
                  </>
                ) : isChooser ? (
                  <>
                    <span className="gp-label">{opt.label}</span>
                    <span className="gp-chooser-icon" aria-hidden>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
                        <polyline points="9 6 15 12 9 18" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </>
                ) : (
                  <>
                    {showDot && <span className={`gp-dot${value === opt.id ? " is-selected" : ""}`} />}
                    <span className="gp-label">
                      {ALL_LABELS.get(opt.id) ?? titleFromId(opt.id)}
                      {isPersonal && <span className="gp-you"> (you)</span>}
                    </span>
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
