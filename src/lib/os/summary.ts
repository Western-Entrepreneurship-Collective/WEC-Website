/** The three sections of a weekly summary, in the order they're written and read. */
export const SUMMARY_SECTIONS = [
  {
    key: "events_meetings", title: "Events and meetings",
    questions: [
      "Which events did we hold, and how did they go?",
      "How many people attended each one?",
      "Which meetings did we have, and what was decided?",
      "What events and meetings are coming up next?",
    ],
  },
  {
    key: "team_progress", title: "Team progress",
    questions: [
      "What is each team working on right now?",
      "What did teams finish this week?",
      "What do we need to catch up on or focus on as a team?",
    ],
  },
  {
    key: "results_feedback", title: "Results and feedback",
    questions: [
      "What results did we get this week?",
      "What feedback did we receive from members?",
      "What should we change or do differently?",
    ],
  },
] as const;

export type SummaryText = Record<(typeof SUMMARY_SECTIONS)[number]["key"], string>;

export const summaryWeek = (weekStart: string) =>
  new Intl.DateTimeFormat("en-CA", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${weekStart}T00:00:00Z`));

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Blank lines separate paragraphs, the way they read in the box they were typed in. */
export const paragraphs = (value: string) => value.trim().split(/\n\s*\n/);

/** What gets copied into someone's own email. Inline styles, since email apps drop the rest. */
export function summaryEmail(weekStart: string, text: SummaryText) {
  const week = `Week of ${summaryWeek(weekStart)}`;
  const font = "font-family: Arial, Helvetica, sans-serif; color: #1E1626;";
  const html = [
    `<h2 style="${font} font-size: 22px; margin: 0 0 2px; color: #582c83;">Weekly Summary</h2>`,
    `<p style="${font} font-size: 14px; margin: 0 0 18px; color: #59545f;">${week}</p>`,
    ...SUMMARY_SECTIONS.flatMap(section => [
      `<h3 style="${font} font-size: 16px; margin: 18px 0 4px; color: #034638;">${section.title}</h3>`,
      ...paragraphs(text[section.key]).map(p => `<p style="${font} font-size: 14px; line-height: 1.5; margin: 0 0 10px;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`),
    ]),
  ].join("");
  const plain = [`Weekly Summary`, week, ...SUMMARY_SECTIONS.flatMap(section => ["", section.title, text[section.key].trim()])].join("\n");
  return { subject: `WEC Weekly Summary: ${week}`, html, plain };
}
