// src/components/survey/Survey.jsx
import React, { useState, Suspense, useEffect, useMemo } from 'react';
import { useGraph } from '../../context/graphContext.tsx';
// we'll dynamically import and prefer `saveUserResponseWeights` if it exists.
import { saveUserResponse } from '../../utils/saveUserResponse.ts';

import RoleStep from './rolePicker/roleStep';
import SectionPickerIntro from './sectionPicker/sectionPicker.jsx';
import QuestionFlow from './questions/questionFlow'; 
import '../../styles/survey.css';
import { ROLE_SECTIONS } from './sectionPicker/sections.js';

const DoneOverlayR3F = React.lazy(() =>
  import(/* webpackChunkName: "survey-3d-overlay" */ './buttonLoader/DoneOverlayR3F.jsx')
);

const Survey = ({
  setAnimationVisible,
  setGraphVisible,
  setSurveyWrapperClass,
  onAnswersUpdate,
}) => {
  const [stage, setStage] = useState('role'); // 'role' | 'section' | 'questions'
  const [audience, setAudience] = useState('');
  const [surveySection, setSurveySection] = useState('');
  const [error, setError] = useState('');
  const [showCompleteButton, setShowCompleteButton] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // fade (kept in sync with QuestionFlow)
  const [fadeState, setFadeState] = useState('fade-in');

  const {
    setSurveyActive,
    setHasCompletedSurvey,
    setSection,
    setMySection,
    setMyEntryId,
    observerMode,
    openGraph,
    section,
  } = useGraph();

  // Provide sections only for student/staff (visitor deliberately gets none)
  const availableSections = useMemo(
    () => (audience && audience !== 'visitor' ? (ROLE_SECTIONS[audience] || []) : []),
    [audience]
  );

  // Observer mode: skip survey entirely and open graph
  useEffect(() => {
    if (observerMode) {
      setSurveyActive(false);
      if (!section) setSection('fine-arts');
      openGraph();
    }
  }, [observerMode, section, setSection, openGraph, setSurveyActive]);

  if (observerMode) return null;

  // helper: fade-out → stage change → fade-in
  const transitionTo = (nextStage, sideEffects = () => {}) => {
    setFadeState('fade-out');
    setTimeout(() => {
      sideEffects?.();
      setStage(nextStage);
      setFadeState('fade-in');
    }, 70);
  };

  // Step 1: confirm role
  const handleRoleNext = () => {
    if (!audience) {
      setError('Choose whether you are Student, Staff, or Visitor.');
      return;
    }
    setError('');

    if (audience === 'visitor') {
      // Visitor: skip section step entirely
      transitionTo('questions', () => {
        setSurveySection('visitor'); // matches Sanity schema option
        setAnimationVisible(false);
      });
      return;
    }

    // Student/Staff: proceed to department/section picker
    transitionTo('section', () => {
      setSurveySection('');
    });
  };

  // Step 2: confirm section (for student/staff only)
  const handleBeginFromSection = () => {
    if (!surveySection) {
      setError('Select your section.');
      return;
    }
    setError('');
    transitionTo('questions', () => {
      setAnimationVisible(false);
    });
  };

  /**
   * Step 3: submit payload
   * Supports BOTH legacy answer letters and new numeric weight payloads.
   * - If ../../utils/saveUserResponse.ts exports saveUserResponseWeights, we use it.
   * - Otherwise we fall back to saveUserResponse (letters).
   */
  const handleSubmitFromQuestions = async (payload) => {
    if (submitting) return;
    setSubmitting(true);
    setError('');

    setSection(surveySection);
    setMySection(surveySection);
    setHasCompletedSurvey(true);
    setSurveyActive(false);

    setGraphVisible(true);
    setAnimationVisible(true);
    setSurveyWrapperClass('complete-active');
    setShowCompleteButton(true);

    try {
      // Prefer the weights-first saver if present (supports V3 schema).
      const mod = await import('../../utils/saveUserResponse.ts');
      const saver =
        typeof mod.saveUserResponseWeights === 'function'
          ? mod.saveUserResponseWeights
          : (typeof mod.saveUserResponse === 'function' ? mod.saveUserResponse : saveUserResponse);

      // Heuristic: if payload looks like weights (numbers), send as-is.
      // Else assume legacy answers map (letters).
      const looksLikeWeights =
        payload &&
        typeof payload === 'object' &&
        Object.values(payload).some((v) => typeof v === 'number');

      const created = await saver(surveySection, looksLikeWeights ? { ...payload } : { ...payload });

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

  // Done viewing overlay — resets state so user can take again
  const handleComplete = () => {
    setShowCompleteButton(false);
    setGraphVisible(false);

    // Fade the reset in, too (optional but nice)
    setFadeState('fade-out');
    setTimeout(() => {
      setStage('role');
      setAudience('');
      setSurveySection('');
      setAnimationVisible(false);
      setSurveyWrapperClass('');
      setSubmitting(false);
      setError('');
      setSurveyActive(true);
      setHasCompletedSurvey(false);
      setMyEntryId(null);
      setMySection(null);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('gp.myEntryId');
        sessionStorage.removeItem('gp.mySection');
      }
      setFadeState('fade-in');
    }, 70);
  };

  const handleAudienceChange = (role) => {
    setAudience(role);
    setError('');

    // If switching roles, clear invalid section selections
    const allowed = (ROLE_SECTIONS[role] || []).map((s) => s.value);
    setSurveySection((prev) =>
      allowed.includes(prev) ? prev : role === 'visitor' ? 'visitor' : ''
    );
  };

  const handleSectionChange = (val) => {
    setSurveySection(val);
    setError('');
  };

  // Overlay render
  if (showCompleteButton) {
    return (
      <Suspense
        fallback={
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              pointerEvents: 'none',
            }}
          >
            <div className="survey-section-wrapper2">
              <div className="survey-section">
                <div className="surveyStart">
                  <button className="begin-button4" onClick={handleComplete}>
                    <span>Done Viewing</span>
                  </button>
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

  // Stage: role
  if (stage === 'role') {
    return (
      <div className={`survey-section ${fadeState}`}>
        <RoleStep
          value={audience}
          onChange={handleAudienceChange}
          onNext={handleRoleNext}
          error={error}
        />
      </div>
    );
  }

  // Stage: section (student/staff only)
  if (stage === 'section') {
    return (
      <div className={`survey-section ${fadeState}`}>
        <SectionPickerIntro
          value={surveySection}
          onChange={handleSectionChange}
          onBegin={handleBeginFromSection}
          error={error}
          sections={availableSections}
        />
      </div>
    );
  }

  // Stage: questions
  return (
    <div className={`survey-section ${fadeState}`}>
      <QuestionFlow
        onAnswersUpdate={onAnswersUpdate}         // works for both letters or numeric weights
        onSubmit={handleSubmitFromQuestions}      // accepts either shape
        submitting={submitting}
        error={error}
      />
    </div>
  );
};

export default Survey;
