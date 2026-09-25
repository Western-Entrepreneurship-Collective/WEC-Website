// All editorial copy and destinations live here. No prototype facts are carried over.
import { parseEmailRule, parseGoogleForm } from "@/lib/googleForm";

function officialDestination(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export const destinations = {
  join: officialDestination(process.env.NEXT_PUBLIC_WEC_JOIN_URL),
  events: officialDestination(process.env.NEXT_PUBLIC_WEC_EVENTS_URL),
};

// ⛔ THE CONTACT ADDRESS HAS NO DEFAULT, AND THAT IS THE WHOLE POINT.
//
// Both WEC sites carried `hello@wecollective.ca` as the club's address.
// Checked on 2026-09-13: that domain is NOT the club's. It is PARKED AT
// GODADDY by a third party, and it has live MX records, so mail addressed to
// it does not obviously bounce. Every signup would have handed a student's
// name and email to a stranger, and the student would have believed they had
// applied.
//
// So there is no fallback value here on purpose. If nobody has set an address
// the club actually controls, the signup form does not render at all and the
// existing honest dialog is shown instead. A form that collects nothing is bad;
// a form that quietly posts people's details to a domain squatter is worse.
export const contactEmail = ((): string | null => {
  const value = process.env.NEXT_PUBLIC_WEC_CONTACT_EMAIL?.trim();
  if (!value) return null;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? value : null;
})();

// The club's Google Form, from its pre-filled link. See src/lib/googleForm.ts
// and docs/GOOGLE-FORM.md. Not set means the sign up form falls back to email.
export const googleForm = parseGoogleForm(process.env.NEXT_PUBLIC_WEC_GOOGLE_FORM_URL);
// "western" (default): uwo.ca, *.uwo.ca, ivey.ca, *.ivey.ca. "any": any email.
export const emailRule = parseEmailRule(process.env.NEXT_PUBLIC_WEC_EMAIL_RULE);

// The club's Slack, shown on the screen a new member lands on after joining.
//
// Same rule as contactEmail above: there is no fallback value. Not set means
// the Slack step simply is not shown, and the rest of the screen is unchanged.
// A "Join the Slack" button that 404s on somebody's first thirty seconds with
// the club is worse than no button, and this is the one moment where a new
// member is actually paying attention.
//
// It must be an https link to a Slack address, so a typo or a pasted note
// cannot turn into a link out to anywhere at all.
export const slackUrl = ((): string | null => {
  const value = process.env.NEXT_PUBLIC_WEC_SLACK_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    return host === "slack.com" || host.endsWith(".slack.com") ? value : null;
  } catch {
    return null;
  }
})();

export const siteContent = {
  name: "Western Entrepreneurship Collective",
  positioning: "By Founders, for Founders.",
  navigation: [
    { label: "About", href: "#about" },
    { label: "Experience", href: "#experience" },
    { label: "Pillars", href: "#pillars" },
    { label: "Ecosystem", href: "#ecosystem" },
  ],
  hero: {
    index: "The door is open",
    location: "Western University · London, ON",
    footer: "There’s a place for you here.",
  },
  about: {
    label: "About WEC",
    headline: ["An idea is a start.", "People make it real."],
    description: "Western Entrepreneurship Collective (WEC) brings ambitious students together to explore entrepreneurship, take action, and build meaningful ventures.",
    founders: "Built by student founders. For the people already building, and the ones who haven’t started yet.",
    evidence: "$120K+",
    evidenceLabel: "In grants & investment",
    evidenceNote: "Collectively secured by the student founders behind WEC.",
    prompts: ["What’s one problem you keep noticing?", "What would you try if it didn’t have to be perfect?", "What’s the thing you could use a second brain on?"],
  },
  experience: {
    label: "The WEC Experience",
    programs: [
      { number: "01", name: "Venture Studio", description: "Put your idea to work.", overview: "Recurring venture-building and accountability sessions. Share progress, work through challenges, and find your next step with other builders.", note: "Bring what you’re working on.", href: "#venture-studio" },
      { number: "02", name: "Founder Labs", description: "Make the call. Then make it better.", overview: "Interactive workshops built around real entrepreneurial decisions. Work on your venture or a structured scenario, and leave with something you can use.", note: "Learn through the work.", href: "#founder-labs" },
      { number: "03", name: "From-The-Field", description: "Learn from the people living it.", overview: "Panels, fireside chats, and honest conversations with founders, investors, and alumni about the reality of building a company.", note: "Experience, without the filter.", href: "#from-the-field" },
    ],
  },
  studio: {
    label: "Venture Studio",
    headline: ["Bring the messy", "middle."],
    description: "The backbone of WEC. Recurring venture-building and accountability sessions where ideas become deliberate action.",
    details: "Share updates and hardships. Work through problems. Trade feedback and strengths with members, executives, guests, and alumni.",
    note: "You don’t need a finished pitch.\nYou need a place to start working.",
    sheetLabel: "A working draft",
    crossed: "Figure it all out.",
    correction: "Find the next step.",
    prompts: ["What are you building?", "Where are you stuck?", "What will you try next?"],
    sheetFooter: "Progress happens in the doing.",
    stages: ["Bring an idea", "Work it through", "Leave with a next step"],
  },
  labs: {
    label: "Founder Labs",
    headline: ["A decision.", "Not a hypothetical."],
    description: "Interactive workshops on real entrepreneurial decisions. Work on your venture or a structured scenario.",
    annotation: "Same idea. Better version.",
    focusHeading: "Something you can put into practice.",
    outputs: "Leave with a positioning statement, go-to-market approach, or clearer venture communication, refined through feedback and iteration.",
    topics: ["Customer discovery", "Validation", "Positioning", "Go-to-market", "Business-model trade-offs", "Venture communication"],
  },
  field: {
    label: "From-The-Field series",
    headline: ["Beyond the", "classroom."],
    description: "The decisions, risks, failures, and unexpected opportunities that don’t fit neatly into a slide deck.",
    details: "Panels, fireside chats, and honest conversations with people who know what building a company actually feels like.",
    people: ["Founders", "Investors", "Alumni"],
    personNotes: [
      "Hear how an idea became a venture, including the turns nobody planned for. Bring your questions about starting, stumbling, and moving forward.",
      "Explore what investors look for beyond the pitch deck. Get a clearer view of the questions, trade-offs, and decisions behind a potential investment.",
      "Meet people whose entrepreneurial journeys started where you are now. Learn what they tried, what surprised them, and what they would do differently.",
    ],
    annotation: "Experience, without the filter.",
  },
  community: {
    label: "Founder showcases & community",
    headline: ["Good things happen", "between people."],
    description: "Meet someone building something completely different. Trade ideas. Stay for the conversation. Building a venture also means finding your people.",
    events: ["Pitch nights", "Founder showcases", "Co-founder events", "Dinners", "Networking"],
    eventNotes: ["Say it out loud. Get a fresh perspective on what you’re building.", "See what other founders are working on. Share what you’ve learned along the way.", "Different strengths. Shared curiosity. A conversation could be the start of something.", "Pull up a chair. Keep the conversation going beyond the work.", "Make an introduction. Ask a question. Find a reason to stay in touch."],
    centre: ["Better,", "together."],
    note: "Different ideas. Shared momentum.",
  },
  pillars: {
    label: "Our Five Pillars",
    introduction: "What holds us together.",
    items: [
      { name: "Build", subtitle: "Take action.", description: "Entrepreneurship is learned by doing. Recurring resources, accountability, and peer support give you a low-pressure place to turn ideas into action.", note: "An idea becomes something you can act on." },
      { name: "Discover", subtitle: "Learn from reality.", description: "Meet founders, investors, and professionals. Learn from the decisions, risks, failures, trade-offs, and opportunities behind their experience.", note: "There’s more to the story." },
      { name: "Connect", subtitle: "Build your network.", description: "Make meaningful connections with student founders, alumni, entrepreneurs, and the broader Morrissette ecosystem.", note: "The right conversation can change your direction." },
      { name: "Explore", subtitle: "Find your path.", description: "You don’t need to be a founder. Develop skills, meet possible co-founders, test an idea, and find your way through Western’s entrepreneurial ecosystem.", note: "Curiosity is a good place to start." },
      { name: "Contribute", subtitle: "Help each other grow.", description: "Share feedback, introductions, skills, and support. Your participation helps someone else move forward, and makes the collective stronger.", note: "What you bring makes a difference." },
    ],
  },
  audience: {
    label: "Who WEC is for",
    headline: ["Every starting point.", "A seat at the table."],
    intro: "You don’t need a finished idea. Choose the seat that sounds like you.",
    statements: [
      { quote: "I’m already building.", answer: "Bring your venture, your progress, and your sticking points to Venture Studio.", link: "Find your next step", href: "#venture-studio" },
      { quote: "I have an idea.", answer: "Turn a question into a decision, get feedback, and try a next version in Founder Labs.", link: "Put it to the test", href: "#founder-labs" },
      { quote: "I don’t know where to start.", answer: "Start with curiosity. Meet builders and discover what entrepreneurship can look like.", link: "Explore the experience", href: "#experience" },
      { quote: "I want to meet a co-founder.", answer: "Find collaborators through co-founder events, shared work, and conversations that keep going.", link: "Meet your people", href: "#community" },
      { quote: "I’m looking for a mentor.", answer: "Find your way into Western’s wider network of founders, alumni, and mentors.", link: "See the bigger picture", href: "#ecosystem" },
      { quote: "I want hands-on experience.", answer: "Work through real entrepreneurial decisions and create something you can learn from.", link: "Step into Founder Labs", href: "#founder-labs" },
    ],
    correction: "The curious, too.",
  },
  ecosystem: {
    label: "The Morrissette ecosystem",
    headline: ["Your entryway to", "Morrissette."],
    description: "WEC is one part of Western’s entrepreneurship ecosystem. With strong ties to the Morrissette Institute, we help students enter, navigate, and engage with what’s around them.",
    note: "Start with WEC. Get connected to Morrissette.",
    nodes: ["Competitions", "Funding programs", "Venture development", "Entrepreneurial programming", "Alumni", "Mentors"],
    centre: "Morrissette Institute",
    world: "Western’s entrepreneurship ecosystem",
  },
  join: {
    label: "Join WEC",
    headline: ["Your next idea", "starts with you."],
    description: "Your first version belongs here. Find the people, the space, and the experiences to keep it moving.",
    primary: "Join WEC",
    secondary: "Attend an event",
    annotation: "The next part is yours.",
    unavailable: {
      join: { title: "There’s a place for you here.", description: "Membership details aren’t available on the website yet. Come back here for the official way to join WEC." },
      events: { title: "The next conversation starts here.", description: "Event dates and registration details aren’t available on the website yet. Explore the WEC experience to see what’s in store." },
    },
  },
  footer: { location: "Western University · London, Ontario", note: "By Founders, for Founders.", top: "Back to the first mark" },
};
