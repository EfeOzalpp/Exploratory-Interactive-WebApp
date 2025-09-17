// src/components/survey/QuestionFlow.jsx
import React, { useState, useEffect } from 'react';
import LottieOption from '../../lottie-for-UI/lottieOption';

const DEFAULT_QUESTIONS = [
  {
    question: 'How do you usually travel?',
    options: [
      { label: 'Public Transportation, walking or biking.', value: 'A' },
      { label: 'Electric or hybrid vehicle', value: 'B' },
      { label: 'Gas-powered vehicle', value: 'C' },
      { label: 'Prefer not to say / Other', value: 'D' }, // NEW
    ],
  },
  {
    question: 'What best describes your diet?',
    options: [
      { label: 'Moderate consumption of meat or dairy.', value: 'A' },
      { label: 'Regular consumption of meat and dairy.', value: 'B' },
      { label: 'Plant-based or vegetarian.', value: 'C' },
      { label: 'Prefer not to say / Other', value: 'D' }, // NEW
    ],
  },
  {
    question: 'You and energy use at home...',
    options: [
      { label: 'I try to reduce energy use mainly to save on bills.', value: 'A' },
      { label: 'I rarely think about energy efficiency.', value: 'B' },
      { label: 'I make a point to turn off the lights, and utilities.', value: 'C' },
      { label: 'Prefer not to say / Other', value: 'D' }, // NEW
    ],
  },
  {
    question: 'How do you think about shopping?',
    options: [
      { label: 'Often buy second-hand or eco-friendly products.', value: 'A' },
      { label: 'Occasionally choose sustainable brands.', value: 'B' },
      { label: 'I preferably shop what I like without worry', value: 'C' },
      { label: 'Prefer not to say / Other', value: 'D' }, // NEW
    ],
  },
  {
    question: 'How often do you connect with nature?',
    options: [
      { label: 'I frequently visit parks and reserves.', value: 'A' },
      { label: "I don't avoid nature if it's on my path.", value: 'B' },
      { label: "I never thought of spending time in nature.", value: 'C' },
      { label: 'Prefer not to say / Other', value: 'D' }, // NEW
    ],
  },
];

export default function QuestionFlow({ onAnswersUpdate, onSubmit, questions = DEFAULT_QUESTIONS }) {
  const [currentQuestion, setCurrentQuestion] = useState(1); // 1..N
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [fadeState, setFadeState] = useState('fade-in');

  // Transient hint visibility (first question only)
  const [hintVisible, setHintVisible] = useState(false);

  useEffect(() => {
    if (currentQuestion === 1) {
      setHintVisible(false);
      const showTimer = setTimeout(() => setHintVisible(true), 2000);
      const hideTimer = setTimeout(() => setHintVisible(false), 4000);
      return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
    } else {
      setHintVisible(false);
    }
  }, [currentQuestion]);

  const handleOptionChange = (value) => {
    const updatedAnswers = { ...answers, [`question${currentQuestion}`]: value };
    setAnswers(updatedAnswers);
    setError('');
    onAnswersUpdate?.(updatedAnswers);
  };

  const handleNext = () => {
    if (!answers[`question${currentQuestion}`]) {
      setError('None of these options fit? Mail: eozalp@massart.edu');
      return;
    }
    setFadeState('fade-out');
    setTimeout(() => {
      setFadeState('fade-in');
      if (currentQuestion < questions.length) {
        setCurrentQuestion((q) => q + 1);
      } else {
        onSubmit?.(answers);
      }
    }, 70);
  };

  const qIdx = currentQuestion - 1;
  const q = questions[qIdx];

  return (
    <div className={`survey-section ${fadeState}`}>
      {error && (
        <div className={`error-container ${fadeState}`}>
          <h2>No option fits?</h2>
          <p className="email-tag">Mail: eozalp.efe@gmail.com</p>
        </div>
      )}

      <div className="questionnaire">
        <div className="question-section">
          <div className="number-part"><h2>{currentQuestion}.</h2></div>

          <div className="question-part question-part--rel">
            <h4>{q.question}</h4>
            {currentQuestion === 1 && (
              <p className={`question-hint-bubble ${hintVisible ? 'show' : 'hide'}`} aria-hidden={!hintVisible}>
                5 questions in total
              </p>
            )}
          </div>
        </div>

        {q.options.map((option) => (
          <div
            className="input-part-inside"
            key={`${currentQuestion}-${option.value}`}
            onClick={() => handleOptionChange(option.value)}
            style={{ cursor: 'pointer' }}
          >
            <LottieOption
              onClick={() => handleOptionChange(option.value)}
              selected={answers[`question${currentQuestion}`] === option.value}
            />
            <label><p>{option.label}</p></label>
          </div>
        ))}

        <button className="begin-button2" onClick={handleNext}>
          {currentQuestion < questions.length ? <span>NEXT</span> : <span>I'M READY</span>}
        </button>
      </div>
    </div>
  );
}
