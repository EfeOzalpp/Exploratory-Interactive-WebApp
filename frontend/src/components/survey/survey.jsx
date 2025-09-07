import React, { useState } from 'react';
import client from '../../utils/sanityClient';
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useGraph } from '../../context/graphContext.tsx';

import RoleStep from './roleStep';
import SectionPickerIntro from './sectionPicker';
import QuestionFlow from './questionFlow';

const ROLE_SECTIONS = {
  student: [
    { value: 'fine-arts',     label: 'Fine Arts' },
    { value: 'digital-media', label: 'Digital / Time-Based' },
  ],
  staff: [
    { value: 'design',       label: 'Design & Applied' },
    { value: 'foundations',  label: 'Foundations & X-Discipline' },
  ],
};

const Survey = ({ setAnimationVisible, setGraphVisible, setSurveyWrapperClass, onAnswersUpdate }) => {
  const [stage, setStage] = useState('role'); // 'role' | 'section' | 'questions'
  const [audience, setAudience] = useState('');
  const [surveySection, setSurveySection] = useState('');
  const [error, setError] = useState('');
  const [showCompleteButton, setShowCompleteButton] = useState(false);

  // include setSection from context
  const { setSurveyActive, setHasCompletedSurvey, setSection } = useGraph();

  const availableSections = audience ? (ROLE_SECTIONS[audience] || []) : [];

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

  // Step 3: submit answers (“I’M READY”)
  const handleSubmitFromQuestions = async (answers) => {
    // Set the global section so GraphPicker mounts with it selected
    setSection(surveySection);

    setHasCompletedSurvey(true);
    setSurveyActive(false);

    setShowCompleteButton(true);
    setGraphVisible(true);
    setAnimationVisible(true);
    setSurveyWrapperClass('complete-active');

    try {
      await client.create({
        _type: 'userResponseV2',
        section: surveySection,
        audience,
        ...answers,
        submittedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error saving response to Sanity:', err);
    }
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

    setSurveyActive(true);
    setHasCompletedSurvey(false);

    // (optional) clear global section so the picker shows placeholder next run
    // setSection('');
  };

  // Clear error when audience changes and keep section valid
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

  // COMPLETE overlay
  if (showCompleteButton) {
    return (
      <Canvas style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
        <Html zIndexRange={[22, 22]}>
          <div className="z-index-respective" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', height: '100vh', pointerEvents: 'none'}}>
            <div className="survey-section-wrapper2">
              <div className="survey-section">
                <div className="surveyStart">
                  <button className="begin-button4" onClick={handleComplete}>
                    <h4>DONE VIEWING</h4>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Html>
      </Canvas>
    );
  }

  // Step switch
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
          sections={availableSections}  // only two options based on role
        />
      </div>
    );
  }

  // stage === 'questions'
  return (
    <QuestionFlow
      onAnswersUpdate={onAnswersUpdate}
      onSubmit={handleSubmitFromQuestions}
    />
  );
};

export default Survey;
