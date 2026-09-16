# Connecting the sign up form to Google Forms

The site's Join WEC form is already built. It sends every sign up into a Google
Form, and the Form writes it into a Google Sheet. The Sheet is the member list.
Connecting them takes one link. About 10 minutes.

## 1. Make the Form (on the club's Google account, not a personal one)

Create a new Google Form. Add these questions, in any order. **The wording is
yours** — the site identifies each question by the placeholder word in step 2,
not by its title, so phrase them however students should read them on the
Sheet. Only the Year options below are matched exactly.

| Question | Type | Required |
|---|---|---|
| Name | Short answer | yes |
| Western email | Short answer | yes |
| Year | Multiple choice with exactly: `Year 1`, `Year 2`, `Year 3`, `Year 4`, `Graduate`, `Alumni` | yes |
| What are you building, or curious about? | Paragraph | yes |
| Signature (typed full name) | Short answer | yes |
| Made or shipped anything? | Paragraph | no |
| Favourite thing about entrepreneurship? | Paragraph | no |

Settings that must be like this, or Google refuses the site's answers:

- **Settings → Responses → Collect email addresses: Do not collect.** The site
  already collects and checks the @uwo.ca email.
- **Restrict to users in your organization / Require sign in: OFF.**
- **Limit to 1 response: OFF.**
- **The two optional questions must be optional in Google.** Marking one required
  passes the step 4 check but makes Google reject any sign up that leaves it blank.
- Do not add response validation on the Google side. The site checks the email.
- If Year options are renamed, Google rejects answers. Keep them exactly as above.

In **Responses**, press **Link to Sheets** to create the Sheet.

## 2. Get the pre-filled link

Form editor → **⋮ menu → Get pre-filled link**. Type these exact words as the answers:

| Question | Type this |
|---|---|
| Name | `NAME` |
| Western email | `EMAIL` |
| Year | pick `Year 1` |
| What are you building | `BUILDING` |
| Signature | `SIGNATURE` |
| Made or shipped | `EVIDENCE` |
| Favourite thing | `FAVOURITE` |

Press **Get link**, then **Copy link**. It looks like
`https://docs.google.com/forms/d/e/1FAIpQL.../viewform?usp=pp_url&entry.123=NAME&...`

## 3. Put it in the site

Vercel → the project → **Settings → Environment Variables**:

```
NEXT_PUBLIC_WEC_GOOGLE_FORM_URL = <the link from step 2>
```

Then **redeploy**. The value is read at build time, so it does nothing until redeployed.
Locally, put the same line in `.env.local` and restart `npm run dev`.

## 4. Check the setup

Open **`<your site>/api/join`** in a browser. It reads the Form and answers in plain words:

- `"connected": true, "ready": true, "problems": []` means everything lines up.
- Otherwise `problems` lists exactly what to fix, for example
  *"The "Year of Study" question's options must be exactly: Year 1, ... Missing: Graduate, Alumni. Rename or remove: Grad, Alum."*

## 5. Choose which emails are accepted (optional)

```
NEXT_PUBLIC_WEC_EMAIL_RULE = western   (the default)
NEXT_PUBLIC_WEC_EMAIL_RULE = any
```

- **western**: `@uwo.ca` and any `@something.uwo.ca` (Huron, King's, Brescia), plus `@ivey.ca`.
  This is what the USC member list needs.
- **any**: any email address. The label changes from "Western email" to "Email".
  Emails not from Western will not count toward the USC's 50 members.

Neither setting verifies that someone owns the address. It checks what is typed, and catches
common typos like `@uwo.com`. Redeploy after changing it.

## 6. Test it

Open the site, press Join WEC, sign up with a real @uwo.ca address. The page should say
**You're in.** and a new row should appear in the Sheet within seconds. Delete the test row.

If it says "That didn't go through", check step 1's settings first. The server log
(Vercel → Logs) says `[join] Google Form refused the answers, status ...` or
`[join] Google Form not connected: ...` with the reason.

## Notes

- If a question is edited or deleted in the Form, redo step 2 and 3.
- Answers are never stored by the site or written to its logs. The Sheet is the only copy.
- Setting `NEXT_PUBLIC_WEC_JOIN_URL` instead sends people off-site to that link and
  turns this form off.
