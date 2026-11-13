const toSafeCount = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
};

export const computeProgress = (completedCount, totalLessons) => {
  const completed = toSafeCount(completedCount);
  const total = toSafeCount(totalLessons);

  if (total === 0) {
    return { percent: 0, isComplete: false };
  }

  const ratio = Math.min(completed, total) / total;
  const percent = Math.max(0, Math.min(100, Math.floor(ratio * 100)));
  const isComplete = completed >= total;

  return { percent, isComplete };
};

export default computeProgress;
