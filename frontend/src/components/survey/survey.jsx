import React, { useState, Suspense, useEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useGraph } from '../../context/graphContext.tsx';
import '../../styles/survey.css';
import { ROLE_SECTIONS } from './sectionPicker/sections.js';

const RoleStep = React.lazy(() =>
  import(/* webpackChunkName:"survey-role" */ './rolePicker/roleStep')
);
const SectionPickerIntro = React.lazy(() =>
  import(/* webpackChunkName:"survey-section" */ './sectionPicker/sectionPicker.jsx')
);
const QuestionFlow = React.lazy(() =>
  import(/* webpackChunkName:"survey-questions" */ './questions/questionFlow')
);
const DoneOverlayR3F = React.lazy(() =>
  import(/* webpackChunkName:"survey-3d-overlay" */ './buttonLoader/DoneOverlayR3F.jsx')
);

// defer both savers; pick at runtime
const loadSaver = () =>
  import(/* webpackChunkName:"survey-save" */ '../../utils/saveUserResponse.ts');

export default function Survey({
  setAnimationVisible,
  setGraphVisible,
  setSurveyWrapperClass,
  onAnswersUpdate,
  onLiveAverageChange,
}) {
  const [stage, setStage] = useState('role'); // 'role' | 'section' | 'questions'
  const [audience, setAudience] = useState('');
  const [surveySection, setSurveySection] = useState('');
  const [error, setError] = useState('');
  const [showCompleteButton, setShowCompleteButton] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fadeState, setFadeState] = useState('fade-in');

  // Used to synchronously block a render during Exit (prevents the 1-frame ghost)
  const exitingRef = useRef(false);

  const {
    setSurveyActive, setHasCompletedSurvey, setSection, setMySection, setMyEntryId,
    observerMode, openGraph, section, resetToStart,
    tutorialMode, setTutorialMode,
    hasCompletedSurvey,
  } = useGraph();

  // ---------- Phone detection ----------
  const [isPhone, setIsPhone] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(max-width: 768px)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(max-width: 768px)');
    const handler = (ev) => setIsPhone(ev.matches);
    setIsPhone(mql.matches);
    if (mql.addEventListener) mql.addEventListener('change', handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler);
      else mql.removeListener(handler);
    };
  }, []);

  // ---------- Auto-start tutorial ONCE when entering questions on phone ----------
  useEffect(() => {
    if (stage !== 'questions') return;

    // URL override for QA: ?tutorial=1
    const force = (() => {
      try {
        if (typeof window === 'undefined') return false;
        const qp = new URLSearchParams(window.location.search);
        return qp.get('tutorial') === '1';
      } catch { return false; }
    })();

    // one-shot latch so we don't auto-open every time
    const alreadyBooted = typeof window !== 'undefined'
      ? sessionStorage.getItem('gp.tutorialBooted') === '1'
      : true;

    // only first-time, only on phone, only if not completed, unless forced
    if ((force || (!alreadyBooted && !hasCompletedSurvey)) && !tutorialMode) {
      setTutorialMode(true);
      try { sessionStorage.setItem('gp.tutorialBooted', '1'); } catch {}
    }
  }, [stage, isPhone, hasCompletedSurvey, tutorialMode, setTutorialMode]);

  // ---------- Resume tutorial if we refreshed while it was open ----------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const shouldResume = sessionStorage.getItem('gp.resumeTutorial') === '1';
    // Resume only when we (re)enter the questions stage
    if (shouldResume && stage === 'questions' && !tutorialMode) {
      setTutorialMode(true);
      try { sessionStorage.removeItem('gp.resumeTutorial'); } catch {}
    }
  }, [stage, tutorialMode, setTutorialMode]);

  // Save a flag on unload if tutorial is open (so we can resume after refresh)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onBeforeUnload = () => {
      try {
        if (tutorialMode) sessionStorage.setItem('gp.resumeTutorial', '1');
        else sessionStorage.removeItem('gp.resumeTutorial');
      } catch {}
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [tutorialMode]);

  // Build available sections
  const availableSections = useMemo(() => {
    if (!audience || audience === 'visitor') return [];
    if (audience === 'student') {
      return (ROLE_SECTIONS.student || []).map(s => ({ ...s, type: 'option' }));
    }
    if (audience === 'staff') {
      const stu = (ROLE_SECTIONS.student || []).map(s => ({ ...s, type: 'option' }));
      const fac = (ROLE_SECTIONS.staff   || []).map(s => ({ ...s, type: 'option' }));
      return [
        { type: 'header', id: 'staff',   label: 'Institutional departments' },
        ...fac,
        { type: 'header', id: 'student', label: 'Student departments' },
        ...stu,
      ];
    }
    return [];
  }, [audience]);

  useEffect(() => {
    if (observerMode) {
      setSurveyActive(false);
      if (!section) setSection('fine-arts');
      openGraph();
    }
  }, [observerMode, section, setSection, openGraph, setSurveyActive]);

  if (observerMode) return null;

  const transitionTo = (nextStage, sideEffects = () => {}) => {
    setFadeState('fade-out');
    setTimeout(() => {
      sideEffects?.();
      setStage(nextStage);
      setFadeState('fade-in');
    }, 70);
  };

  // Prefetch helpers
  const prefetchSection = () => import(/* webpackPrefetch: true, webpackChunkName:"survey-section" */ './sectionPicker/sectionPicker.jsx');
  const prefetchQuestions = () => import(/* webpackPrefetch: true, webpackChunkName:"survey-questions" */ './questions/questionFlow');

  const handleRoleNext = () => {
    if (!audience) { setError('Choose whether you are Student, Staff, or Visitor.'); return; }
    setError('');
    if (audience === 'visitor') {
      transitionTo('questions', () => {
        setSurveySection('visitor');
        setAnimationVisible(false);
      });
      prefetchQuestions();
      return;
    }
    transitionTo('section', () => { setSurveySection(''); });
    prefetchSection();
  };

  const handleBeginFromSection = () => {
    if (!surveySection) { setError('Select your section.'); return; }
    setError('');
    transitionTo('questions', () => { setAnimationVisible(false); });
    prefetchQuestions();
  };

  const handleSubmitFromQuestions = async (payload) => {
    if (submitting) return;
    setSubmitting(true); setError('');

    setSection(surveySection);
    setMySection(surveySection);
    setHasCompletedSurvey(true);
    setSurveyActive(false);

    setGraphVisible(true);
    setAnimationVisible(true);
    setSurveyWrapperClass('complete-active');
    setShowCompleteButton(true);

    try {
      const mod = await loadSaver();
      const saver =
        typeof mod.saveUserResponseWeights === 'function'
          ? mod.saveUserResponseWeights
          : (mod.saveUserResponse || (() => Promise.resolve(null)));

      const created = await saver(surveySection, { ...payload });
      const id = created?._id || null;
      setMyEntryId(id);
      if (typeof window !== 'undefined') {
        if (id) sessionStorage.setItem('gp.myEntryId', id);
        sessionStorage.setItem('gp.mySection', surveySection);
        if (audience) sessionStorage.setItem('gp.myRole', audience);
      }
    } catch (e) {
      console.error('[Survey] submit error:', e);
    } finally {
      setSubmitting(false);
    }
  };

  // No-flicker Exit
  const handleComplete = () => {
    exitingRef.current = true;
    flushSync(() => {
      setShowCompleteButton(false);
      setStage('role');
      setAudience('');
      setSurveySection('');
      setError('');
      setFadeState('fade-in');
      setAnimationVisible(false);
      setSurveyWrapperClass('');
    });
    resetToStart();
    Promise.resolve().then(() => { exitingRef.current = false; });
  };

  const handleAudienceChange = (role) => {
    setAudience(role); setError('');
    const allowed = role === 'staff'
      ? [...(ROLE_SECTIONS.student || []), ...(ROLE_SECTIONS.staff || [])].map(s => s.value)
      : (ROLE_SECTIONS[role] || []).map(s => s.value);
    setSurveySection(prev =>
      allowed.includes(prev) ? prev : role === 'visitor' ? 'visitor' : ''
    );
  };

  const handleSectionChange = (val) => { setSurveySection(val); setError(''); };

  if (exitingRef.current) {
    return (
      <div className="survey-section fade-in">
        <Suspense fallback={null}>
          <RoleStep value="" onChange={handleAudienceChange} onNext={handleRoleNext} error="" />
        </Suspense>
      </div>
    );
  }

  if (showCompleteButton) {
    return (
      <Suspense
        fallback={
          <div style={{ position: 'fixed', inset: 0, zIndex: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', pointerEvents: 'none' }}>
            <div className="survey-section-wrapper2">
              <div className="survey-section">
                <div className="surveyStart">
                  <button className="begin-button4" onClick={handleComplete}><span>Exit</span></button>
                </div>
              </div>
            </div>
          </div>
        }
      >
        <DoneOverlayR3F onComplete={handleComplete} />
      </Suspense>
    );
  }

  return (
    <div className={`survey-section ${fadeState}`}>
      <Suspense fallback={null}>
        {stage === 'role' && (
          <RoleStep
            value={audience}
            onChange={handleAudienceChange}
            onNext={handleRoleNext}
            error={error}
          />
        )}

        {stage === 'section' && (
          <SectionPickerIntro
            value={surveySection}
            onChange={handleSectionChange}
            onBegin={handleBeginFromSection}
            error={error}
            sections={availableSections}
            placeholderOverride={audience === 'student' ? 'Your Major...' : undefined}
            titleOverride={audience === 'student' ? 'Select Your Major' : undefined}
          />
        )}

        {stage === 'questions' && (
          <QuestionFlow
            onAnswersUpdate={onAnswersUpdate}
            onSubmit={handleSubmitFromQuestions}
            submitting={submitting}
            error={error}
            onLiveAverageChange={onLiveAverageChange} 
            // tutorial wiring only
            tutorialMode={tutorialMode}
            onEndTutorial={() => setTutorialMode(false)}
            
          />
        )}
      </Suspense>
    </div>
  );
}
