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

// --- rounding helpers (3 dp) ---
const round3 = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : undefined);

// normalize to the shape your viz uses (3 dp + weights{})
const normalizeRow = (r) => {
  const q1 = round3(r.q1), q2 = round3(r.q2), q3 = round3(r.q3), q4 = round3(r.q4), q5 = round3(r.q5);
  const avgWeight = round3(r.avgWeight);
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

// -------------------
// Resilience helpers
// -------------------
function makePoller(fn, intervalMs = 6000) {
  let timer = null;
  return {
    enable() { if (!timer) timer = setInterval(fn, intervalMs); },
    disable() { if (timer) { clearInterval(timer); timer = null; } },
  };
}

/**
 * Resilient SSE listener:
 * - uses liveClient.listen (avoids CDN HTTP/3 quirks)
 * - on error/complete: backoff & temporarily enable polling
 */
function resilientListen({ query, params, onPing, onError, poller }) {
  let sub;
  let closed = false;

  let attempt = 0;
  const baseDelay = 1500;
  const maxDelay = 20000;

  const start = () => {
    if (closed) return;
    try {
      sub = liveClient.listen(query, params, { visibility: 'query' }).subscribe({
        next: () => {
          // got a mutation; ensure polling is off and refresh via onPing
          poller?.disable();
          onPing?.();
          attempt = 0; // reset backoff after a successful event
        },
        error: (e) => {
          onError?.(e);
          // turn on polling while we back off
          poller?.enable();
          attempt += 1;
          const delay = Math.min(maxDelay, baseDelay * Math.pow(1.6, attempt));
          setTimeout(() => {
            if (closed) return;
            poller?.disable();
            start();
          }, delay);
        },
        complete: () => {
          // stream closed by server; try reconnect after a short delay
          if (!closed) {
            poller?.enable();
            setTimeout(() => {
              if (closed) return;
              poller?.disable();
              start();
            }, baseDelay);
          }
        },
      });
    } catch (e) {
      onError?.(e);
      poller?.enable();
      setTimeout(() => {
        if (closed) return;
        poller?.disable();
        start();
      }, baseDelay);
    }
  };

  start();

  return () => {
    closed = true;
    try { sub?.unsubscribe?.(); } catch {}
  };
}

// -------------------
// Queries
// -------------------
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

// -------------------
// Public API
// -------------------
export const subscribeSurveyData = ({ section, limit = 300, onData }) => {
  const { query, params } = buildQueryAndParams(section, limit);
  const pump = (rows) => onData(rows.map(normalizeRow));

  // initial fetch
  liveClient.fetch(query, params).then(pump).catch((e) => console.error('[sanityAPI] initial fetch', e));

  // polling fallback while SSE is down
  const poller = makePoller(() => {
    liveClient.fetch(query, params).then(pump).catch((e) => console.error('[sanityAPI] poll fetch', e));
  }, 6000);

  const unsub = resilientListen({
    query,
    params,
    onPing: () => {
      liveClient.fetch(query, params).then(pump).catch((e) => console.error('[sanityAPI] refresh fetch', e));
    },
    onError: (e) => console.error('[sanityAPI] listen error', e?.message || e),
    poller,
  });

  return () => { try { unsub?.(); } catch {} poller.disable(); };
};

export const fetchSurveyData = (callback, { limit = 300 } = {}) => {
  const query = `
    *[!(_id in path('drafts.**')) && _type == "userResponseV3"]
      | order(coalesce(submittedAt, _createdAt) desc)[0...$limit]{ ${PROJECTION} }
  `;
  const pump = (rows) => callback(rows.map(normalizeRow));

  // single-shot + resilient refresh on change
  liveClient.fetch(query, { limit }).then(pump).catch((e) => console.error('[sanityAPI] initial fetch', e));

  const poller = makePoller(() => {
    liveClient.fetch(query, { limit }).then(pump).catch((e) => console.error('[sanityAPI] poll fetch', e));
  }, 6000);

  const unsub = resilientListen({
    query,
    params: { limit },
    onPing: () => {
      liveClient.fetch(query, { limit }).then(pump).catch((e) => console.error('[sanityAPI] refresh fetch', e));
    },
    onError: (e) => console.error('[sanityAPI] listen error', e?.message || e),
    poller,
  });

  return () => { try { unsub?.(); } catch {} poller.disable(); };
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

  liveClient.fetch(query, {}).then(pump).catch((e) => console.error('[sanityAPI] counts initial', e));

  const poller = makePoller(() => {
    liveClient.fetch(query, {}).then(pump).catch((e) => console.error('[sanityAPI] counts poll', e));
  }, 7000);

  const unsub = resilientListen({
    query,
    params: {},
    onPing: () => {
      liveClient.fetch(query, {}).then(pump).catch((e) => console.error('[sanityAPI] counts refresh', e));
    },
    onError: (e) => console.error('[sanityAPI] counts listen error', e?.message || e),
    poller,
  });

  return () => { try { unsub?.(); } catch {} poller.disable(); };
};

export { STUDENT_IDS, STAFF_IDS, NON_VISITOR_MASSART };
