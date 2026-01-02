// src/components/survey/types.ts
export type Option = { key: string; label: string; weight: number };
export type Question = {
  id: string;
  prompt: string;
  options: Option[];
  required?: boolean;
};
