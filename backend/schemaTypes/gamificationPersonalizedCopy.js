export default {
  name: 'gamificationPersonalizedCopy',
  title: 'Gamification Copy · Personalized',
  type: 'document',
  fields: [
    {
      name: 'range',
      title: 'Percent Range',
      type: 'object',
      fields: [
        { name: 'minPct', title: 'Min % (inclusive)', type: 'number', validation: (R) => R.required().min(0).max(100) },
        { name: 'maxPct', title: 'Max % (inclusive)', type: 'number', validation: (R) => R.required().min(0).max(100) },
      ],
      validation: (R) => R.custom((v) =>
        v && v.minPct <= v.maxPct ? true : 'minPct must be ≤ maxPct'
      ),
    },
    { name: 'titles', title: 'Titles', type: 'array', of: [{ type: 'string' }], validation: (R) => R.min(1) },
    { name: 'secondary', title: 'Secondary Pool', type: 'array', of: [{ type: 'string' }], validation: (R) => R.min(1) },
    { name: 'enabled', title: 'Enabled', type: 'boolean', initialValue: true },
    { name: 'notes', title: 'Notes', type: 'text' },
  ],
  preview: {
    select: { a: 'range.minPct', b: 'range.maxPct' },
    prepare: ({ a, b }) => ({ title: `Personalized · ${a}-${b}%` }),
  },
};
