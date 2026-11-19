# The member list

Everyone who joins through the site lives in `members.members` in the WEC OS Supabase project. The Google Form and its Sheet keep getting every sign up too, as a second copy, until there is a real backup.

## How a sign up flows

With `WEC_MEMBERS_DB=on`, `/api/join` checks the answers and the privacy box as it always has, then:

1. Saves them with `api.service_join_member`. If the database cannot be reached (an outage, or the `SUPABASE_` keys missing), Google alone decides, exactly as before the member list existed, and Vercel's logs show `MEMBER LIST SAVE FAILED`. Run the Sheet import afterwards to bring those people in; it skips everyone already on the list.
2. If the email is already a member, says "You're in" and stops. Nothing goes to Google, so the Sheet gets no duplicate.
3. Sends the answers to the Google Form. If Google refuses, it is logged (`[join]` in Vercel's logs) and the student is still told they're in, because they are.

With it unset, `/api/join` is Google only, exactly as before. `GET /api/join` shows `"membersDb": true` or `false`.

Keep the Google Form connected. The sign up page decides whether to use the in-site form from `NEXT_PUBLIC_WEC_GOOGLE_FORM_URL`, and without it falls back to opening an email, so the database alone cannot run the form yet. Dropping Google later needs that page changed too.

## Who can see it

The table itself, nobody through the API. The `members` schema is not exposed, the table has row level security with no policies, and the one function that writes to it is callable only with the service key, which only the server holds. The full rows are read in the dashboard: Table Editor, schema `members`.

One way in from WEC OS: the **Members** page (`/os/members`), for positions holding `members.view`, which is the VP Community seat to start (migration `20261119000100_os_members_page.sql`). It gets name, email, year and date joined for active members, through `api.member_list`, and nothing else on the row.

- **The agreement first.** The list stays closed until the person agrees to the member data rules (`src/lib/os/memberPolicy.ts`), once per version. To ask everyone again, change the rules, raise `MEMBER_POLICY_VERSION` there and `private.member_policy_version()` in a new migration.
- **What is logged.** Every opening of the list (`members.viewed`, with the row count) and every copy or CSV download (`members.export`: kind, count, year filter, whether a search was on, batch). Never an address, a name or search text. Copy and download counts are what the page reports; the opening is recorded by the database.
- **Sending.** The site sends nothing to members. People copy a batch into the BCC line of their own email.
- **More people.** Give `members.view` to another position under Administration, Permissions. That is recorded in the audit log.

## Going live

1. Merge, then `npx supabase db push`. It adds the schema, the table and the function.
2. Vercel → Settings → Environment Variables, Production: `WEC_MEMBERS_DB=on`. Redeploy.
3. Open `https://www.joinwec.ca/api/join`: `"membersDb": true`.
4. Sign up with your own address. The row should be in Supabase and in the Sheet.
5. Import everyone from before (below).
6. The privacy policy (`src/app/privacy/page.tsx`) says sign ups are kept in Supabase, in the United States, with a copy in Google Sheets, and that every executive is on the member list. Keep it true if any of this changes.

To turn it off: set `WEC_MEMBERS_DB` to empty and redeploy. Nothing is lost; rows already saved stay.

## Importing the Sheet, once

1. Sheet → File → Download → Comma separated values. Save it **outside this repository**.
2. `node scripts/members-import.mjs <that file>`. Check the column mapping it prints.
3. Read `members-rejected.csv` if it wrote one: every row it did not use, and why, by its line in the CSV. If the Sheet also has Google's own "Email Address" column, check the mapping picked the Western email one; rename a header to steer it.
4. Paste `members-import.sql` into the SQL Editor and run it. It is one transaction, and it skips any email already on the list, so it is safe to run after people have started joining through the new path, and safe to run twice.
5. Check: `members_now` should equal the Sheet's rows minus the duplicates and rejects. Spot check a few rows.
6. Delete the CSV and the two files it wrote.

## Executives

Every executive is a member by being one. Anyone on the roster who never used the form goes in through the import: add them as rows to the CSV (name, Western email, year, today as the timestamp) and run it again; everyone already on the list is skipped. Besides the form's six years, the table takes `Year 5+` and `Unknown` for these rows. Replace `Unknown` once the year is confirmed. A row with no signature or an `Unknown` year does not count toward the USC's member list.

## Someone leaves

Set their `status` to `left` in the Table Editor rather than deleting the row, so the count of who ever joined stays true. A person who asks to have their data removed is deleted outright, from here and from the Sheet.
