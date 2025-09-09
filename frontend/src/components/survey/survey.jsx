import React, { useState, Suspense, useEffect } from 'react';
import { useGraph } from '../../context/graphContext.tsx';
import { saveUserResponse } from '../../utils/saveUserResponse.ts';
import RoleStep from './roleStep';
import SectionPickerIntro from './sectionPicker';
import QuestionFlow from './questionFlow';
import '../../styles/survey.css';

// lazy: loads THREE/R3F/drei only at survey end
const DoneOverlayR3F = React.lazy(() =>
  import(/* webpackChunkName: "survey-3d-overlay" */ './DoneOverlayR3F')
);

const ROLE_SECTIONS = {
  student: [
    { value: 'fine-arts',     label: 'Fine Arts' },
    { value: 'digital-media', label: 'Digital / Time-Based' },
  ],
  staff: [
    { value: 'design',      label: 'Design & Applied' },
    { value: 'foundations', label: 'Foundations & X-Discipline' },
  ],
};

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

  const availableSections = audience ? (ROLE_SECTIONS[audience] || []) : [];

  // Observe the results without taking survey
  useEffect(() => {
    if (observerMode) {
      setSurveyActive(false);
      if (!section) setSection("fine-arts");
      openGraph();
    }
  }, [observerMode, section, setSection, openGraph, setSurveyActive]);

  if (observerMode) return null; 

  // Step 1: confirm role
  const handleRoleNext = () => {
    if (!audience) { setError('Choose whether you are Student or Staff.'); return; }
    setError('');
    setSurveySection('');
    setStage('section');
  };

  // Step 2: confirm section
  const handleBeginFromSection = () => {
    if (!surveySection) { setError('Select your section.'); return; }
    setError('');
    setAnimationVisible(false);
    setStage('questions');
  };

  // Step 3: submit answers (“I’M READY”) — OPTIMISTIC REVEAL
  const handleSubmitFromQuestions = (answers) => {
    if (submitting) return;
    setSubmitting(true);
    setError('');

    // 1) Reveal graph/overlay immediately (matches your working version)
    setSection(surveySection);
    setMySection(surveySection);
    setHasCompletedSurvey(true);
    setSurveyActive(false);

    setGraphVisible(true);
    setAnimationVisible(true);
    setSurveyWrapperClass('complete-active');
    setShowCompleteButton(true);

    // 2) Persist in background; when saved, wire myEntryId so DotGraph can pin my dot
    saveUserResponse(surveySection, { ...answers })
      .then((created) => {
        const id = created?._id || null;
        setMyEntryId(id);
        if (id && typeof window !== 'undefined') {
          sessionStorage.setItem('gp.myEntryId', id);
          sessionStorage.setItem('gp.mySection', surveySection);
        }
      })
      .catch((err) => {
        console.error('Error saving response:', err);
        // keep the visualization visible; just surface a soft error
        setError('We saved your view; syncing your response is taking longer than usual.');
      })
      .finally(() => setSubmitting(false));
  };

  // Overlay: DONE VIEWING (survey begins again)
  const handleComplete = () => {
    setShowCompleteButton(false);
    setGraphVisible(false);
    setStage('role');
    setAudience('');
    setSurveySection('');
    setAnimationVisible(false);
    setSurveyWrapperClass('');
    setSubmitting(false);

    setSurveyActive(true);
    setHasCompletedSurvey(false);

    // If "Done Viewing" should end personalization, you can uncomment:
    // setMyEntryId(null);
    // setMySection(null);
    // if (typeof window !== 'undefined') {
    //   sessionStorage.removeItem('gp.myEntryId');
    //   sessionStorage.removeItem('gp.mySection');
    // }
  };

  const handleAudienceChange = (role) => {
    setAudience(role);
    setError('');
    const allowed = (ROLE_SECTIONS[role] || []).map(s => s.value);
    setSurveySection(prev => (allowed.includes(prev) ? prev : ''));
  };

  const handleSectionChange = (val) => {
    setSurveySection(val);
    setError('');
  };

  // DONE VIEWING overlay — THREE only loads here
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
            {/* lightweight fallback while overlay chunk loads */}
            <div className="survey-section-wrapper2" style={{ pointerEvents: 'auto' }}>
              <div className="survey-section">
                <div className="surveyStart">
                  <button className="begin-button4" onClick={handleComplete}>
                    <h4>DONE VIEWING</h4>
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

  if (stage === 'role') {
    return (
      <div className="survey-section">
        <RoleStep
          value={audience}
          onChange={handleAudienceChange}
          onNext={handleRoleNext}
          error={error}
        />
      </div>
    );
  }

  if (stage === 'section') {
    return (
      <div className="survey-section">
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

  return (
    <QuestionFlow
      onAnswersUpdate={onAnswersUpdate}
      onSubmit={handleSubmitFromQuestions}
      submitting={submitting}
      error={error}
    />
  );
};

export default Survey;
