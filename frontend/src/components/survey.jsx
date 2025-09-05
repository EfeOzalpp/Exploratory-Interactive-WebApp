import React, { useState } from 'react';
import client from '../utils/sanityClient';
import LottieOption from '../lottie-for-UI/lottieOption'; // Import the LottieOption component
import { Canvas } from '@react-three/fiber';
import { Html } from '@react-three/drei';

const Questionnaire = ({ setAnimationVisible, setGraphVisible, setSurveyWrapperClass, onAnswersUpdate}) => {
  const [currentQuestion, setCurrentQuestion] = useState(0); // Start at 0 (no question shown)
  const [answers, setAnswers] = useState({});
  
  const [error, setError] = useState(''); // Track validation errors
  const [fadeState, setFadeState] = useState('fade-in'); // Track fading state
  const [showCompleteButton, setShowCompleteButton] = useState(false); // Track whether to show the COMPLETE button

const handleOptionChange = (value) => {
  const updatedAnswers = { ...answers, [`question${currentQuestion}`]: value };
  setAnswers(updatedAnswers);
  setError('');

  // Send updated answers to parent component (FrontPage)
  onAnswersUpdate(updatedAnswers);
};

const handleNext = () => {
  // Check if the current question is answered
  if (!answers[`question${currentQuestion}`]) {
    setError('None of these options fit? Mail: eozalp@massart.edu');
    return;
  }
  setFadeState('fade-out');

  // After the fade-out effect completes, move to the next question
  setTimeout(() => {
    setFadeState('fade-in'); // Trigger fade-in effect for the next question
    if (currentQuestion < 5) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      handleSubmit();
    }
  }, 500); // Match the duration of fade-out animation
};

const handleSubmit = async () => {
  // Check if the last question is answered
  if (!answers[`question${currentQuestion}`]) {
    setError('None of these options fit? Mail: eozalp@massart.edu');
    return;
  }

  // Show the COMPLETE button immediately
  setShowCompleteButton(true);
  setGraphVisible(true); 
  setAnimationVisible(true);

  setSurveyWrapperClass('complete-active');

  try {
    await client.create({
      _type: 'userResponseV2',
      ...answers,
      submittedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error saving response to Sanity:', error);
  }
};

const handleStart = () => {
setFadeState('fade-out');

setTimeout(() => {
  setCurrentQuestion(1);
  setAnimationVisible(false); // Reset animation when starting over
  setFadeState('fade-in');
}, 100); // Match fade-out duration
};

const questions = [
  {
    question: 'How do you usually travel?',
    options: [
      { label: 'Public Transportation, walking or biking.', value: 'A' },
      { label: 'Electric or hybrid vehicle', value: 'B' },
      { label: 'Gas-powered vehicle', value: 'C' },
    ],
  },
  {
    question: 'What best describes your diet?',
    options: [
      { label: 'Moderate consumption of meat or dairy.', value: 'A' },
      { label: 'Regular consumption of meat and dairy.', value: 'B' },
      { label: 'Plant-based or vegetarian.', value: 'C' },
    ],
  },
  {
    question: 'You and energy use at home...',
    options: [
      { label: 'I try to reduce energy use mainly to save on bills.', value: 'A' },
      { label: 'I rarely think about energy efficiency.', value: 'B' },
      { label: 'I make a point to turn off the lights, and utilities.', value: 'C' },
    ],
  },
  {
    question: 'How do you think about shopping?',
    options: [
      { label: 'Often buy second-hand or eco-friendly products.', value: 'A' },
      { label: 'Occasionally choose sustainable brands.', value: 'B' },
      { label: 'I preferably shop what I like without worry', value: 'C' },
    ],
  },
  {
    question: 'How often do you connect with nature?',
    options: [
      { label: 'I frequently visit parks and reserves.', value: 'A' },
      { label: "I don't avoid nature if it's on my path.", value: 'B' },
      { label: "I never thought of spending time in nature.", value: 'C' },
    ],
  },
];

const handleComplete = () => {
  try {
    setShowCompleteButton(false);
    setGraphVisible(false);
    setCurrentQuestion(0);
    setAnswers({
      question1: '',
      question2: '',
      question3: '',
      question4: '',
      question5: '',
    });
    setAnimationVisible(false);
    setSurveyWrapperClass('');
  } catch (error) {
    console.error('Error in handleComplete:', error);
  }
};

// Complete Button
if (showCompleteButton) {
  return (
    <Canvas
    style={{ width: '100%', height: '100%', pointerEvents: 'none' }} // Full-screen canvas styling
  >
    {/* Use Three.js's world coordinates for positioning */}
    <Html zIndexRange={[22, 22]}>
    <div className="z-index-respective" style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', height: '100vh', pointerEvents: 'none'}}>
      <div className="survey-section-wrapper2">
        <div className="survey-section">
          <div className="surveyStart">
            <button className="begin-button4" onClick={handleComplete}>
              <h4>DONE VIEWING</h4>
            </button>
          </div></div>
        </div>
      </div>
    </Html>
  </Canvas>
  );
}
  
// Starting Section
if (currentQuestion === 0) {
  return (
    <div className={`survey-section ${fadeState}`}>
      <div className="surveyStart">
        <h3 className="begin-title1">Welcome</h3>
        <h1 className="begin-title2">Butterfly Effect</h1>
        <button className="begin-button" onClick={handleStart}>
          <h4>BEGIN</h4>
        </button>
      </div>
    </div>
  );
}

//  Question 
return (
  <div className={`survey-section ${fadeState}`}>

{error && (
          <div className={`error-container ${fadeState}`}>
            <h2>None of these options fit?</h2>
            <p className="email-tag">Mail: eozalp@massart.edu</p>
          </div>
        )}

    <div className="questionnaire">
      <div className="question-section">
        <div className="number-part">
          <h2>{currentQuestion}.</h2>
        </div>
        <div className="question-part">
          <h4>
            {questions[currentQuestion - 1].question}
          </h4>
        </div>
      </div>

      {questions[currentQuestion - 1].options.map((option, index) => (
        <div className="input-part-inside" 
        key={`${currentQuestion}-${option.value}`}
        onClick={() => handleOptionChange(option.value)} 
        style={{ cursor: 'pointer' }} // Make the whole area clickable
        >
          <LottieOption
            onClick={() => handleOptionChange(option.value)}
            selected={answers[`question${currentQuestion}`] === option.value}
          />
          <label><p>{option.label}</p></label> {/* Display the user-friendly label */}
        </div>
      ))}

      <button className="begin-button2" onClick={handleNext}>
        {currentQuestion < 5 ? <h4>NEXT</h4> : <h4>I'M READY</h4>}
      </button>
    </div>
  </div>
 );
};

export default Questionnaire;
