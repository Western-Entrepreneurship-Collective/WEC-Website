# WEC OS

The private workspace for the WEC executive team, under `/os`. For whoever runs it, now and in future years. The public site does not depend on any of this.

## How it fits together

| Part | Where | Notes |
| --- | --- | --- |
| Screens | `src/app/os/`, `src/components/os/` | Server-rendered. No Supabase client in the browser. |
| Session refresh | `src/proxy.ts` | Runs on `/os` only, so the public site stays static. |
| Calls to the database | `src/lib/os/` | With the signed-in person's own token, so access rules always apply. |
| Everything else | `supabase/migrations/` | Tables, access rules, workflows, automation. |

Three database schemas. `os` holds tables, readable under row level security and not writable by any client. `api` holds functions, the only way to change anything, each checking its own caller. `private` holds helpers and is never exposed.

The service key bypasses the access rules. It is used only in `src/lib/os/admin.ts`, for Auth admin calls and signing file URLs after an `api` function has authorized the person, and by the job routes.

## Run it locally

Needs Docker.

```sh
npx supabase start
npm run build
npm run test:db     # database rules and workflows
npm run test:os     # the app in a browser; resets the local database first
```

To click around, put the values `npx supabase status` prints into `.env.local` as `SUPABASE_URL` and `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, set `WEC_OS_SITE_URL=http://localhost:3000`, and run `npm run dev`. Sign in at `/os/login` as anyone in `supabase/seed.local.sql`; the password is `local-test-password`. Local email lands at http://127.0.0.1:54324. Invitation links are built from `site_url` in `supabase/config.toml`, which points at port 3002 for the tests.

After any migration that adds a function, keep `20261031000900_os_finalize.sql`'s revoke as the last step of your migration. `supabase/tests/00_lockdown.sql` fails otherwise. Regenerate types with `npx supabase gen types typescript --local --schema os --schema api > src/lib/os/database.types.ts`.

## Going live

Do these in order. Nothing here touches the public site until the Vercel step, and that step only adds variables.

1. **Create a Supabase project** on the free plan, in the Canada Central region. The privacy policy says the data is in Canada, so this has to stay true.
2. **Auth settings.**
   - Authentication → Sign In / Providers → Email: keep the provider **on**, turn **"Allow new users to sign up" off**. Turning the email provider itself off also stops password logins.
   - URL Configuration: Site URL `https://joinwec.ca/os`.
   - Passwords: minimum length 10.
3. **Email.** Verify a sending subdomain in Resend (for example `mail.joinwec.ca`), which needs a few DNS records. Under Authentication → SMTP, enter Resend's SMTP details. The built-in sender only reaches your Supabase team, at two emails an hour, so invitations do not work without this.
4. **Email templates.** Copy `supabase/templates/invite.html` and `recovery.html` into Authentication → Email Templates. These send people to a page with a button, so a mail scanner opening the link cannot use it up. The default templates will not work.
5. **API settings.** Project Settings → Data API → Exposed schemas: `os, api`. Remove `public`.
6. **Run the migrations:** `npx supabase link --project-ref <ref>`, then `npx supabase db push`. Do not run `seed.local.sql` there.
7. **Check the automation.** In the SQL editor: `select jobname, schedule from cron.job;` should show `wec-os-sweep`. If it does not, the project has no pg_cron: schedule a call to `POST /api/os/jobs/sweep` in the GitHub Action instead.
8. **Vercel variables,** Production only, so previews cannot reach real data: everything under "WEC OS" in `.env.example`. Redeploy.
9. **Let the database wake the email worker.** In the SQL editor, with your values:
   ```sql
   insert into private.config (key, value) values
     ('jobs_url', 'https://joinwec.ca/api/os/jobs/email'),
     ('jobs_secret', '<the same value as WEC_OS_JOBS_SECRET>');
   ```
10. **Health check.** In the GitHub repository: variable `WEC_OS_URL` (`https://joinwec.ca`) and secret `WEC_OS_JOBS_SECRET`. Run "WEC OS health" once by hand.
11. **Create the first administrator:** `node scripts/os-bootstrap-admin.mjs` (usage at the top of the file). It refuses to run a second time.
12. **Function region.** Consider setting Vercel's function region to Montreal (`yul1`) to sit beside the database. It also moves the two public form routes, so it is a separate decision.

Invite everyone else from `/os/admin/executives`. Have at least two administrators. With two or more, nobody can change their own access or reshape a seat, role or department they sit in, so each checks the other. A sole administrator is exempt from those limits because nobody else could act, which also means that person could give themselves any access, with only the audit log to show it.

## Backups

The free plan has no downloadable backups. Decide on one of these before relying on the system:

- **Free:** a nightly `pg_dump`, encrypted, committed to a **separate private repository**. Never here: this repository is public, and so are its Actions artifacts. It covers the database, not attached files.
- **Paid:** Supabase Pro, $25 a month, adds daily backups kept for seven days and removes pausing.

```yaml
# In a private repository. Secrets: SUPABASE_DB_URL, BACKUP_PASSPHRASE.
name: WEC OS backup
on: { schedule: [{ cron: "0 7 * * *" }], workflow_dispatch: {} }
permissions: { contents: write }
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          sudo apt-get update -qq && sudo apt-get install -y -qq postgresql-client-17 || sudo apt-get install -y -qq postgresql-client
          pg_dump "$SUPABASE_DB_URL" --schema=os --schema=auth --no-owner | gpg --batch --symmetric --passphrase "$BACKUP_PASSPHRASE" -o "backup-$(date +%F).sql.gpg"
          git config user.name backup && git config user.email backup@users.noreply.github.com
          git add . && git commit -m "Backup $(date +%F)" && git push
        env:
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
          BACKUP_PASSPHRASE: ${{ secrets.BACKUP_PASSPHRASE }}
```

Test a restore once, into a local stack, before trusting it.

## How the screens are organized

The sidebar has three parts: **My work** (Home, Tasks, Projects, Calendar, Inbox), **My team**, and **Organization** (Events, Global Projects, All Teams, SOP Library). President and Administration appear under **Oversight** only for those roles. Meetings live inside each team.

A new executive lands on a welcome guide once, then Home shows a getting-started checklist that ticks itself off and can be hidden. If a team has a handover project from the last transition, Home points new people to it.

## Who can see what

Every rule below lives in the database, and `supabase/tests/01_access_matrix.sql` proves it.

- **President:** every project and task. Approves events and Global Projects. No technical admin rights from the position.
- **System Administrator:** accounts, structure, permissions, templates, automation, audit. Sees the schedule (names, dates, status), not task content. A person can be both.
- **Vice President:** their department in full, and answers its cross-team requests.
- **Director / Coordinator:** their department's shared work, except restricted tasks. A request reaches them only after their VP accepts it.
- **Internal projects:** the owning team and the President. Linking to an event opens nothing. A team can choose to show an event lead a name and a percentage, never tasks.
- **Global Projects:** every executive sees the summary once approved. Tasks stay with the people on them.
- **Cross-team tasks:** both teams see that one task and the name of the project it belongs to, and nothing else from it.
- **Vacant seats:** a request goes to the next filled seat up the reporting line. With the President's seat vacant too, it waits on the admin overview, showing only which department it is for.

Change defaults under Administration → Permissions. Internal privacy, archives being read-only and the audit log being uneditable are not settings.

## Templates and automation

Approving an event generates its projects and tasks inside that one transaction, so a bad template fails the approval and leaves nothing half made. Edit templates under Administration → Templates: each save is a new version, is checked on save, and projects keep the version that made them.

Everything else runs in a sweep every 15 minutes. It is safe to run twice: unique keys stop duplicates, whichever process gets there first. Look under Administration → Jobs for failures, each with a Retry, and Automation for the log of every run. The overview warns if the sweep has stopped.

Dates set by hand are never moved by a reschedule. A template date that has already passed becomes the day of generation, and the task says so.

Emails say how many notifications are waiting and link to the app. They never carry titles or content, so a forwarded email reveals nothing.

## The year-end transition

Administration → Academic years, a few weeks before the new team takes over.

1. **Start the transition.** Saves the current roster. Nothing else changes.
2. **Generate handover projects.** One private project per department.
3. **Record departures.** For each person leaving, choose who takes their open work. Their account closes immediately; their name stays on what they did.
4. **Finish.** Makes the new year current and ends every position from the old one. Accounts stay open, so returning executives keep their logins.
5. **Assign the new roster, right away,** and invite new people. Until then, nobody holds a position, so nobody but administrators can do much. A sole administrator may assign their own position; with two or more, the other one has to.

New executives inherit their department's history automatically, because access follows the position and not the person.

## If something goes wrong

- **Someone lost access or left suddenly:** Administration → Executives → Deactivate. Immediate, even for a session already open.
- **Something was archived by mistake:** Administration → Archives. Needs a reason, which goes in the audit log.
- **Emails stopped:** Administration → Jobs. Resend's free plan stops at 100 emails a day.
- **The sweep stopped:** the health action fails and the overview says so. On the free plan, check whether the project was paused for inactivity, and restore it from the Supabase dashboard.
