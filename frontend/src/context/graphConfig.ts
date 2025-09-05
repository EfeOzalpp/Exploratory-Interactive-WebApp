// graphConfig.ts
export const GRAPH_SECTIONS = {
  "fine-arts":     { dataset: "fine-arts" },
  "digital-media": { dataset: "digital-media" },
  "design":        { dataset: "design-applied" },
  "foundations":   { dataset: "foundations" },
} as const;

export type SectionKey = keyof typeof GRAPH_SECTIONS;
