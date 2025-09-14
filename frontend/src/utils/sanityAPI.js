// utils/sanityAPI.js
import { cdnClient, liveClient } from './sanityClient';

// --- scoring map ---
const answerRewiring = {
  question1: { A: 0, B: 0.5, C: 1 },
  question2: { C: 0, A: 0.5, B: 1 },
  question3: { C: 0, A: 0.5, B: 1 },
  question4: { A: 0, B: 0.5, C: 1 },
  question5: { A: 0, B: 0.5, C: 1 },
};

const normalizeAnswers = (response) => {
  const normalized = {};
  for (const q in answerRewiring) {
    const ans = response?.[q];
    normalized[q] = answerRewiring[q]?.[ans] ?? 0.5;
  }
  return normalized;
};

// --- current section ids (from ROLE_SECTIONS) ---
// NOTE: legacy umbrella ids ('fine-arts', 'digital-media', 'design', 'foundations')
// are now INCLUDED here per your request.
const STUDENT_IDS = [
  '3d-arts','animation','architecture','art-education','ceramics',
  'communication-design','creative-writing','design-innovation','digital-media',
  'dynamic-media-institute','fashion-design','fibers','film-video','fine-arts-2d',
  'furniture-design','glass','history-of-art','humanities','illustration',
  'industrial-design','integrative-sciences','jewelry-metalsmithing','liberal-arts',
  'mfa-low-residency','mfa-low-residency-foundation','mfa-studio-arts',
  'painting','photography','printmaking','sculpture','studio-arts',
  'studio-interrelated-media','studio-foundation','visual-storytelling',
  // legacy umbrellas folded into student bucket:
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

// everything non-visitor that “belongs” to MassArt (students + staff)
const NON_VISITOR_MASSART = Array.from(new Set([...STUDENT_IDS, ...STAFF_IDS]));

// --- Build query/params for each picker value ---
function buildQueryAndParams(section, limit) {
  const BASE = "*[!(_id in path('drafts.**')) && _type == 'userResponseV2'";

  if (!section || section === 'all') {
    // everyone
    return {
      query: `
        ${BASE}]
          | order(coalesce(submittedAt, _createdAt) desc)[0...$limit]{
            _id, section,
            question1, question2, question3, question4, question5,
            submittedAt
          }
      `,
      params: { limit },
    };
  }

  if (section === 'all-massart') {
    // students + staff (exclude visitors)
    return {
      query: `
        ${BASE} && section in $sections]
          | order(coalesce(submittedAt, _createdAt) desc)[0...$limit]{
            _id, section,
            question1, question2, question3, question4, question5,
            submittedAt
          }
      `,
      params: { sections: NON_VISITOR_MASSART, limit },
    };
  }

  if (section === 'all-students') {
    return {
      query: `
        ${BASE} && section in $sections]
          | order(coalesce(submittedAt, _createdAt) desc)[0...$limit]{
            _id, section,
            question1, question2, question3, question4, question5,
            submittedAt
          }
      `,
      params: { sections: STUDENT_IDS, limit },
    };
  }

  if (section === 'all-staff') {
    return {
      query: `
        ${BASE} && section in $sections]
          | order(coalesce(submittedAt, _createdAt) desc)[0...$limit]{
            _id, section,
            question1, question2, question3, question4, question5,
            submittedAt
          }
      `,
      params: { sections: STAFF_IDS, limit },
    };
  }

  // specific section (incl. 'visitor')
  return {
    query: `
      ${BASE} && section == $section]
        | order(coalesce(submittedAt, _createdAt) desc)[0...$limit]{
          _id, section,
          question1, question2, question3, question4, question5,
          submittedAt
        }
    `,
    params: { section, limit },
  };
}

/**
 * Live, section-filtered subscription (with special groups).
 * - "all" → no filter
 * - "all-massart" → students + staff (no visitors)
 * - "all-students" → student ids (incl. legacy umbrellas you asked to include)
 * - "all-staff" → staff ids
 * - anything else → exact section match (incl. "visitor")
 * - Excludes drafts
 */
export const subscribeSurveyData = ({ section, limit = 300, onData }) => {
  const { query, params } = buildQueryAndParams(section, limit);

  const pump = (rows) =>
    onData(rows.map((r) => ({ ...r, weights: normalizeAnswers(r) })));

  let refreshTimeout;
  let sub;

  // Initial fetch: bypass CDN
  liveClient
    .fetch(query, params)
    .then(pump)
    .catch((err) => console.error('[sanityAPI] initial fetch error', err));

  // Listen (real-time), then refresh with live fetch
  sub = cdnClient
    .listen(query, params, { visibility: 'query' })
    .subscribe({
      next: () => {
        clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(() => {
          liveClient
            .fetch(query, params)
            .then(pump)
            .catch((err) => console.error('[sanityAPI] refresh fetch error', err));
        }, 100);
      },
      error: (err) => console.error('[sanityAPI] listen error', err),
    });

  return () => {
    clearTimeout(refreshTimeout);
    sub?.unsubscribe?.();
  };
};

// Unfiltered legacy helper (excludes drafts)
export const fetchSurveyData = (callback, { limit = 300 } = {}) => {
  const query = `
    *[!(_id in path('drafts.**')) && _type == "userResponseV2"]
      | order(coalesce(submittedAt, _createdAt) desc)[0...$limit]{
        _id, section,
        question1, question2, question3, question4, question5,
        submittedAt
      }
  `;

  const pump = (rows) =>
    callback(rows.map((r) => ({ ...r, weights: normalizeAnswers(r) })));

  let refreshTimeout;
  let sub;

  liveClient
    .fetch(query, { limit })
    .then(pump)
    .catch((err) => console.error('[sanityAPI] legacy initial fetch error', err));

  sub = cdnClient
    .listen(query, { limit }, { visibility: 'query' })
    .subscribe({
      next: () => {
        clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(() => {
          liveClient
            .fetch(query, { limit })
            .then(pump)
            .catch((err) => console.error('[sanityAPI] legacy refresh fetch error', err));
        }, 100);
      },
      error: (err) => console.error('[sanityAPI] legacy listen error', err),
    });

  return () => {
    clearTimeout(refreshTimeout);
    sub?.unsubscribe?.();
  };
};

// ---- Counts subscription: live counts for every section + special groups ----
export const subscribeSectionCounts = ({ onData }) => {
  const query = `
    *[!(_id in path('drafts.**')) && _type == "userResponseV2"]{
      section
    }
  `;

  const pump = (rows) => {
    // rows: [{section: 'animation'}, {section: 'visitor'}, ...]
    const counts = new Map();
    for (const r of rows || []) {
      const key = r?.section || '';
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const bySection = Object.fromEntries(counts);

    const sum = (ids) => ids.reduce((acc, id) => acc + (bySection[id] || 0), 0);

    const visitorCount = bySection['visitor'] || 0;
    const allStudents = sum(STUDENT_IDS);
    const allStaff = sum(STAFF_IDS);
    const allMassArt = sum(NON_VISITOR_MASSART);
    const ALL = rows?.length || 0; // everything including visitors

    onData({
      all: ALL,
      'all-massart': allMassArt,
      'all-students': allStudents,
      'all-staff': allStaff,
      visitor: visitorCount,
      ...bySection,
    });
  };

  let refreshTimeout;
  let sub;

  // initial fetch (live)
  liveClient
    .fetch(query, {})
    .then(pump)
    .catch((err) => console.error('[sanityAPI] counts initial fetch error', err));

  // listen then refresh (cdn + live refresh)
  sub = cdnClient
    .listen(query, {}, { visibility: 'query' })
    .subscribe({
      next: () => {
        clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(() => {
          liveClient
            .fetch(query, {})
            .then(pump)
            .catch((err) => console.error('[sanityAPI] counts refresh fetch error', err));
        }, 100);
      },
      error: (err) => console.error('[sanityAPI] counts listen error', err),
    });

  return () => {
    clearTimeout(refreshTimeout);
    sub?.unsubscribe?.();
  };
};
