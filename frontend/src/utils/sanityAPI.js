// utils/sanityAPI.js
import { cdnClient, liveClient } from './sanityClient';

// --- section ids (unchanged) ---
const STUDENT_IDS = [
  '3d-arts','animation','architecture','art-education','ceramics',
  'communication-design','creative-writing','design-innovation','digital-media',
  'dynamic-media-institute','fashion-design','fibers','film-video','fine-arts-2d',
  'furniture-design','glass','history-of-art','humanities','illustration',
  'industrial-design','integrative-sciences','jewelry-metalsmithing','liberal-arts',
  'mfa-low-residency','mfa-low-residency-foundation','mfa-studio-arts',
  'painting','photography','printmaking','sculpture','studio-arts',
  'studio-interrelated-media','studio-foundation','visual-storytelling',
  'fine-arts','design','foundations'
];

const STAFF_IDS = [
  'academic-affairs','academic-resource-center','administration-finance',
  'administrative-services','admissions','artward-bound','bookstore','bursar',
  'career-development','center-art-community','community-health','compass',
  'conference-event-services','counseling-center','facilities','fiscal-accounting',
  'fiscal-budget','graduate-programs','health-office','housing-residence-life',
  'human-resources','institutional-advancement','institutional-research',
  'international-education','justice-equity','library','marketing-communications',
  'maam','foundation','president-office','pce','public-safety','registrar',
  'student-development','student-engagement','student-financial-assistance',
  'sustainability','technology','woodshop','youth-programs'
];

const NON_VISITOR_MASSART = Array.from(new Set([...STUDENT_IDS, ...STAFF_IDS]));

const round2 = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : undefined);

// normalize to the shape your viz uses (also 2dp)
const normalizeRow = (r) => {
  const q1 = round2(r.q1), q2 = round2(r.q2), q3 = round2(r.q3), q4 = round2(r.q4), q5 = round2(r.q5);
  const avgWeight = round2(r.avgWeight);
  return {
    ...r,
    q1, q2, q3, q4, q5, avgWeight,
    weights: {
      question1: q1 ?? 0.5,
      question2: q2 ?? 0.5,
      question3: q3 ?? 0.5,
      question4: q4 ?? 0.5,
      question5: q5 ?? 0.5,
    },
  };
};

const PROJECTION = `
  _id, section,
  q1, q2, q3, q4, q5,
  avgWeight,
  submittedAt
`;

function buildQueryAndParams(section, limit) {
  const BASE = "*[!(_id in path('drafts.**')) && _type == 'userResponseV3'";

  if (!section || section === 'all') {
    return { query: `${BASE}] | order(coalesce(submittedAt, _createdAt) desc)[0...$limit]{ ${PROJECTION} }`, params: { limit } };
  }
  if (section === 'all-massart') {
    return { query: `${BASE} && section in $sections] | order(coalesce(submittedAt, _createdAt) desc)[0...$limit]{ ${PROJECTION} }`, params: { sections: NON_VISITOR_MASSART, limit } };
  }
  if (section === 'all-students') {
    return { query: `${BASE} && section in $sections] | order(coalesce(submittedAt, _createdAt) desc)[0...$limit]{ ${PROJECTION} }`, params: { sections: STUDENT_IDS, limit } };
  }
  if (section === 'all-staff') {
    return { query: `${BASE} && section in $sections] | order(coalesce(submittedAt, _createdAt) desc)[0...$limit]{ ${PROJECTION} }`, params: { sections: STAFF_IDS, limit } };
  }
  return { query: `${BASE} && section == $section] | order(coalesce(submittedAt, _createdAt) desc)[0...$limit]{ ${PROJECTION} }`, params: { section, limit } };
}

export const subscribeSurveyData = ({ section, limit = 300, onData }) => {
  const { query, params } = buildQueryAndParams(section, limit);
  const pump = (rows) => onData(rows.map(normalizeRow));

  let refreshTimeout, sub;

  liveClient.fetch(query, params).then(pump).catch((e)=>console.error('[sanityAPI] initial fetch', e));
  sub = cdnClient.listen(query, params, { visibility: 'query' }).subscribe({
    next: () => {
      clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        liveClient.fetch(query, params).then(pump).catch((e)=>console.error('[sanityAPI] refresh fetch', e));
      }, 100);
    },
    error: (e) => console.error('[sanityAPI] listen', e),
  });

  return () => { clearTimeout(refreshTimeout); sub?.unsubscribe?.(); };
};

export const fetchSurveyData = (callback, { limit = 300 } = {}) => {
  const query = `
    *[!(_id in path('drafts.**')) && _type == "userResponseV3"]
      | order(coalesce(submittedAt, _createdAt) desc)[0...$limit]{ ${PROJECTION} }
  `;
  const pump = (rows) => callback(rows.map(normalizeRow));

  let refreshTimeout, sub;
  liveClient.fetch(query, { limit }).then(pump).catch((e)=>console.error('[sanityAPI] initial fetch', e));
  sub = cdnClient.listen(query, { limit }, { visibility: 'query' }).subscribe({
    next: () => {
      clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        liveClient.fetch(query, { limit }).then(pump).catch((e)=>console.error('[sanityAPI] refresh fetch', e));
      }, 100);
    },
    error: (e) => console.error('[sanityAPI] listen', e),
  });

  return () => { clearTimeout(refreshTimeout); sub?.unsubscribe?.(); };
};

export const subscribeSectionCounts = ({ onData }) => {
  const query = `*[!(_id in path('drafts.**')) && _type == "userResponseV3"]{ section }`;

  const pump = (rows) => {
    const counts = new Map();
    for (const r of rows || []) counts.set(r?.section || '', (counts.get(r?.section || '') || 0) + 1);
    const bySection = Object.fromEntries(counts);
    const sum = (ids) => ids.reduce((acc, id) => acc + (bySection[id] || 0), 0);

    onData({
      all: rows?.length || 0,
      'all-massart': sum(NON_VISITOR_MASSART),
      'all-students': sum(STUDENT_IDS),
      'all-staff': sum(STAFF_IDS),
      visitor: bySection['visitor'] || 0,
      ...bySection,
    });
  };

  let refreshTimeout, sub;
  liveClient.fetch(query, {}).then(pump).catch((e)=>console.error('[sanityAPI] counts initial', e));
  sub = cdnClient.listen(query, {}, { visibility: 'query' }).subscribe({
    next: () => {
      clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        liveClient.fetch(query, {}).then(pump).catch((e)=>console.error('[sanityAPI] counts refresh', e));
      }, 100);
    },
    error: (e) => console.error('[sanityAPI] counts listen', e),
  });

  return () => { clearTimeout(refreshTimeout); sub?.unsubscribe?.(); };
};

export { STUDENT_IDS, STAFF_IDS, NON_VISITOR_MASSART };
