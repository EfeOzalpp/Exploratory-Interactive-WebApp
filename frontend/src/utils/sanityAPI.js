// utils/sanityAPI.js
import client from './sanityClient';

const answerRewiring = {
  question1: { A: 0, B: 0.5, C: 1 }, // A = good, B = neutral, C = bad
  question2: { C: 0, A: 0.5, B: 1 }, // C = good, A = neutral, B = bad
  question3: { C: 0, A: 0.5, B: 1 }, // C = good, A = neutral, B = bad
  question4: { A: 0, B: 0.5, C: 1 }, // A = good, B = neutral, C = bad
  question5: { A: 0, B: 0.5, C: 1 }, // A = good, B = neutral, C = bad
};

const normalizeAnswers = (response) => {
  const normalized = {};
  for (const q in answerRewiring) {
    const ans = response?.[q];
    normalized[q] = (answerRewiring[q]?.[ans] ?? 0.5);
  }
  return normalized;
};

export const subscribeSurveyData = ({ section, limit = 300, onData }) => {
  if (!section) return () => {}; // no-op until a section is selected

  const base = `*[_type == "userResponseV2" && section == $section]`;
  const query = `
    ${base} | order(coalesce(submittedAt, _createdAt) desc)[0...$limit]{
      _id, section,
      question1, question2, question3, question4, question5,
      submittedAt
    }
  `;

  const pump = (rows) => onData(rows.map(r => ({ ...r, weights: normalizeAnswers(r) })));

  let t, sub;

  client.fetch(query, { section, limit }).then(pump).catch(err => console.error('initial fetch error', err));

  sub = client.listen(query, { section, limit }, { visibility: 'query' }).subscribe({
    next: () => {
      clearTimeout(t);
      t = setTimeout(() => client.fetch(query, { section, limit }).then(pump).catch(err => console.error('refresh fetch error', err)), 120);
    },
    error: (err) => console.error('listen error', err),
  });

  return () => { clearTimeout(t); sub?.unsubscribe?.(); };
};

// (optional legacy helper)
export const fetchSurveyData = (callback) => {
  const query = `
    *[_type == "userResponseV2"] | order(coalesce(submittedAt, _createdAt) desc){
      _id, section, question1, question2, question3, question4, question5, submittedAt
    }
  `;
  let sub;
  client.fetch(query).then(rows => callback(rows.map(r => ({ ...r, weights: normalizeAnswers(r) }))));
  sub = client.listen(query).subscribe({ next: () => client.fetch(query).then(rows => callback(rows.map(r => ({ ...r, weights: normalizeAnswers(r) })))) });
  return () => sub?.unsubscribe?.();
};
