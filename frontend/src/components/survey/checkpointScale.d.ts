import * as React from 'react';

export type CheckpointScaleOption = { label: string; weight: number };

export interface CheckpointScaleProps {
  options: CheckpointScaleOption[];
  value?: number | null;
  initialT?: number;         // defaults to 1.5
  resetKey: string;
  onChange?: (w: number, meta: {
    t: number;
    index?: number;
    committed: boolean;
    prime?: boolean;
    dragging?: boolean;
  }) => void;

  // tutorial-friendly props your .jsx implements:
  t?: number;                // 0..3 controlled thumb
  interactive?: boolean;     // default true
  showDots?: boolean;        // default true
}

declare const CheckpointScale: React.FC<CheckpointScaleProps>;
export default CheckpointScale;
