// src/components/survey/questions.weights.js
export const WEIGHTED_QUESTIONS = [
  {
    id: 'q1',
    prompt: 'What is your usual commute?',
    // A..D kept for familiarity, but we only use .weight
    options: [
      { key: 'A', label: 'Public Transportation', weight: 1.0 },
      { key: 'B', label: 'Electric or hybrid car',  weight: 1.0 },
      { key: 'C', label: 'Gas-powered car',   weight: 1.0 },
      { key: 'D', label: 'Walking and or biking', weight: 1.0 },
    ],
  },
  {
    id: 'q2',
    prompt: 'What best describes your diet?',
    options: [
      { key: 'C', label: 'Plant-based or vegetarian.',                    weight: 1.0 },
      { key: 'A', label: 'Moderate consumption of meat or dairy.',        weight: 1.0 },
      { key: 'B', label: 'Regular consumption of meat and dairy.',        weight: 1.0 },
      { key: 'D', label: 'Prefer not to say / Other',                     weight: 1.0 },
    ],
  },
  {
    id: 'q3',
    prompt: 'You and energy use at home...',
    options: [
      { key: 'C', label: 'I make a point to turn off the lights, and utilities.', weight: 1.0 },
      { key: 'A', label: 'I try to reduce energy use mainly to save on bills.',   weight: 1.0 },
      { key: 'B', label: 'I rarely think about energy efficiency.',               weight: 1.0 },
      { key: 'D', label: 'Prefer not to say / Other',                             weight: 1.0 },
    ],
  },
  {
    id: 'q4',
    prompt: 'How do you think about shopping?',
    options: [
      { key: 'A', label: 'Often buy second-hand or eco-friendly products.', weight: 1.0 },
      { key: 'B', label: 'Occasionally choose sustainable brands.',          weight: 1.0 },
      { key: 'C', label: 'I preferably shop what I like without worry',      weight: 1.0 },
      { key: 'D', label: 'Prefer not to say / Other',                        weight: 1.0 },
    ],
  },
  {
    id: 'q5',
    prompt: 'How often do you connect with nature?',
    options: [
      { key: 'A', label: 'I frequently visit parks and reserves.', weight: 1.0 },
      { key: 'B', label: "I don't avoid nature if it's on my path.", weight: 1.0 },
      { key: 'C', label: "I never thought of spending time in nature.", weight: 1.0 },
      { key: 'D', label: 'Prefer not to say / Other', weight: 1.0 },
    ],
  },
];
