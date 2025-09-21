// src/components/survey/Survey.jsx
import React, { useState, Suspense, useEffect, useMemo } from 'react';
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
}) {
  const [stage, setStage] = useState('role'); // 'role' | 'section' | 'questions'
  const [audience, setAudience] = useState('');
  const [surveySection, setSurveySection] = useState('');
  const [error, setError] = useState('');
  const [showCompleteButton, setShowCompleteButton] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fadeState, setFadeState] = useState('fade-in');

  const {
    setSurveyActive, setHasCompletedSurvey, setSection, setMySection, setMyEntryId,
    observerMode, openGraph, section,
  } = useGraph();

  const availableSections = useMemo(
    () => (audience && audience !== 'visitor' ? (ROLE_SECTIONS[audience] || []) : []),
    [audience]
  );

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

  // Prefetch helpers (hint the *next* step)
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
      // prefetch questions chunk for smooth entry
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

      const looksLikeWeights =
        payload && typeof payload === 'object' && Object.values(payload).some((v) => typeof v === 'number');

      const created = await saver(surveySection, { ...payload });
      const id = created?._id || null;
      setMyEntryId(id);
      if (id && typeof window !== 'undefined') {
        sessionStorage.setItem('gp.myEntryId', id);
        sessionStorage.setItem('gp.mySection', surveySection);
      }
    } catch (e) {
      console.error('[Survey] submit error:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = () => {
    setShowCompleteButton(false);
    setGraphVisible(false);
    setFadeState('fade-out');
    setTimeout(() => {
      setStage('role'); setAudience(''); setSurveySection('');
      setAnimationVisible(false); setSurveyWrapperClass(''); setSubmitting(false); setError('');
      setSurveyActive(true); setHasCompletedSurvey(false); setMyEntryId(null); setMySection(null);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('gp.myEntryId');
        sessionStorage.removeItem('gp.mySection');
      }
      setFadeState('fade-in');
    }, 70);
  };

  const handleAudienceChange = (role) => {
    setAudience(role); setError('');
    const allowed = (ROLE_SECTIONS[role] || []).map((s) => s.value);
    setSurveySection((prev) => (allowed.includes(prev) ? prev : role === 'visitor' ? 'visitor' : ''));
  };

  const handleSectionChange = (val) => { setSurveySection(val); setError(''); };

  if (showCompleteButton) {
    return (
      <Suspense fallback={
        <div style={{ position: 'fixed', inset: 0, zIndex: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', pointerEvents: 'none' }}>
          <div className="survey-section-wrapper2">
            <div className="survey-section">
              <div className="surveyStart">
                <button className="begin-button4" onClick={handleComplete}><span>Exit</span></button>
              </div>
            </div>
          </div>
        </div>
      }>
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
          />
        )}
        {stage === 'questions' && (
          <QuestionFlow
            onAnswersUpdate={onAnswersUpdate}
            onSubmit={handleSubmitFromQuestions}
            submitting={submitting}
            error={error}
          />
        )}
      </Suspense>
    </div>
  );
}
