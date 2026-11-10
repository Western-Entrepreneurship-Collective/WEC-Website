/**
 * Reviewing First Year Rep applications in WEC OS
 * (supabase/migrations/20261111000100_rep_reviews.sql).
 *
 * Four areas, 1 to 5 each, out of 20, plus a one-line note. The order here is
 * the order of hiring.rep_scores.areas.
 */
export const REVIEW_AREAS = ["Gets things done", "Reliability", "Startup curiosity", "Fit for the role"] as const;
export const SHORTLIST_SIZE = 10;
export const NOTE_MAX = 300;

export type RepListRow = {
  id: string; name: string; year: string; program: string; submitted_at: string;
  my_total: number | null; average: number | null; scored_by: number | null; shortlisted: boolean;
};
export type RepList = { shortlist_count: number; rows: RepListRow[] };

export type RepApplicationFull = {
  id: string; name: string; western_email: string; program: string; year: string; residence: string; social: string;
  why: string; company: string; event_idea: string; show_up: string; reach: string; link: string;
  hours: string; dates: string; exec_next: string; anything: string; heard: string; submitted_at: string;
};
export type RepReview = {
  application: RepApplicationFull;
  mine: { areas: number[]; total: number; note: string } | null;
  others: { name: string; total: number; note: string }[];
  shortlisted: boolean;
  shortlist_count: number;
  next_id: string | null;
};
