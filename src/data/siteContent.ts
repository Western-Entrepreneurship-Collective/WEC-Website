// All editorial copy and destinations live here. No prototype facts are carried over.
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
    notice: { label: "Pinned for you", title: "You don’t need a finished idea.", body: "Bring a question. Bring a rough draft. Bring yourself." },
    invitationLabel: "On the other side",
    note: "People to build with.",
    invitation: "Your next step starts with a conversation.",
    cta: "Step inside",
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
    ecosystem: "Rooted in Western’s entrepreneurship ecosystem, with strong ties to the Morrissette Institute.",
    prompts: ["What’s one problem you keep noticing?", "What would you try if it didn’t have to be perfect?", "What’s the thing you could use a second brain on?"],
  },
  experience: {
    label: "The WEC experience",
    headline: ["Less watching.", "More making."],
    description: "Bring the thing you’re stuck on. Find a fresh perspective. Leave with something to try. Here’s where that happens.",
    note: "Bring what you’re working on.\nOr just bring your curiosity.",
    programs: [
      { number: "01", name: "Venture Studio", description: "Put your idea to work.", overview: "Recurring venture-building and accountability sessions. Share progress, work through challenges, and find your next step with other builders.", note: "Bring what you’re working on.", href: "#venture-studio" },
      { number: "02", name: "Founder Labs", description: "Make the call. Then make it better.", overview: "Interactive workshops built around real entrepreneurial decisions. Work on your venture or a structured scenario, and leave with something you can use.", note: "Learn through the work.", href: "#founder-labs" },
      { number: "03", name: "From-The-Field", description: "Learn from the people living it.", overview: "Panels, fireside chats, and honest conversations with founders, operators, investors, alumni, and professionals about the reality of building a company.", note: "Experience, without the filter.", href: "#from-the-field" },
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
    people: ["Founders", "Operators", "Investors", "Alumni", "Professionals"],
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
    label: "Our five pillars",
    introduction: "What holds us together.",
    headline: ["Five foundations.", "One collective."],
    description: "These are the principles WEC is built on. They shape our community, our programs, and the way we show up for each other.",
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
    headline: ["Different starting points.", "One collective."],
    intro: "There’s no single way to arrive here. Find a starting point that sounds like you.",
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
    headline: ["Your way into", "a bigger world."],
    description: "WEC is one part of Western’s entrepreneurship ecosystem. With strong ties to the Morrissette Institute, we help students enter, navigate, and engage with what’s around them.",
    note: "A starting point. And more paths forward.",
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
