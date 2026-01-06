// src/components/survey/questions/questions.ts
import type { Question } from '../types';

export const WEIGHTED_QUESTIONS: Question[] = [
  {
    id: 'q1',
    prompt: 'How do you usually get around?',
    required: true,
    options: [
      { key: 'A', label: 'Use sidewalks or bicycle', weight: 0.95 },
      { key: 'B', label: 'Take public transit and shared rides', weight: 0.7 },
      { key: 'C', label: 'Use a solely gas-powered vehicle for short trips & errands', weight: 0.05 },
      { key: 'D', label: 'Use an electric or hybrid car or truck', weight: 0.4 },
    ],
  },
  {
    id: 'q2',
    prompt: 'Which best describes your eating habits?',
    required: true,
    options: [
      { key: 'A', label: 'Plant-based, with a bit of animal meat or dairy', weight: 0.7 },
      { key: 'B', label: 'Mostly plant-based or vegetarian meals', weight: 1.0 },
      { key: 'C', label: 'Mostly non-local meat or dairy, often imported', weight: 0.1 },
      { key: 'D', label: 'A mix, including meat or dairy a few times a week', weight: 0.5 },
    ],
  },
  {
    id: 'q3',
    prompt: 'How mindful are you about energy use at home?',
    required: true,
    options: [
      { key: 'A', label: 'Sometimes forget or don’t think about it', weight: 0.35 },
      { key: 'B', label: 'Try to save energy when possible', weight: 0.65 },
      { key: 'C', label: 'Don’t really pay attention to it', weight: 0.15 },
      { key: 'D', label: 'Turn things off when they’re not in use', weight: 1.0 },
    ],
  },
  {
    id: 'q4',
    prompt: 'When you shop, what feels most like you?',
    required: true,
    options: [
      { key: 'A', label: 'Shop from local stores and small brands you like', weight: 0.8 },
      { key: 'B', label: 'Buy brand-new things each time you need to', weight: 0.25 },
      { key: 'C', label: 'Buy from sustainable and transparent brands', weight: 0.6 },
      { key: 'D', label: 'Look for thrift shop finds or things made to last', weight: 1.0 },
    ],
  },
  {
    id: 'q5',
    prompt: 'How do you handle waste at home?',
    required: true,
    options: [
      { key: 'A', label: 'Recycle occasionally when it’s convenient', weight: 0.45 },
      { key: 'B', label: 'Separate most recyclables regularly', weight: 0.7 },
      { key: 'C', label: 'Toss everything out together', weight: 0.0 },
      { key: 'D', label: 'Sort thoroughly and compost organics whenever possible', weight: 1.0 },
    ],
  },
];
