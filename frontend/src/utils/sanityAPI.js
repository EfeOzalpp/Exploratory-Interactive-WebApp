// utils/sanityAPI.js
// Requires utils/sanityClient.js to export:
//   export const cdnClient = createClient({ useCdn: true,  ... });
//   export const liveClient = createClient({ useCdn: false, ... });
import { cdnClient, liveClient } from './sanityClient';

// --- scoring map (unchanged) ---
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
    normalized[q] = (answerRewiring[q]?.[ans] ?? 0.5);
  }
  return normalized;
};

/**
 * Live, section-filtered subscription.
 * - Initial & refresh fetches use liveClient (no CDN) → no “two writes to see one” lag.
 * - listen() uses cdnClient (listen isn’t cached anyway).
 */
export const subscribeSurveyData = ({ section, limit = 300, onData }) => {
  if (!section) return () => {}; // no-op until a section is selected

  const query = `
    *[_type == "userResponseV2" && section == $section]
      | order(coalesce(submittedAt, _createdAt) desc)[0...$limit]{
        _id, section,
        question1, question2, question3, question4, question5,
        submittedAt
      }
  `;

  const pump = (rows) =>
    onData(rows.map((r) => ({ ...r, weights: normalizeAnswers(r) })));

  let refreshTimeout;
  let sub;

  // Initial fetch: bypass CDN
  liveClient
    .fetch(query, { section, limit })
    .then(pump)
    .catch((err) => console.error('[sanityAPI] initial fetch error', err));

  // Listen (real-time), then refresh with live fetch
  sub = cdnClient
    .listen(query, { section, limit }, { visibility: 'query' })
    .subscribe({
      next: () => {
        clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(() => {
          liveClient
            .fetch(query, { section, limit })
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

/**
 * Legacy helper (unfiltered).
 * Uses liveClient for freshness so first write appears immediately.
 */
export const fetchSurveyData = (callback, { limit = 300 } = {}) => {
  const query = `
    *[_type == "userResponseV2"]
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

  // Initial: live (no CDN)
  liveClient
    .fetch(query, { limit })
    .then(pump)
    .catch((err) => console.error('[sanityAPI] legacy initial fetch error', err));

  // Listen + live refresh
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
