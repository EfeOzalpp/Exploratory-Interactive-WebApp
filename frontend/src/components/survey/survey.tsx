// src/components/survey/survey.tsx
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useGraph } from '../../context/graphContext.tsx';
import '../../styles/survey.css';
import { ROLE_SECTIONS } from './sectionPicker/sections';
import QuestionFlow from './questions/questionFlow.tsx';
import { WEIGHTED_QUESTIONS } from './questions/questions.ts';
import { saveUserResponse } from '../../utils/saveUserResponse.ts';

type Audience = 'student' | 'staff' | 'visitor' | '';

const RoleStep = React.lazy(() => import('./rolePicker/roleStep'));
const SectionPickerIntro = React.lazy(() => import('./sectionPicker/sectionPicker'));
const DoneOverlayR3F = React.lazy(() => import('./buttonLoader/DoneOverlayR3F.jsx'));

export default function Survey({
  setAnimationVisible,
  setGraphVisible,
  setSurveyWrapperClass,
  onAnswersUpdate,
  onLiveAverageChange,
}: {
  setAnimationVisible: (v: boolean) => void;
  setGraphVisible: (v: boolean) => void;
  setSurveyWrapperClass: (cls: string) => void;
  onAnswersUpdate?: (answers: Record<string, number | null>) => void;
  onLiveAverageChange?: (avg: number | undefined, meta?: { dragging?: boolean; committed?: boolean }) => void;
}) {
  const [stage, setStage] = useState<'role' | 'section' | 'questions'>('role');
  const [audience, setAudience] = useState<Audience>('');
  const [surveySection, setSurveySection] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fadeState, setFadeState] = useState<'fade-in' | 'fade-out'>('fade-in');

  // latches
  const [finished, setFinished] = useState(false);         // hide QuestionFlow right after submit
  const [showCompleteButton, setShowCompleteButton] = useState(false); // show Exit overlay

  const exitingRef = useRef(false);

  const {
    setSurveyActive, setHasCompletedSurvey, setSection, setMySection, setMyEntryId,
    observerMode, openGraph, section, resetToStart, setNavVisible, hasCompletedSurvey,
    setQuestionnaireOpen,
  } = useGraph();

  // Keep questionnaireOpen in sync with our stage (and finished latch)
  useEffect(() => {
    setQuestionnaireOpen(stage === 'questions' && !observerMode && !finished);
    return () => { setQuestionnaireOpen(false); };
  }, [stage, observerMode, finished, setQuestionnaireOpen]);

  // Phone detection
  const [isPhone, setIsPhone] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(max-width: 768px)').matches
      : false
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(max-width: 768px)');
    const handler = (ev: MediaQueryListEvent | MediaQueryList) =>
      setIsPhone((ev as MediaQueryList).matches ?? (ev as MediaQueryListEvent).matches);
    mql.addEventListener ? mql.addEventListener('change', handler) : mql.addListener(handler);
    return () => {
      mql.removeEventListener ? mql.removeEventListener('change', handler) : mql.removeListener(handler);
    };
  }, []);

  useEffect(() => {
    const shouldHideNav = isPhone && stage === 'questions' && !hasCompletedSurvey && !finished;
    setNavVisible(!shouldHideNav);
  }, [isPhone, stage, hasCompletedSurvey, finished, setNavVisible]);

  useEffect(() => {
    if (observerMode) {
      setSurveyActive(false);
      if (!section) setSection('fine-arts');
      openGraph();
    }
  }, [observerMode, section, setSection, openGraph, setSurveyActive]);

  const transitionTo = (next: typeof stage, side?: () => void) => {
    setFadeState('fade-out');
    setTimeout(() => {
      side?.();
      setStage(next);
      setFadeState('fade-in');
    }, 70);
  };

  const availableSections = useMemo(() => {
    if (!audience || audience === 'visitor') return [];
    if (audience === 'student') {
      return (ROLE_SECTIONS.student || []).map((s: any) => ({ ...s, type: 'option' }));
    }
    if (audience === 'staff') {
      const stu = (ROLE_SECTIONS.student || []).map((s: any) => ({ ...s, type: 'option' }));
      const fac = (ROLE_SECTIONS.staff || []).map((s: any) => ({ ...s, type: 'option' }));
      return [
        { type: 'header', id: 'staff', label: 'Institutional departments' },
        ...fac,
        { type: 'header', id: 'student', label: 'Student departments' },
        ...stu,
      ];
    }
    return [];
  }, [audience]);

  const handleRoleNext = () => {
    if (!audience) { setError('Choose whether you are Student, Staff, or Visitor.'); return; }
    setError('');
    if (audience === 'visitor') {
      transitionTo('questions', () => {
        setSurveySection('visitor');
        setAnimationVisible(false);
      });
      return;
    }
    transitionTo('section', () => setSurveySection(''));
  };

  const handleBeginFromSection = () => {
    if (!surveySection) { setError('Select your section.'); return; }
    setError('');
    transitionTo('questions', () => setAnimationVisible(false));
  };

  // Map answers{id->value} into q1..q5 by original question order
  function answersToWeights(answers: Record<string, number | null>) {
    const getVal = (i: number) => {
      const id = WEIGHTED_QUESTIONS[i]?.id;
      const v = id ? answers[id] : undefined;
      return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
    };
    return {
      q1: getVal(0),
      q2: getVal(1),
      q3: getVal(2),
      q4: getVal(3),
      q5: getVal(4),
    };
  }

  const handleSubmitFromQuestions = async (answers: Record<string, number | null>) => {
    if (submitting) return;
    setSubmitting(true);
    setError('');

    // Hide questions immediately and drop the open flag
    setFinished(true);
    setQuestionnaireOpen(false);

    // Flip the “completed” flags & reveal graph/overlay animation
    setSection(surveySection);
    setMySection(surveySection);
    setHasCompletedSurvey(true);
    setSurveyActive(false);

    setGraphVisible(true);
    setAnimationVisible(true);
    setSurveyWrapperClass('complete-active');

    try {
      const weights = answersToWeights(answers);
      const created = await saveUserResponse(surveySection, weights);
      const id = created?._id || null;
      setMyEntryId(id);
      if (typeof window !== 'undefined') {
        if (id) sessionStorage.setItem('gp.myEntryId', id);
        sessionStorage.setItem('gp.mySection', surveySection);
        if (audience) sessionStorage.setItem('gp.myRole', audience);
      }

      // show the Exit overlay; DO NOT auto-reset here
      setShowCompleteButton(true);
    } catch (err) {
      console.error('[Survey] submit error:', err);
      // If saving failed, allow returning to questions
      setFinished(false);
      setQuestionnaireOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  // Exit button: actually reset everything and close the graph
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
      setFinished(false);
    });
    resetToStart();         // sets hasCompletedSurvey=false, closes viz, clears identity
    setNavVisible(true);
    Promise.resolve().then(() => { exitingRef.current = false; });
  };

  const handleAudienceChange = (role: Audience) => {
    setAudience(role); setError('');
    const allowed = role === 'staff'
      ? [...(ROLE_SECTIONS.student || []), ...(ROLE_SECTIONS.staff || [])].map((s: any) => s.value)
      : (ROLE_SECTIONS[role] || []).map((s: any) => s.value);
    setSurveySection(prev =>
      allowed.includes(prev) ? prev : role === 'visitor' ? 'visitor' : ''
    );
  };

  const handleSectionChange = (val: string) => { setSurveySection(val); setError(''); };

  // Render
  if (exitingRef.current) {
    return (
      <div className="survey-section fade-in">
        <Suspense fallback={null}>
          <RoleStep value="" onChange={handleAudienceChange} onNext={handleRoleNext} error="" />
        </Suspense>
      </div>
    );
  }

  // ⬇️ After submit, show Exit overlay (graph remains visible behind it)
  if (showCompleteButton) {
    return (
      <Suspense fallback={null}>
        <DoneOverlayR3F onComplete={handleComplete} />
      </Suspense>
    );
  }

  return (
    <div className={`survey-section ${fadeState}`}>
      {!observerMode && (
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

          {stage === 'questions' && !finished && (
            <QuestionFlow
              questions={WEIGHTED_QUESTIONS}
              onAnswersUpdate={onAnswersUpdate}
              onSubmit={handleSubmitFromQuestions}
              submitting={submitting}
              onLiveAverageChange={onLiveAverageChange}
            />
          )}
        </Suspense>
      )}
    </div>
  );
}
