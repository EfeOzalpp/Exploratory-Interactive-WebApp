// src/components/survey/questions.weights.js
export const WEIGHTED_QUESTIONS = [
  {
    id: 'q1',
    prompt: 'How do you usually get around?',
    options: [
      { key: 'A', label: 'Use the sidewalks or bike around to get places', weight: 0.95 },
      { key: 'B', label: 'Bound to a regular vehicle for short trips & errands', weight: 0.05 },
      { key: 'C', label: 'Take public transit and shared rides', weight: 0.7 },
      { key: 'D', label: 'Bound to a car made via clean energy and materials', weight: 0.40 },
    ],
  },
  {
    id: 'q2',
    prompt: 'Which best describes your eating habits?',
    options: [
      { key: 'A', label: 'Plant-forward, with a bit of meat or dairy', weight: 0.7 },
      { key: 'B', label: 'Mostly plant-based or vegetarian meals', weight: 1.00 },
      { key: 'C', label: 'Mostly non-local meat or dairy, often imported', weight: 0.10 },
      { key: 'D', label: 'A mix, including meat or dairy a few times a week', weight: 0.5 },
    ],
  },
  {
    id: 'q3',
    prompt: 'How mindful are you about energy use at home?',
    options: [
      { key: 'A', label: 'Sometimes forget or don’t think about it', weight: 0.35 },
      { key: 'B', label: 'Try to save energy when you can', weight: 0.65 },
      { key: 'C', label: 'Don’t really pay attention to it', weight: 0.15 },
      { key: 'D', label: 'Turn things off when they’re not in use', weight: 1.00 },
    ],
  },
  {
    id: 'q4',
    prompt: 'When you shop, what feels most like you?',
    options: [
      { key: 'A', label: 'Shop from local stores or small brands you like', weight: 0.8 },
      { key: 'B', label: 'Buy brand new things each time you need to', weight: 0.25 },
      { key: 'C', label: 'Buy from sustainable and transparent brands', weight: 0.6 },
      { key: 'D', label: 'Look for second-hand finds or things made to last', weight: 1.00 },
    ],
  },
  {
    id: 'q5',
    prompt: 'How do you handle waste at home?',
    options: [
      { key: 'A', label: 'Recycle occasionally when it’s convenient', weight: 0.45 },
      { key: 'B', label: 'Separate most recyclables (paper, plastic, glass) regularly', weight: 0.7 },
      { key: 'C', label: 'Toss everything out together', weight: 0.00 },
      { key: 'D', label: 'Sort thoroughly and compost organics whenever possible', weight: 1.00 },
    ],
  },
];
