-- WEC OS tables: events, projects, tasks, templates, automation, SOPs, meetings.
-- The relationships the brief calls fundamental are constraints here, not
-- conventions in application code.

-- ─── Events ────────────────────────────────────────────────────────────────
create table os.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  program text not null default '',
  description text not null default '',
  objectives text not null default '',
  tier text not null check (tier in ('A', 'B', 'C')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text not null default '',
  estimated_budget numeric(10, 2) check (estimated_budget is null or estimated_budget >= 0),
  requires_speakers boolean not null default false,
  requires_registration boolean not null default false,
  requires_member_participation boolean not null default false,
  requires_sponsorship boolean not null default false,
  requires_finance boolean not null default false,
  requires_communications boolean not null default false,
  requires_founder_support boolean not null default false,
  requires_media boolean not null default false,
  requires_logistics boolean not null default false,
  marketing_notes text not null default '',
  registration_notes text not null default '',
  sponsorship_notes text not null default '',
  status text not null default 'draft' check (status in
    ('draft', 'submitted', 'changes_requested', 'rejected', 'approved', 'in_progress', 'completed', 'archived')),
  submitted_by uuid references os.executives (id) on delete set null,
  submitted_at timestamptz,
  decided_by uuid references os.executives (id) on delete set null,
  decided_at timestamptz,
  academic_year_id uuid references os.academic_years (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at),
  check ((status = 'archived') = (archived_at is not null))
);
create index events_starts on os.events (starts_at);
create index events_status on os.events (status);

create table os.event_leads (
  event_id uuid not null references os.events (id) on delete cascade,
  executive_id uuid not null references os.executives (id) on delete restrict,
  primary key (event_id, executive_id)
);
create index event_leads_executive on os.event_leads (executive_id);

-- Empty means no restriction on which templates may activate. Not every event
-- uses every department.
create table os.event_departments (
  event_id uuid not null references os.events (id) on delete cascade,
  department_id uuid not null references os.departments (id) on delete restrict,
  primary key (event_id, department_id)
);

create table os.event_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references os.events (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  role text not null default '',
  status text not null default 'proposed' check (status in ('proposed', 'invited', 'confirmed', 'declined')),
  created_at timestamptz not null default now()
);
create index event_guests_event on os.event_guests (event_id);

-- Every decision on an event or Global Project, in order.
create table os.approvals (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('event', 'project')),
  entity_id uuid not null,
  decision text not null check (decision in ('submitted', 'approved', 'rejected', 'changes_requested')),
  actor_id uuid references os.executives (id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index approvals_entity on os.approvals (entity_type, entity_id, created_at);
create trigger approvals_no_change before update or delete on os.approvals
  for each row execute function private.forbid_change();

-- ─── Templates ─────────────────────────────────────────────────────────────
create table os.templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_-]+$'),
  kind text not null check (kind in ('event_project', 'global', 'internal')),
  name text not null check (length(trim(name)) between 1 and 160),
  description text not null default '',
  department_id uuid references os.departments (id) on delete restrict,
  current_version_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'internal' or department_id is not null),
  check (kind <> 'event_project' or department_id is not null)
);

-- A saved version never changes. A project records exactly which one made it.
create table os.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references os.templates (id) on delete restrict,
  version int not null check (version > 0),
  definition jsonb not null,
  created_by uuid references os.executives (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);
create trigger template_versions_immutable before update or delete on os.template_versions
  for each row execute function private.forbid_change();
alter table os.templates add constraint templates_current_version_fk
  foreign key (current_version_id) references os.template_versions (id) on delete restrict;

-- ─── Projects ──────────────────────────────────────────────────────────────
create table os.projects (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('EVENT', 'GLOBAL', 'INTERNAL')),
  event_id uuid references os.events (id) on delete restrict,
  owning_department_id uuid references os.departments (id) on delete restrict,
  lead_executive_id uuid references os.executives (id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 160),
  summary text not null default '',
  starts_on date,
  due_on date,
  status text not null default 'planning' check (status in ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  approval_status text not null default 'not_required'
    check (approval_status in ('not_required', 'draft', 'pending', 'approved', 'rejected', 'changes_requested')),
  -- 'organization' opens the project to every executive. Never for INTERNAL:
  -- only the owning team and the President have default access to those.
  visibility text not null default 'participants' check (visibility in ('participants', 'organization')),
  share_progress_with_event_lead boolean not null default false,
  template_id uuid references os.templates (id) on delete set null,
  template_version_id uuid references os.template_versions (id) on delete restrict,
  -- Set on the projects automation owns, such as a department's recurring work.
  system_key text unique,
  submitted_by uuid references os.executives (id) on delete set null,
  decided_by uuid references os.executives (id) on delete set null,
  decided_at timestamptz,
  academic_year_id uuid references os.academic_years (id) on delete set null,
  completed_at timestamptz,
  archived_at timestamptz,
  created_by uuid references os.executives (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_event_relationship check (
    (kind = 'EVENT' and event_id is not null)
    or (kind = 'GLOBAL' and event_id is null)
    or kind = 'INTERNAL'
  ),
  constraint internal_has_owner check (kind <> 'INTERNAL' or owning_department_id is not null),
  constraint event_project_has_owner check (kind <> 'EVENT' or owning_department_id is not null),
  constraint internal_stays_private check (kind <> 'INTERNAL' or visibility = 'participants'),
  constraint only_internal_shares_progress check (kind = 'INTERNAL' or not share_progress_with_event_lead),
  constraint share_needs_event check (not share_progress_with_event_lead or event_id is not null),
  constraint only_global_needs_approval check (kind = 'GLOBAL' or approval_status = 'not_required'),
  check (due_on is null or starts_on is null or due_on >= starts_on)
);
create index projects_event on os.projects (event_id);
create index projects_department on os.projects (owning_department_id);
create index projects_lead on os.projects (lead_executive_id);
create unique index projects_one_per_event_template on os.projects (event_id, template_id)
  where event_id is not null and template_id is not null;

create table os.project_departments (
  project_id uuid not null references os.projects (id) on delete cascade,
  department_id uuid not null references os.departments (id) on delete restrict,
  primary key (project_id, department_id)
);
create index project_departments_department on os.project_departments (department_id);

create table os.project_participants (
  project_id uuid not null references os.projects (id) on delete cascade,
  executive_id uuid not null references os.executives (id) on delete restrict,
  primary key (project_id, executive_id)
);
create index project_participants_executive on os.project_participants (executive_id);

create table os.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references os.projects (id) on delete cascade,
  event_id uuid references os.events (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  due_on date not null,
  -- Set only by the President: internal work never reaches the Core Calendar on its own.
  core_visible boolean not null default false,
  completed_at timestamptz,
  created_by uuid references os.executives (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(project_id, event_id) <= 1)
);
create index milestones_due on os.milestones (due_on);
create index milestones_project on os.milestones (project_id);

-- ─── Tasks ─────────────────────────────────────────────────────────────────
create table os.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references os.projects (id) on delete restrict,
  parent_task_id uuid,
  title text not null check (length(trim(title)) between 1 and 200),
  description text not null default '',
  deliverables text not null default '',
  assigned_by uuid references os.executives (id) on delete set null,
  assigned_to uuid references os.executives (id) on delete set null,
  requesting_department_id uuid not null references os.departments (id) on delete restrict,
  responsible_department_id uuid not null references os.departments (id) on delete restrict,
  status text not null default 'todo' check (status in
    ('unassigned', 'todo', 'in_progress', 'blocked', 'submitted', 'revisions_requested', 'done', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  due_at timestamptz,
  -- 'manual' protects a date someone set by hand from every recalculation.
  due_source text not null default 'manual' check (due_source in ('template', 'manual')),
  offset_anchor text check (offset_anchor in ('event_start', 'event_end', 'project_start', 'project_due')),
  offset_days int,
  due_was_clamped boolean not null default false,
  visibility text not null default 'project' check (visibility in ('project', 'team', 'restricted')),
  is_cross_team boolean not null default false,
  request_state text check (request_state in ('pending', 'clarification_requested', 'accepted', 'declined')),
  requires_review boolean not null default false,
  reviewed_by uuid references os.executives (id) on delete set null,
  reviewed_at timestamptz,
  blocked_auto boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'automation', 'meeting')),
  template_task_key text,
  template_version_id uuid references os.template_versions (id) on delete restrict,
  created_by uuid references os.executives (id) on delete set null,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_id_project_unique unique (id, project_id),
  -- A subtask can never leave its parent's project: the pair is the key.
  constraint subtask_same_project foreign key (parent_task_id, project_id)
    references os.tasks (id, project_id) on delete set null (parent_task_id),
  constraint subtask_not_own_parent check (parent_task_id is null or parent_task_id <> id),
  constraint one_generated_task_per_key unique (project_id, template_task_key),
  constraint assigned_by_is_a_person check (assigned_by is not null or source = 'automation'),
  constraint assignee_required check (
    assigned_to is not null or status in ('unassigned', 'cancelled')
  ),
  constraint request_state_only_cross_team check (is_cross_team = (request_state is not null)),
  constraint pending_request_unstarted check (
    request_state is null
    or request_state not in ('pending', 'clarification_requested')
    or status = 'unassigned'
  ),
  constraint declined_request_closed check (request_state is distinct from 'declined' or status = 'cancelled'),
  constraint cross_team_done_needs_acceptance check (
    not is_cross_team or status <> 'done' or (request_state = 'accepted' and reviewed_at is not null)
  ),
  constraint review_before_done check (not requires_review or status <> 'done' or reviewed_at is not null),
  constraint cross_team_visible_to_both check (not is_cross_team or visibility <> 'restricted'),
  constraint cross_team_two_departments check (not is_cross_team or requesting_department_id <> responsible_department_id),
  constraint template_date_has_anchor check (due_source <> 'template' or offset_anchor is not null)
);
create index tasks_project on os.tasks (project_id);
create index tasks_parent on os.tasks (parent_task_id);
create index tasks_assigned_to on os.tasks (assigned_to);
create index tasks_assigned_by on os.tasks (assigned_by);
create index tasks_responsible on os.tasks (responsible_department_id, status);
create index tasks_requesting on os.tasks (requesting_department_id) where is_cross_team;
create index tasks_due on os.tasks (due_at) where status not in ('done', 'cancelled');

create table os.task_dependencies (
  task_id uuid not null references os.tasks (id) on delete cascade,
  depends_on_task_id uuid not null references os.tasks (id) on delete cascade,
  created_by uuid references os.executives (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);
create index task_dependencies_reverse on os.task_dependencies (depends_on_task_id);

create table os.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references os.tasks (id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 300),
  is_done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index task_checklist_task on os.task_checklist_items (task_id);

create table os.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references os.tasks (id) on delete cascade,
  author_id uuid references os.executives (id) on delete set null,
  body text not null check (length(trim(body)) between 1 and 8000),
  created_at timestamptz not null default now()
);
create index task_comments_task on os.task_comments (task_id, created_at);

-- Who held what, when. Kept forever, so handovers do not rewrite history.
create table os.task_assignment_history (
  id bigint generated always as identity primary key,
  task_id uuid not null references os.tasks (id) on delete cascade,
  assigned_to uuid references os.executives (id) on delete set null,
  assigned_by uuid references os.executives (id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index task_assignment_history_task on os.task_assignment_history (task_id);

create table os.task_review_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references os.tasks (id) on delete cascade,
  kind text not null check (kind in
    ('requested', 'clarification_requested', 'clarified', 'accepted', 'declined', 'delegated',
     'submitted', 'revisions_requested', 'approved')),
  actor_id uuid references os.executives (id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index task_review_events_task on os.task_review_events (task_id, created_at);
create trigger task_review_events_no_change before update on os.task_review_events
  for each row execute function private.forbid_change();

create table os.deadline_proposals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references os.tasks (id) on delete cascade,
  proposed_by uuid references os.executives (id) on delete set null,
  proposed_due_at timestamptz not null,
  note text not null default '',
  state text not null default 'open' check (state in ('open', 'accepted', 'rejected')),
  decided_by uuid references os.executives (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index deadline_proposals_task on os.deadline_proposals (task_id);
create unique index deadline_proposals_one_open on os.deadline_proposals (task_id) where state = 'open';

-- ─── SOPs ──────────────────────────────────────────────────────────────────
create table os.sops (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 160),
  department_id uuid not null references os.departments (id) on delete restrict,
  responsible_executive_id uuid references os.executives (id) on delete set null,
  approver_position_id uuid references os.positions (id) on delete set null,
  description text not null default '',
  visibility text not null default 'all_execs' check (visibility in ('all_execs', 'department', 'restricted')),
  review_on date,
  current_version_id uuid,
  archived_at timestamptz,
  created_by uuid references os.executives (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sops_department on os.sops (department_id);

create table os.sop_versions (
  id uuid primary key default gen_random_uuid(),
  sop_id uuid not null references os.sops (id) on delete restrict,
  major int not null check (major >= 0),
  minor int not null check (minor >= 0),
  content text not null default '',
  change_note text not null default '',
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'published', 'superseded')),
  author_id uuid references os.executives (id) on delete set null,
  restored_from_version_id uuid references os.sop_versions (id) on delete set null,
  published_at timestamptz,
  published_by uuid references os.executives (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sop_id, major, minor),
  check ((status in ('published', 'superseded')) = (published_at is not null))
);
create index sop_versions_sop on os.sop_versions (sop_id);
create unique index sop_versions_one_draft on os.sop_versions (sop_id) where status in ('draft', 'submitted', 'approved');
alter table os.sops add constraint sops_current_version_fk
  foreign key (current_version_id) references os.sop_versions (id) on delete restrict;

-- Once published, the words never change, whoever asks. The only move left is
-- published to superseded, and even that cannot touch the content or the number.
create function private.protect_published_sop() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('published', 'superseded') then
      raise exception 'A published SOP version cannot be deleted' using errcode = 'P0403';
    end if;
    return old;
  end if;
  if old.status in ('published', 'superseded') and (
    new.content is distinct from old.content or new.major is distinct from old.major or new.minor is distinct from old.minor
    or new.sop_id is distinct from old.sop_id or new.published_at is distinct from old.published_at
    or new.author_id is distinct from old.author_id or new.change_note is distinct from old.change_note
    or new.published_by is distinct from old.published_by
    or not (new.status = old.status or (old.status = 'published' and new.status = 'superseded'))
  ) then
    raise exception 'A published SOP version cannot be changed' using errcode = 'P0403';
  end if;
  return new;
end $$;
create trigger sop_versions_protect before update or delete on os.sop_versions
  for each row execute function private.protect_published_sop();

create table os.sop_approvals (
  id uuid primary key default gen_random_uuid(),
  sop_version_id uuid not null references os.sop_versions (id) on delete restrict,
  decision text not null check (decision in ('submitted', 'approved', 'changes_requested', 'published', 'restored')),
  actor_id uuid references os.executives (id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index sop_approvals_version on os.sop_approvals (sop_version_id);
create trigger sop_approvals_no_change before update or delete on os.sop_approvals
  for each row execute function private.forbid_change();

-- Points at a VERSION: a historical project keeps the procedure it actually used.
create table os.project_sop_refs (
  project_id uuid not null references os.projects (id) on delete cascade,
  sop_version_id uuid not null references os.sop_versions (id) on delete restrict,
  linked_by uuid references os.executives (id) on delete set null,
  linked_at timestamptz not null default now(),
  primary key (project_id, sop_version_id)
);
create index project_sop_refs_version on os.project_sop_refs (sop_version_id);

-- ─── Meetings ──────────────────────────────────────────────────────────────
create table os.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 160),
  starts_at timestamptz not null,
  department_id uuid not null references os.departments (id) on delete restrict,
  agenda text not null default '',
  minutes text not null default '',
  decisions text not null default '',
  academic_year_id uuid references os.academic_years (id) on delete set null,
  created_by uuid references os.executives (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meetings_department on os.meetings (department_id, starts_at desc);

create table os.meeting_departments (
  meeting_id uuid not null references os.meetings (id) on delete cascade,
  department_id uuid not null references os.departments (id) on delete restrict,
  primary key (meeting_id, department_id)
);
create table os.meeting_attendees (
  meeting_id uuid not null references os.meetings (id) on delete cascade,
  executive_id uuid not null references os.executives (id) on delete restrict,
  primary key (meeting_id, executive_id)
);
create index meeting_attendees_executive on os.meeting_attendees (executive_id);

create table os.meeting_action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references os.meetings (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  owner_id uuid references os.executives (id) on delete set null,
  due_on date,
  converted_task_id uuid references os.tasks (id) on delete set null,
  created_at timestamptz not null default now()
);
create index meeting_action_items_meeting on os.meeting_action_items (meeting_id);

create table os.meeting_project_links (
  meeting_id uuid not null references os.meetings (id) on delete cascade,
  project_id uuid not null references os.projects (id) on delete cascade,
  primary key (meeting_id, project_id)
);

-- ─── Attachments ───────────────────────────────────────────────────────────
create table os.attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('task', 'meeting', 'sop')),
  entity_id uuid not null,
  storage_path text not null unique,
  file_name text not null check (length(file_name) between 1 and 255),
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  uploaded_by uuid references os.executives (id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index attachments_entity on os.attachments (entity_type, entity_id);

-- ─── Announcements ─────────────────────────────────────────────────────────
create table os.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 160),
  body text not null check (length(trim(body)) between 1 and 8000),
  published_by uuid references os.executives (id) on delete set null,
  published_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- ─── Notifications ─────────────────────────────────────────────────────────
-- A reference, never a copy of the content: the title is read at display time,
-- through RLS, so someone who loses access stops seeing what it was about.
create table os.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references os.executives (id) on delete cascade,
  kind text not null,
  entity_type text not null,
  entity_id uuid,
  dedupe_key text not null,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_id, dedupe_key)
);
create index notifications_recipient on os.notifications (recipient_id, created_at desc);
create index notifications_unemailed on os.notifications (recipient_id) where emailed_at is null;

create table os.notification_preferences (
  executive_id uuid primary key references os.executives (id) on delete cascade,
  email_digest boolean not null default true,
  muted_kinds text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ─── Automation ────────────────────────────────────────────────────────────
create table os.automation_rules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_-]+$'),
  category text not null check (category in ('recurring', 'deadline')),
  name text not null,
  description text not null default '',
  -- recurring: {"freq":"weekly","weekday":1} | {"freq":"monthly","day":1} |
  --            {"freq":"yearly","months":[12,4],"day":1}
  schedule jsonb not null default '{}',
  -- recurring: {"department":"slug","title":"...","due_days":5,"priority":"normal"}
  -- deadline:  {"days":[7,2,1]} and the like
  config jsonb not null default '{}',
  enabled boolean not null default true,
  updated_by uuid references os.executives (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The unique pair is the duplicate guard: one occurrence of a rule runs once,
-- however many sweeps overlap or retry.
create table os.automation_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references os.automation_rules (id) on delete cascade,
  occurrence_key text not null,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'skipped')),
  items_created int not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (rule_id, occurrence_key)
);
create index automation_runs_started on os.automation_runs (started_at desc);

create table os.jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}',
  dedupe_key text unique,
  -- What caused this job, and how deep the chain is. Past the limit it stops
  -- and says so instead of feeding itself forever.
  causation_id uuid references os.jobs (id) on delete set null,
  depth int not null default 0 check (depth >= 0),
  state text not null default 'pending' check (state in ('pending', 'running', 'done', 'failed', 'dead')),
  attempts int not null default 0,
  max_attempts int not null default 5,
  next_run_at timestamptz not null default now(),
  last_error text,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index jobs_due on os.jobs (next_run_at) where state in ('pending', 'failed');
create index jobs_state on os.jobs (state, created_at desc);

-- ─── Year transitions ──────────────────────────────────────────────────────
create table os.year_transitions (
  id uuid primary key default gen_random_uuid(),
  from_year_id uuid not null references os.academic_years (id) on delete restrict,
  to_year_id uuid references os.academic_years (id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'completed')),
  started_by uuid references os.executives (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index year_transitions_one_open on os.year_transitions (status) where status = 'open';

-- Copies names on purpose: the roster of a past year must read correctly even
-- after the people on it are long gone.
create table os.roster_snapshots (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references os.academic_years (id) on delete restrict,
  executive_id uuid references os.executives (id) on delete set null,
  full_name text not null,
  department_name text not null,
  position_title text not null,
  seat_no int not null,
  taken_at timestamptz not null default now()
);
create index roster_snapshots_year on os.roster_snapshots (academic_year_id);
create trigger roster_snapshots_no_change before update or delete on os.roster_snapshots
  for each row execute function private.forbid_change();

-- ─── updated_at ────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['events', 'templates', 'projects', 'milestones', 'tasks', 'task_checklist_items',
                           'sops', 'sop_versions', 'meetings', 'automation_rules', 'notification_preferences'] loop
    execute format('create trigger %I before update on os.%I for each row execute function private.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

-- ─── Archived means read-only, on every child table ────────────────────────
-- A restore clears archived_at first, through one audited admin function.
create function private.assert_project_writable(p_project uuid) returns void
language plpgsql stable set search_path = '' as $$
begin
  if exists (select 1 from os.projects where id = p_project and archived_at is not null) then
    raise exception 'This project is archived and read-only' using errcode = 'P0409';
  end if;
end $$;

create function private.guard_archived_project() returns trigger language plpgsql set search_path = '' as $$
declare r record;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  perform private.assert_project_writable(r.project_id);
  return r;
end $$;

create function private.guard_archived_task_child() returns trigger language plpgsql set search_path = '' as $$
declare
  r record;
  p uuid;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  select project_id into p from os.tasks where id = r.task_id;
  if p is not null then perform private.assert_project_writable(p); end if;
  return r;
end $$;

do $$
declare t text;
begin
  foreach t in array array['tasks', 'project_departments', 'project_participants', 'milestones', 'project_sop_refs'] loop
    execute format('create trigger %I before insert or update or delete on os.%I for each row execute function private.guard_archived_project()', t || '_archived_guard', t);
  end loop;
  foreach t in array array['task_dependencies', 'task_checklist_items', 'task_comments', 'task_review_events', 'deadline_proposals'] loop
    execute format('create trigger %I before insert or update or delete on os.%I for each row execute function private.guard_archived_task_child()', t || '_archived_guard', t);
  end loop;
end $$;

create function private.guard_archived_row() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.archived_at is not null and new.archived_at is not null then
    raise exception '% is archived and read-only', tg_table_name using errcode = 'P0409';
  end if;
  return new;
end $$;
create trigger projects_archived_guard before update on os.projects
  for each row execute function private.guard_archived_row();
create trigger events_archived_guard before update on os.events
  for each row execute function private.guard_archived_row();
create trigger meetings_archived_guard before update on os.meetings
  for each row execute function private.guard_archived_row();

-- A project under an archived event cannot be added or changed either.
create function private.guard_archived_event_project() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.event_id is not null and new.archived_at is null
     and exists (select 1 from os.events where id = new.event_id and archived_at is not null) then
    raise exception 'That event is archived and read-only' using errcode = 'P0409';
  end if;
  return new;
end $$;
create trigger projects_event_archived_guard before insert or update on os.projects
  for each row execute function private.guard_archived_event_project();
