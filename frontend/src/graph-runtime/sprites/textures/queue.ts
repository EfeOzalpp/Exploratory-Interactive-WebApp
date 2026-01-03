// graph-runtime/sprites/textures/queue.ts
type Job = { run: () => void; prio: number; gen: number };

let Q: Job[] = [];
let pumping = false;
let paused = false;
let inflight = 0;

let GEN = 0;

const RIC =
  typeof requestIdleCallback === 'function' ? requestIdleCallback : null;

function step(deadline?: IdleDeadline) {
  if (paused) { pumping = false; return; }

  let done = 0;
  const hasTime = () => !deadline || deadline.timeRemaining() > 6;

  while (Q.length && (done < 3 || hasTime())) {
    const job = Q.shift()!;
    if (job.gen !== GEN) continue;

    inflight++;
    try { job.run(); } catch { }
    finally { inflight--; }
    done++;
  }

  if (Q.length && !paused) {
    (RIC ? RIC : (f => setTimeout(f as any, 16)))(step as any);
  } else {
    pumping = false;
  }
}

export function enqueueTexture(run: () => void, prio = 0) {
  const gen = GEN;
  Q.push({ run, prio, gen });
  Q.sort((a, b) => b.prio - a.prio);
  if (!pumping && !paused) {
    pumping = true;
    (RIC ? RIC : (f => setTimeout(f as any, 16)))(step as any);
  }
}

export function getQueueCounts() {
  return { pending: Q.length, inflight, paused };
}

export function pauseQueue() { paused = true; }

export function resumeQueue() {
  if (!paused) return;
  paused = false;
  if (Q.length && !pumping) {
    pumping = true;
    (RIC ? RIC : (f => setTimeout(f as any, 16)))(step as any);
  }
}

export function cancelAllJobs() {
  Q = [];
  pumping = false;
}

export function resetQueue() {
  cancelAllJobs();
  paused = false;
}

export function bumpGeneration() {
  GEN++;
  cancelAllJobs();
}

export function getGeneration() { return GEN; }

if (typeof window !== 'undefined') {
  const w = window as any;
  w.__GP_GET_QUEUE_COUNTS = getQueueCounts;
  w.__GP_RESET_QUEUE = resetQueue;
  w.__GP_PAUSE_QUEUE = pauseQueue;
  w.__GP_RESUME_QUEUE = resumeQueue;
  w.__GP_BUMP_GEN = bumpGeneration;
}
