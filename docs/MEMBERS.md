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

Nobody through the API. The `members` schema is not exposed, the table has row level security with no policies, and the one function that writes to it is callable only with the service key, which only the server holds. Read it in the dashboard: Table Editor, schema `members`.

## Going live

1. Merge, then `npx supabase db push`. It adds the schema, the table and the function.
2. Vercel → Settings → Environment Variables, Production: `WEC_MEMBERS_DB=on`. Redeploy.
3. Open `https://www.joinwec.ca/api/join`: `"membersDb": true`.
4. Sign up with your own address. The row should be in Supabase and in the Sheet.
5. Import everyone from before (below).
6. Update the privacy policy page: sign ups are now also kept in Supabase, in the United States.

To turn it off: set `WEC_MEMBERS_DB` to empty and redeploy. Nothing is lost; rows already saved stay.

## Importing the Sheet, once

1. Sheet → File → Download → Comma separated values. Save it **outside this repository**.
2. `node scripts/members-import.mjs <that file>`. Check the column mapping it prints.
3. Read `members-rejected.csv` if it wrote one: every row it did not use, and why, by its line in the CSV. If the Sheet also has Google's own "Email Address" column, check the mapping picked the Western email one; rename a header to steer it.
4. Paste `members-import.sql` into the SQL Editor and run it. It is one transaction, and it skips any email already on the list, so it is safe to run after people have started joining through the new path, and safe to run twice.
5. Check: `members_now` should equal the Sheet's rows minus the duplicates and rejects. Spot check a few rows.
6. Delete the CSV and the two files it wrote.

## Someone leaves

Set their `status` to `left` in the Table Editor rather than deleting the row, so the count of who ever joined stays true. A person who asks to have their data removed is deleted outright, from here and from the Sheet.
