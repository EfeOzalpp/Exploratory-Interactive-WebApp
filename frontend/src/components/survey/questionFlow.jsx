import React, { useState } from 'react';
import LottieOption from '../../lottie-for-UI/lottieOption';

const DEFAULT_QUESTIONS = [
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

export default function QuestionFlow({
  onAnswersUpdate,
  onSubmit,               // (answers) => void
  questions = DEFAULT_QUESTIONS,
}) {
  const [currentQuestion, setCurrentQuestion] = useState(1); // 1..5
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [fadeState, setFadeState] = useState('fade-in');

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
        onSubmit?.(answers); // "I'M READY"
      }
    }, 500);
  };

  const qIdx = currentQuestion - 1;
  const q = questions[qIdx];

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
            <h4>{q.question}</h4>
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
          {currentQuestion < questions.length ? <h4>NEXT</h4> : <h4>I'M READY</h4>}
        </button>
      </div>
    </div>
  );
}
