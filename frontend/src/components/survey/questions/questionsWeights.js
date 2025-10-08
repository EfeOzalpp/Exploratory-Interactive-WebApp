// src/components/survey/questions.weights.js
export const WEIGHTED_QUESTIONS = [
  {
    id: 'q1',
    prompt: 'How do you usually get around?',
    options: [
      { key: 'A', label: 'Use the sidewalks or bike around to get places', weight: 1.00 },
      { key: 'B', label: 'Take public transit and shared rides', weight: 0.75 },
      { key: 'C', label: 'Deal with a fuel-efficient or hybrid car', weight: 0.50 },
      { key: 'D', label: 'Bound to drive a gas car for short trips and errands', weight: 0.00 },
    ],
  },
  {
    id: 'q2',
    prompt: 'Which best describes your eating habits?',
    options: [
      { key: 'A', label: 'Mostly plant-based or vegetarian meals', weight: 1.00 },
      { key: 'B', label: 'Plant-forward, with a bit of meat or dairy', weight: 0.75 },
      { key: 'C', label: 'A mix that includes meat or dairy a few times a week', weight: 0.50 },
      { key: 'D', label: 'Meat or dairy most days, often imported', weight: 0.20 },
    ],
  },
  {
    id: 'q3',
    prompt: 'How mindful are you about energy use at home?',
    options: [
      { key: 'A', label: 'Turn things off when they’re not in use', weight: 1.00 },
      { key: 'B', label: 'Try to save energy when you can', weight: 0.75 },
      { key: 'C', label: 'Sometimes forget or don’t think about it', weight: 0.40 },
      { key: 'D', label: 'Don’t really pay attention to it', weight: 0.20 },
    ],
  },
  {
    id: 'q4',
    prompt: 'When you shop, what feels most like you?',
    options: [
      { key: 'A', label: 'Look for second-hand finds or things made to last', weight: 1.00 },
      { key: 'B', label: 'Shop from local stores or small brands you like', weight: 0.85 },
      { key: 'C', label: 'Buy from brands that seem thoughtful or transparent', weight: 0.70 },
      { key: 'D', label: 'Buy brand new things each time when you need something', weight: 0.35 },
    ],
  },
  {
    id: 'q5',
    prompt: 'How do you handle waste at home?',
    options: [
      { key: 'A', label: 'Compost and recycle as much as possible', weight: 1.00 },
      { key: 'B', label: 'Recycle most things', weight: 0.75 },
      { key: 'C', label: 'Recycle sometimes', weight: 0.50 },
      { key: 'D', label: 'Toss everything out together', weight: 0.00 },
    ],
  },
];
