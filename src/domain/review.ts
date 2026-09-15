import { createEmptyCard, fsrs, Rating, type Card } from "ts-fsrs";
export const FSRS_CONFIG_VERSION = "fluentquest-fsrs-v1-retention-0.9";
const scheduler = fsrs({
  request_retention: 0.9,
  enable_fuzz: false,
  enable_short_term: true,
});
export function initialCard(now = new Date()) {
  return createEmptyCard(now);
}
export function restoreCard(value: Card): Card {
  return {
    ...value,
    due: new Date(value.due),
    last_review: value.last_review ? new Date(value.last_review) : undefined,
  };
}
export function scheduleCard(value: Card, rating: number, now = new Date()) {
  if (![1, 2, 3, 4].includes(rating))
    throw new Error("Nota de revisão inválida.");
  return scheduler.next(
    restoreCard(value),
    now,
    rating as Rating.Again | Rating.Hard | Rating.Good | Rating.Easy,
  );
}
export function xpLevel(xp: number) {
  return Math.floor(Math.pow(Math.max(0, xp) / 100, 1 / 1.4)) + 1;
}
export function nextLevelXp(level: number) {
  return Math.round(100 * Math.pow(level, 1.4));
}
