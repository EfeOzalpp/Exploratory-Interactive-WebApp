// src/components/survey/questions.weights.js
export const WEIGHTED_QUESTIONS = [
  {
    id: 'q1',
    prompt: 'What is your usual commute?',
    options: [
      { key: 'A', label: 'Public Transportation',     weight: 0.25 },
      { key: 'B', label: 'Electric or hybrid car',    weight: 1 },
      { key: 'C', label: 'Gas-powered car',           weight: 0 },
      { key: 'D', label: 'Walking and or biking',     weight: 0.75 },
    ],
  },
  {
    id: 'q2',
    prompt: 'What best describes your diet?',
    options: [
      { key: 'C', label: 'Plant-based or vegetarian.',             weight: 0.76 },
      { key: 'A', label: 'Moderate consumption of meat or dairy.', weight: 0.48 },
      { key: 'B', label: 'Regular consumption of meat and dairy.', weight: 0.34 },
      { key: 'D', label: 'Prefer not to say / Other',              weight: 0.12 },
    ],
  },
  {
    id: 'q3',
    prompt: 'You and energy use at home...',
    options: [
      { key: 'C', label: 'I make a point to turn off the lights, and utilities.', weight: 0.89 },
      { key: 'A', label: 'I try to reduce energy use mainly to save on bills.',   weight: 0.64 },
      { key: 'B', label: 'I rarely think about energy efficiency.',               weight: 0.21 },
      { key: 'D', label: 'Prefer not to say / Other',                             weight: 0.10 },
    ],
  },
  {
    id: 'q4',
    prompt: 'How do you think about shopping?',
    options: [
      { key: 'A', label: 'Often buy second-hand or eco-friendly products.', weight: 0.73 },
      { key: 'B', label: 'Occasionally choose sustainable brands.',          weight: 0.58 },
      { key: 'C', label: 'I preferably shop what I like without worry',      weight: 0.30 },
      { key: 'D', label: 'Prefer not to say / Other',                        weight: 0.09 },
    ],
  },
  {
    id: 'q5',
    prompt: 'How often do you connect with nature?',
    options: [
      { key: 'A', label: 'I frequently visit parks and reserves.',   weight: 0.88 },
      { key: 'B', label: "I don't avoid nature if it's on my path.", weight: 0.55 },
      { key: 'C', label: "I never thought of spending time in nature.", weight: 0.18 },
      { key: 'D', label: 'Prefer not to say / Other',                 weight: 0.07 },
    ],
  },
];
