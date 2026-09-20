# Connecting the exec applications page to a Google Form

The executive applications page at **`/apply/executives`** is built and works.
It has nowhere to send an application until the steps below are done, so until
then it says, in plain words, that applications are not open. It never pretends
to submit.

`/apply` is a **chooser** with one door per application: `/apply/member` (the
membership sign up) and `/apply/executives` (this one). Every "Join WEC" call to
action on the site points straight at `/apply/member`, so nobody who has already
chosen is made to choose again.

⛔ **`/apply/member` and `/api/join` are not this page.** They belong to the
member sign up (docs/GOOGLE-FORM.md). The exec page, its API route and its
settings are separate files and separate environment variables, and nothing here
reads or changes the sign up.

Everything an applicant types goes into ONE place: a Google Form, which writes it
into that Form's linked Google Sheet. **The Sheet is the only store.** There is no
database, no admin dashboard and no login on this site, by design.

| File | What it is |
|---|---|
| `src/lib/execApplications.ts` | every question, word limit, role and check, plus the pre-filled-link reader. Read by the page AND the route, so they cannot disagree |
| `src/lib/execApplicationsServer.ts` | server only: allowed hosts, the Form check, its 5 minute cache, the setup key, the rate limit |
| `src/app/api/exec-applications/route.ts` | `GET` (is it open?) and `POST` (send one application to Google) |
| `src/app/apply/executives/page.tsx` | the page shell: the WEC mark and one line |
| `src/app/apply/page.tsx` | the chooser: member or exec. Reads `WEC_APPLY_GOOGLE_FORM_URL` at request time so a closed application says so |
| `src/lib/applyRoutes.ts` | the four addresses, and nothing else, so a component needing a path does not import all twelve roles |
| `src/components/sections/ExecApplicationsForm.tsx` | the five stages |
| `src/styles/exec-applications.css` | its styles, all scoped to `.exec-` classes, tokens from `tokens.css` |
| `docs/make-exec-applications-form.gs` | builds the Form and its Sheet in one run (optional, section 1) |
| `tests/exec-applications-api.spec.ts` | 21 server tests against a stand-in for Google |
| `tests/exec-applications.spec.ts` | browser tests: a full application at 375px and at desktop |

About 25 minutes, once.

---

## 1. Make the Form

**Fastest:** paste `docs/make-exec-applications-form.gs` into script.google.com
on the club account and press Run. It builds the Form below, links a Sheet, and
prints the pre-filled link. Skip to step 3. Or build it by hand:

On the **club's** Google account, not a personal one. Create a blank Form called
`WEC Executive Applications 2026-27`.

Add these questions **in this order**. The order is not enforced by anything, but
it is the order the Sheet's columns will appear in, so it is worth keeping.

| # | Question title | Type | Required | Notes |
|---|---|---|---|---|
| 1 | Full name | Short answer | yes | |
| 2 | Western email | Short answer | yes | |
| 3 | Personal email | Short answer | **no** | |
| 4 | Phone number | Short answer | **no** | |
| 5 | Year of study | **Multiple choice** | yes | options exactly: `1st Year`, `2nd Year`, `3rd Year`, `4th Year`, `Graduate`, `Other` |
| 6 | Program / faculty | Short answer | yes | |
| 7 | LinkedIn | Short answer | **no** | |
| 8 | Portfolio or website | Short answer | **no** | |
| 9 | Resume link | Short answer | **no** | a link, not a file. See "Why the resume is a link" below |
| 10 | Short introduction | Paragraph | yes | |
| 11 | General question 1 | Paragraph | yes | |
| 12 | General question 2 | Paragraph | yes | |
| 13 | Position applied for | **Multiple choice** | yes | options exactly the twelve titles listed in section 6 |
| 14 | Role question 1 | Paragraph | **no** | |
| 15 | Role question 2 | Paragraph | **no** | |
| 16 | Role question 3 | Paragraph | **no** | |
| 17 | Role question 4 | Paragraph | **no** | only some roles have a fourth |
| 18 | Role portfolio or video link | Short answer | **no** | only Director of Video asks for it |

**Why only five "role question" slots for twelve roles.** Twelve roles with three
or four questions each is over forty questions, and a Sheet with forty mostly
empty columns. Instead every role's answers go into the same five slots, and
**each answer arrives with its own question written above it**, so a row of the
Sheet reads on its own. Column 13 says which role it was.

⛔ **Anything marked "no" above must actually be optional in the Form.** Google
refuses a submission if a question is required and the answer is not there, and
its refusal says nothing about why. That happens two ways, and the setup check
in section 4 names both by question title:

- The site fills **nothing** into the question, so **every** application is
  refused. Reported as a **problem**, and the page closes: letting people type
  an application that cannot arrive is worse than saying it is not open.
- The site fills it **only when the applicant answered it**, so applications
  that skip it are refused and the rest arrive fine. Reported as a **warning**,
  and the page **stays open**. Closing it would stop the applicants who would
  have answered the question, to protect the ones who would not.

The distinction is not theoretical. Treating the second case as a problem took
the live applications page down for everyone on 20 September 2026.

### Settings that must be like this

Open **Settings** in the Form:

- **Responses → Collect email addresses: Do not collect.** The site already asks
  for two email addresses.
- **Restrict to users in your organisation / Require sign-in: OFF.** A Form that
  asks for a sign-in answers the site with a redirect to Google's login page, and
  no application ever arrives.
- **Limit to 1 response: OFF.** That also forces a sign-in.
- Do not add Google-side response validation. The site does the checking.
- If a multiple-choice option is renamed, Google refuses that answer. Keep the
  year and position options **exactly** as written.

In **Responses**, press **Link to Sheets** to create the Sheet.

---

## 2. Get the pre-filled link

Form editor → **⋮ menu → Get pre-filled link**. Type these exact words as the
answers. They are placeholders: they are how the site finds each question's
hidden id, and they are never submitted.

| Question | Type this |
|---|---|
| Full name | `NAME` |
| Western email | `WESTERNEMAIL` |
| Personal email | `PERSONALEMAIL` |
| Phone number | `PHONE` |
| Year of study | pick `1st Year` |
| Program / faculty | `PROGRAM` |
| LinkedIn | `LINKEDIN` |
| Portfolio or website | `PORTFOLIO` |
| Resume link | `RESUME` |
| Short introduction | `INTRO` |
| General question 1 | `GENERAL1` |
| General question 2 | `GENERAL2` |
| Position applied for | pick `VP Content` |
| Role question 1 | `ROLE1` |
| Role question 2 | `ROLE2` |
| Role question 3 | `ROLE3` |
| Role question 4 | `ROLE4` |
| Role portfolio or video link | `ROLELINK` |

Press **Get link**, then **Copy link**. It looks like
`https://docs.google.com/forms/d/e/1FAIpQL.../viewform?usp=pp_url&entry.123=NAME&...`

---

## 3. Put it in the site

Vercel → the project → **Settings → Environment Variables** (Production, and
Preview if you want to test there first):

```
WEC_APPLY_GOOGLE_FORM_URL = <the link from step 2>
WEC_SETUP_CHECK_KEY       = <any long random string>   (optional, recommended)
```

Then **redeploy**. Both are also listed, with comments, in `.env.example`.

- `WEC_APPLY_GOOGLE_FORM_URL` is **server side only**. It has no `NEXT_PUBLIC_`
  prefix, so it is never built into the page or sent to a browser, and nobody can
  find the Form and post to it directly.
- The link must be **`https://docs.google.com/...`**. An `http://` link, or any
  other host, is refused and the page stays closed.
- `WEC_GOOGLE_FORM_TEST_HOST` exists only so the tests can point the route at a
  local stand-in for Google. **It is ignored whenever `VERCEL_ENV` is
  `production`**, so even if it is set there by mistake, nothing but
  `docs.google.com` can ever receive an application. Do not set it on Vercel.
- `WEC_SETUP_CHECK_KEY` is the password for the detailed setup check in section 4.

Locally: put the link in `.env.local`, then `npm run build && npm run start`.

---

## 4. Check the setup before telling anyone

Open **`<the site>/api/exec-applications?detail=1&key=<WEC_SETUP_CHECK_KEY>`**
in a browser. It reads the Form fresh, the way a visitor sees it, and answers in
plain words:

- `{"connected":true,"ready":true,"problems":[]}` means everything lines up.
- Otherwise `problems` lists exactly what to fix, for example
  *"The 'Year of study' question's options must be exactly: 1st Year, 2nd Year,
  ... Missing: Graduate, Other. Rename or remove: Grad."*

**Who can see the detail:**

| `WEC_SETUP_CHECK_KEY` | Where | `?detail=1` |
|---|---|---|
| set | anywhere | only with `&key=` equal to it; otherwise 403 |
| unset | preview deployments and locally | works without a key |
| unset | production (`VERCEL_ENV=production`) | always 403 |

**The public answer** (`/api/exec-applications` with no `detail`) is only
`{"connected":…,"ready":…}`: no question titles, no problems. The page opens only
when **both** are true. It is cached for **5 minutes** per server instance, so
page views do not each fetch the Form from Google; after fixing the Form, run the
detailed check once, which refreshes it immediately.

Then apply once yourself, all the way through, and check the row lands in the
Sheet. Delete the test row.

⛔ **If a question is edited, renamed or deleted in the Form, redo steps 2 and 3.**
Editing a question can change its id and the site would quietly stop filling it
in. The check in this section is what catches that.

---

## 5. Why the resume is a link and not an upload

A file upload into a Google Form **forces every applicant to sign in to a Google
account** before the Form will accept anything at all, which breaks the whole
path above. Uploading to Drive directly instead needs a Google Cloud service
account and a key that the club does not have yet.

So the page asks for a **link**: a Drive or Dropbox file set to "anyone with the
link", a LinkedIn profile, or the applicant's own site. It is required.

When the club has Drive credentials, this becomes a real upload and only two
things change: the `resume` field in `src/lib/execApplications.ts` and question 9
in the Form.

---

## 6. Every question the page asks, in order

This is what the applicant sees. The word limits are enforced live as they type
and again on the server.

### Stage 1, About you — "Let's get to know you." (the page opens here; there is no landing page)

| Question | Type | Required |
|---|---|---|
| Full name | short text | yes |
| Western email | email, must be `@uwo.ca`, `@*.uwo.ca` or `@ivey.ca` | yes |
| Personal email | email, any | yes |
| Phone number | phone, 10 to 15 digits, checked only if filled in | no |
| Year of study | one of: 1st Year, 2nd Year, 3rd Year, 4th Year, Graduate, Other | yes |
| Program / faculty | short text | yes |
| LinkedIn | link | no |
| Portfolio or website | link | no |
| Resume link | link | yes |
| Short introduction: "Give us a quick introduction. Who are you, and what are you currently building, exploring, or interested in?" | long, **150 words** | yes |

### Stage 2, General questions — "Before we talk roles..."

| Question | Limit |
|---|---|
| Pitch yourself as if you were a startup. What makes you different, what problem do you solve, and why should WEC want you on the team? | 250 words |
| What are you most proud of? | 250 words |

### Stage 3, Position — "Where do you want to build?"

One position only. Clicking a card goes straight to that role's questions (there is no Continue on this stage). Changing to a different card later asks first if role answers are already written, then clears them. The twelve options, exactly as they must appear in the Form:

**Vice Presidents:** VP Content · VP Communications · VP Community

**Directors & Coordinators:** Director of Admin · Event Experience Coordinator ·
Director of Logistics · Director of Financial Operations · Speaker Acquisition
Coordinator · Outreach Coordinator · Director of Video · Email & Newsletter
Coordinator · Director of Engagement

### Stage 4, Role questions — only the chosen role's

**VP Content** — "You'll own what WEC creates and how the world sees us."
1. Why do you want to lead Content for WEC? — 250 words
2. If you were given complete creative freedom, what would you change or add to WEC's content strategy this year? — 250 words
3. Pitch a content series or campaign that could make students want to follow WEC, attend our events, or join the community. — 200 words
4. What is something you have created that you are genuinely proud of? What made it successful? — 150 words

**VP Communications**
1. Why do you want to lead Communications for WEC? — 250 words
2. How would you use communication to increase WEC membership and turn interested students into active members? — 250 words
3. Write an announcement that would make a busy Western student genuinely want to attend a WEC event. — 150 words
4. Tell us about a time you successfully communicated an idea, message, or opportunity and got people to act on it. — 150 words

**VP Community**
1. Why do you want to lead Community for WEC? — 250 words
2. How would you make WEC feel like a real founder community rather than another student club? — 250 words
3. Design one initiative that would help WEC members build meaningful relationships with each other. — 200 words
4. Imagine engagement is strong in September but drops significantly halfway through the year. What would you do? — 200 words

**Director of Admin**
1. Why are you interested in the Director of Admin role? — 150 words
2. Imagine an exec meeting ends with 15 action items across different people. What system would you create to make sure nothing gets forgotten? — 200 words
3. Tell us about a time you had to keep yourself or a team organized while managing multiple responsibilities. — 150 words

**Event Experience Coordinator**
1. Why are you interested in Event Experience? — 150 words
2. Design a WEC event that you would genuinely want to attend. What would the experience look and feel like from arrival to leaving? — 250 words
3. What separates a memorable event from an event that simply delivers information? — 150 words

**Director of Logistics**
1. Why are you interested in Logistics? — 150 words
2. Imagine you arrive 30 minutes before a major event. The room setup is wrong, food hasn't arrived, and the speaker's presentation won't connect to the projector. What do you do first, and why? — 200 words
3. Tell us about a time you had to solve a problem under pressure. — 150 words

**Director of Financial Operations**
1. Why are you interested in Financial Operations? — 150 words
2. WEC has a $5,000 event budget. Three weeks into planning, $4,000 has already been committed. What would you do? — 200 words
3. Tell us about a time you worked with numbers, budgets, spreadsheets, or financial information. — 150 words

**Speaker Acquisition Coordinator**
1. Why are you interested in Speaker Acquisition? — 150 words
2. Choose a founder or entrepreneur you would want to bring to WEC. Who are they, why would students care, and how would you convince them to say yes? — 200 words
3. Write the first outreach message you would send to a founder you've never spoken to. — 150 words

**Outreach Coordinator**
1. Why are you interested in Outreach? — 150 words
2. You have 100 potential students to contact. Walk us through your process from first message to follow-up. — 200 words
3. Write a short message to a Western student who has never heard of WEC that would make them curious enough to learn more. — 100 words

**Director of Video**
1. Why are you interested in Video? — 150 words
2. WEC gives you 60 seconds to make a video that shows Western students why they should join WEC. What would you create? — 200 words
3. What makes a social media video worth watching instead of scrolling past? — 150 words
- A link to your work — optional

**Email & Newsletter Coordinator**
1. Why are you interested in Email & Newsletter? — 150 words
2. Imagine WEC hasn't sent an email in over a month. What would you put in the next newsletter? — 200 words
3. Write a subject line that would make a busy Western student open a WEC email. — 50 words

**Director of Engagement**
1. Why are you interested in Engagement? — 150 words
2. WEC has 300 members, but only 30 consistently show up. What would you do? — 250 words
3. Design one initiative that would help members build genuine relationships with each other. — 150 words

### Stage 5, Review

Every answer, grouped, each group with an Edit button that goes back without
losing anything. A required tick box: "I confirm that the information in this
application is accurate." Then Submit.

---

## 7. To change a question

Edit `src/lib/execApplications.ts`. It is the only file with the questions in it,
and both the page and the route read it, so they can never disagree. Then update
the Google Form to match and redo steps 2 and 3.

Then run:

```sh
npm run typecheck && npm run lint && npm run build
npx playwright test tests/exec-applications-api.spec.ts tests/exec-applications.spec.ts --project=chromium --project=mobile-chromium
```

The server tests prove, against a stand-in for Google, that a full application
lands with every answer in the right place, that a refusal or a sign-in redirect
is reported as a failure rather than a success, and that only the chosen role's
answers are sent. The browser tests fill a whole application in at 375px and at
desktop width. The stand-in is `tests/support/fakeGoogle.ts`;
`playwright.config.ts` points the test server at it, so a test can never reach a
real Form even if `.env.local` holds a real link.

---

## 8. What the site does not keep

Nothing. No database, no admin page, no login, no file storage, and nothing in
the browser's storage. Answers live in the page while the tab is open and are
posted once, from the server, to the Form. They are never written to a log: when
Google refuses, the log records the status only, never what anybody wrote.

**Applicants should finish in one sitting.** The page says so before they start.

The contact address in the "that didn't go through" messages is
`NEXT_PUBLIC_WEC_CONTACT_EMAIL`, the same setting the sign up uses. With it unset
the messages simply leave the address out. ⛔ There is deliberately no fallback
address: see the note on `contactEmail` in `src/data/siteContent.ts`.

---

## 9. Changing the URL

The three application addresses live in `src/lib/applyRoutes.ts`:

| Constant | Path | Folder |
|---|---|---|
| `APPLY_PATH` | `/apply` | `src/app/apply/` |
| `MEMBER_APPLY_PATH` | `/apply/member` | `src/app/apply/member/` |
| `EXEC_APPLICATIONS_PATH` | `/apply/executives` | `src/app/apply/executives/` |

In the App Router a folder's name IS the URL, so a path is its folder name plus
its constant, and the two must match. To rename `/apply/executives` to, say,
`/apply/team`:

| What | Change |
|---|---|
| the page | `git mv src/app/apply/executives src/app/apply/team` |
| the one constant | `EXEC_APPLICATIONS_PATH` in `src/lib/applyRoutes.ts` → `"/apply/team"` |
| the browser tests | `PAGE` in `tests/exec-applications.spec.ts` |

The home page link ("Exec team applications", in `src/components/sections/Join.tsx`),
the chooser's card, the navigation and each page's canonical URL all read those
constants, so nothing else changes. Then `npm run build` and run the tests in
section 7.

⛔ If `/apply/member` moves, printed QR codes and the navigation both have to be
checked: the navigation reads the constant, a printed code does not.

**The API path** only needs changing if the club wants that renamed too:

| What | Change |
|---|---|
| the route | `git mv src/app/api/exec-applications src/app/api/<new-name>` |
| the constant | `EXEC_APPLICATIONS_API` in `src/lib/applyRoutes.ts` |
| the server tests' request URL | `BASE` in `tests/exec-applications-api.spec.ts` (cosmetic; they call the route directly) |
| the setup check hint in the log | the path in `route.ts` ("Run the detailed setup check") |
| this document | the URLs in section 4 |

---

## 10. Abuse protection, and what is not public

- **Rate limit.** At most **5 submissions per IP address per 10 minutes**
  (the first address in `x-forwarded-for`, which Vercel sets). The 6th gets
  **429** and the page says, in plain words, to wait ten minutes; nothing is sent
  to Google for it. ⚠️ **The count is kept in memory and resets per server
  instance**: a cold start, or a second instance serving at the same time, starts
  from zero. It stops one person or one script hammering the Form, not a
  determined attack. **Recommended on top: a Vercel Firewall rate-limit rule**
  (Project → Firewall → Rules) on `POST /api/exec-applications`.
- **Honeypot.** A hidden field named `wec_hp`, labelled "Leave this empty",
  `autocomplete="off"`, `tabindex=-1`, `aria-hidden`. A filled one is answered
  "ok", nothing is sent, and **one line is logged with no answers in it**. It is
  deliberately not called `website`: a password manager or autofill could fill
  that in for a real person and have them silently dropped.
- **Over-long answers** (more than 8,000 characters in one field) are refused
  with a 400 and a sentence naming the length. Nothing is ever cut short.
- **Sign-in walls fail.** The route posts with `redirect: "manual"` and counts
  only a real `200` as success, so a Form that demands a Google sign-in is
  reported as a failure, never as "you're in".
