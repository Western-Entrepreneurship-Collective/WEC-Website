
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "api": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "activate_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"add_comment":
{ Args: { "p_body": string,"p_task": string }; Returns: string
                           },
"add_task_dependency":
{ Args: { "p_depends_on": string,"p_task": string }; Returns: undefined
                           },
"archive_announcement":
{ Args: { "p_id": string }; Returns: undefined
                           },
"archive_event":
{ Args: { "p_event": string }; Returns: undefined
                           },
"archive_meeting":
{ Args: { "p_id": string }; Returns: undefined
                           },
"archive_position":
{ Args: { "p_id": string }; Returns: undefined
                           },
"archive_project":
{ Args: { "p_project": string }; Returns: undefined
                           },
"archived_records":
{ Args: Record<PropertyKey, never>; Returns: {
              "archived_at": string,"label": string,"record_id": string,"record_type": string
            }[]
                           },
"assign_position":
{ Args: { "p_executive": string,"p_is_acting"?: boolean,"p_position": string,"p_seat": number }; Returns: string
                           },
"assign_task":
{ Args: { "p_assignee": string,"p_task": string }; Returns: undefined
                           },
"attachment_path":
{ Args: { "p_id": string }; Returns: {
              "file_name": string,"storage_path": string
            }[]
                           },
"bootstrap_first_admin":
{ Args: { "p_email": string,"p_full_name": string,"p_position_title"?: string }; Returns: string
                           },
"calendar_items":
{ Args: { "p_department"?: string,"p_from": string,"p_scope": string,"p_to": string }; Returns: {
              "can_open": boolean,"department_name": string,"ends_at": string,"is_cross_team": boolean,"item_id": string,"item_type": string,"priority": string,"starts_at": string,"status": string,"title": string
            }[]
                           },
"clarify_request":
{ Args: { "p_note": string,"p_task": string }; Returns: undefined
                           },
"confirm_attachment":
{ Args: { "p_id": string }; Returns: undefined
                           },
"convert_action_item":
{ Args: { "p_item": string,"p_project": string }; Returns: string
                           },
"create_cross_team_request":
{ Args: { "p_fields": Json,"p_project": string,"p_receiving": string }; Returns: string
                           },
"create_invitation":
{ Args: { "p_email": string,"p_full_name": string,"p_grant_admin": boolean,"p_position": string,"p_seat": number }; Returns: string
                           },
"create_project":
{ Args: { "p_departments"?: (string)[],"p_fields": Json,"p_template"?: string }; Returns: string
                           },
"create_sop":
{ Args: { "p_approver_position": string,"p_content": string,"p_department": string,"p_description": string,"p_responsible": string,"p_review_on": string,"p_title": string,"p_visibility": string }; Returns: string
                           },
"create_task":
{ Args: { "p_fields": Json,"p_project": string }; Returns: string
                           },
"cross_team_dependencies":
{ Args: Record<PropertyKey, never>; Returns: {
              "due_at": string,"request_state": string,"requesting": string,"responsible": string,"status": string,"task_id": string,"title": string
            }[]
                           },
"deactivate_executive":
{ Args: { "p_executive": string,"p_reassign_to"?: string }; Returns: number
                           },
"decide_deadline":
{ Args: { "p_accept": boolean,"p_proposal": string }; Returns: undefined
                           },
"decide_event":
{ Args: { "p_decision": string,"p_event": string,"p_note"?: string }; Returns: number
                           },
"decide_global_project":
{ Args: { "p_decision": string,"p_note"?: string,"p_project": string }; Returns: undefined
                           },
"delegate_request":
{ Args: { "p_delegate": string,"p_task": string }; Returns: undefined
                           },
"delete_checklist_item":
{ Args: { "p_id": string }; Returns: undefined
                           },
"department_progress":
{ Args: Record<PropertyKey, never>; Returns: {
              "blocked_tasks": number,"department_id": string,"department_name": string,"done_tasks": number,"open_tasks": number,"overdue_tasks": number
            }[]
                           },
"end_assignment":
{ Args: { "p_assignment": string }; Returns: undefined
                           },
"escalations":
{ Args: Record<PropertyKey, never>; Returns: {
              "department_name": string,"due_at": string,"is_cross_team": boolean,"is_overdue": boolean,"project_name": string,"status": string,"task_id": string,"title": string
            }[]
                           },
"event_readiness":
{ Args: { "p_event": string }; Returns: number
                           },
"event_team_progress":
{ Args: { "p_event": string }; Returns: {
              "can_open": boolean,"department_name": string,"lead_name": string,"next_due": string,"next_title": string,"overdue_tasks": number,"progress": number,"project_id": string
            }[]
                           },
"finish_year_transition":
{ Args: { "p_transition": string }; Returns: undefined
                           },
"generate_handover_projects":
{ Args: { "p_transition": string }; Returns: number
                           },
"link_project_sop":
{ Args: { "p_linked"?: boolean,"p_project": string,"p_version": string }; Returns: undefined
                           },
"mark_notifications_read":
{ Args: { "p_ids"?: (string)[] }; Returns: undefined
                           },
"mark_onboarding":
{ Args: { "p_step": string }; Returns: undefined
                           },
"me":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_notifications":
{ Args: { "p_limit"?: number,"p_unread_only"?: boolean }; Returns: {
              "created_at": string,"entity_id": string,"entity_type": string,"id": string,"kind": string,"read_at": string,"title": string
            }[]
                           },
"prepare_attachment":
{ Args: { "p_content_type": string,"p_entity": string,"p_file_name": string,"p_size": number,"p_type": string }; Returns: {
              "attachment_id": string,"storage_path": string
            }[]
                           },
"project_summaries":
{ Args: { "p_department"?: string,"p_event"?: string,"p_include_archived"?: boolean,"p_kind"?: string }; Returns: {
              "approval_status": string,"archived_at": string,"can_open": boolean,"department_name": string,"due_on": string,"event_id": string,"event_name": string,"id": string,"kind": string,"lead_name": string,"name": string,"next_due": string,"overdue_tasks": number,"progress": number,"starts_on": string,"status": string
            }[]
                           },
"propose_deadline":
{ Args: { "p_due": string,"p_note"?: string,"p_task": string }; Returns: string
                           },
"publish_announcement":
{ Args: { "p_body": string,"p_title": string }; Returns: string
                           },
"publish_sop_version":
{ Args: { "p_note"?: string,"p_version": string }; Returns: undefined
                           },
"reactivate_executive":
{ Args: { "p_executive": string }; Returns: undefined
                           },
"remove_task_dependency":
{ Args: { "p_depends_on": string,"p_task": string }; Returns: undefined
                           },
"reschedule_event":
{ Args: { "p_ends_at": string,"p_event": string,"p_expected"?: string,"p_starts_at": string }; Returns: number
                           },
"respond_to_request":
{ Args: { "p_action": string,"p_delegate"?: string,"p_note"?: string,"p_task": string }; Returns: undefined
                           },
"restore_archived":
{ Args: { "p_id": string,"p_reason": string,"p_type": string }; Returns: undefined
                           },
"retry_job":
{ Args: { "p_id": string }; Returns: undefined
                           },
"return_sop_version":
{ Args: { "p_note": string,"p_version": string }; Returns: undefined
                           },
"review_deliverable":
{ Args: { "p_accept": boolean,"p_note"?: string,"p_task": string }; Returns: undefined
                           },
"revoke_invitation":
{ Args: { "p_invitation": string }; Returns: undefined
                           },
"run_sweep_now":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"save_action_item":
{ Args: { "p_due": string,"p_id": string,"p_meeting": string,"p_owner": string,"p_title": string }; Returns: string
                           },
"save_checklist_item":
{ Args: { "p_id": string,"p_is_done": boolean,"p_label": string,"p_task": string }; Returns: string
                           },
"save_event":
{ Args: { "p_departments": (string)[],"p_expected"?: string,"p_fields": Json,"p_id": string,"p_leads": (string)[] }; Returns: string
                           },
"save_meeting":
{ Args: { "p_attendees": (string)[],"p_departments": (string)[],"p_expected"?: string,"p_fields": Json,"p_id": string,"p_projects": (string)[] }; Returns: string
                           },
"save_milestone":
{ Args: { "p_core"?: boolean,"p_due": string,"p_id": string,"p_project": string,"p_title": string }; Returns: string
                           },
"save_sop_draft":
{ Args: { "p_change_note": string,"p_content": string,"p_expected"?: string,"p_version": string }; Returns: undefined
                           },
"save_template":
{ Args: { "p_definition": Json,"p_department": string,"p_description": string,"p_id": string,"p_key": string,"p_kind": string,"p_name": string }; Returns: string
                           },
"search":
{ Args: { "p_query": string }; Returns: {
              "archived": boolean,"item_id": string,"item_type": string,"snippet": string,"title": string
            }[]
                           },
"service_claim_emails":
{ Args: { "p_limit"?: number }; Returns: {
              "email": string,"job_id": string,"preferred_name": string,"unread": number
            }[]
                           },
"service_claim_orphan_uploads":
{ Args: { "p_limit"?: number }; Returns: {
              "attachment_id": string,"storage_path": string
            }[]
                           },
"service_finish_email":
{ Args: { "p_error"?: string,"p_job": string,"p_ok": boolean }; Returns: undefined
                           },
"service_forget_upload":
{ Args: { "p_id": string }; Returns: undefined
                           },
"service_health":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"service_run_sweep":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"set_event_guests":
{ Args: { "p_event": string,"p_guests": Json }; Returns: undefined
                           },
"set_event_status":
{ Args: { "p_event": string,"p_status": string }; Returns: undefined
                           },
"set_milestone_done":
{ Args: { "p_done": boolean,"p_id": string }; Returns: undefined
                           },
"set_notification_preferences":
{ Args: { "p_email_digest": boolean,"p_muted_kinds": (string)[] }; Returns: undefined
                           },
"set_permission_grant":
{ Args: { "p_department": string,"p_executive": string,"p_granted": boolean,"p_org_role": string,"p_permission": string,"p_position": string }; Returns: undefined
                           },
"set_project_people":
{ Args: { "p_departments": (string)[],"p_participants": (string)[],"p_project": string }; Returns: undefined
                           },
"set_project_status":
{ Args: { "p_project": string,"p_status": string }; Returns: undefined
                           },
"set_setting":
{ Args: { "p_key": string,"p_value": Json }; Returns: undefined
                           },
"set_sop_archived":
{ Args: { "p_archived": boolean,"p_sop": string }; Returns: undefined
                           },
"set_system_admin":
{ Args: { "p_executive": string,"p_is_admin": boolean }; Returns: undefined
                           },
"set_task_status":
{ Args: { "p_expected"?: string,"p_status": string,"p_task": string }; Returns: undefined
                           },
"set_template_archived":
{ Args: { "p_archived": boolean,"p_id": string }; Returns: undefined
                           },
"start_sop_draft":
{ Args: { "p_from_version"?: string,"p_major"?: boolean,"p_sop": string }; Returns: string
                           },
"start_year_transition":
{ Args: { "p_ends": string,"p_new_label": string,"p_starts": string }; Returns: string
                           },
"submit_deliverable":
{ Args: { "p_note"?: string,"p_task": string }; Returns: undefined
                           },
"submit_event":
{ Args: { "p_event": string }; Returns: undefined
                           },
"submit_global_project":
{ Args: { "p_project": string }; Returns: undefined
                           },
"submit_sop_version":
{ Args: { "p_version": string }; Returns: undefined
                           },
"task_context":
{ Args: { "p_task": string }; Returns: {
              "can_open_project": boolean,"event_id": string,"project_id": string,"project_kind": string,"project_name": string,"requesting_department": string,"responsible_department": string
            }[]
                           },
"task_dependencies":
{ Args: { "p_task": string }; Returns: {
              "can_open": boolean,"direction": string,"status": string,"task_id": string,"title": string
            }[]
                           },
"transition_departure":
{ Args: { "p_executive": string,"p_reassign_to": string,"p_transition": string }; Returns: number
                           },
"unrouted_requests":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"department_name": string,"task_id": string
            }[]
                           },
"update_automation_rule":
{ Args: { "p_config": Json,"p_enabled": boolean,"p_id": string,"p_schedule": Json }; Returns: undefined
                           },
"update_profile":
{ Args: { "p_full_name": string,"p_preferred_name": string }; Returns: undefined
                           },
"update_project":
{ Args: { "p_expected"?: string,"p_fields": Json,"p_project": string }; Returns: number
                           },
"update_sop":
{ Args: { "p_approver_position": string,"p_description": string,"p_expected"?: string,"p_responsible": string,"p_review_on": string,"p_sop": string,"p_title": string,"p_visibility": string }; Returns: undefined
                           },
"update_task":
{ Args: { "p_expected"?: string,"p_fields": Json,"p_task": string }; Returns: undefined
                           },
"upsert_department":
{ Args: { "p_description": string,"p_head_position": string,"p_id": string,"p_name": string,"p_slug": string }; Returns: string
                           },
"upsert_position":
{ Args: { "p_department": string,"p_id": string,"p_org_role": string,"p_reports_to": string,"p_seats": number,"p_title": string }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"os": {
          Tables: {
            "academic_years": {
                  Row: {
                    "created_at": string,"ends_on": string,"id": string,"is_current": boolean,"label": string,"starts_on": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_on": string,"id"?: string,"is_current"?: boolean,"label": string,"starts_on": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"ends_on"?: string,"id"?: string,"is_current"?: boolean,"label"?: string,"starts_on"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"announcements": {
                  Row: {
                    "archived_at": string | null,"body": string,"created_at": string,"id": string,"published_at": string,"published_by": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"body": string,"created_at"?: string,"id"?: string,"published_at"?: string,"published_by"?: string | null,"title": string
                  }
                  Update: {
                    "archived_at"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"published_at"?: string,"published_by"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    }
                  ]
                },"approvals": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"decision": string,"entity_id": string,"entity_type": string,"id": string,"note": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"decision": string,"entity_id": string,"entity_type": string,"id"?: string,"note"?: string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"decision"?: string,"entity_id"?: string,"entity_type"?: string,"id"?: string,"note"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "approvals_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    }
                  ]
                },"attachments": {
                  Row: {
                    "confirmed_at": string | null,"content_type": string,"created_at": string,"entity_id": string,"entity_type": string,"file_name": string,"id": string,"size_bytes": number,"storage_path": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "confirmed_at"?: string | null,"content_type": string,"created_at"?: string,"entity_id": string,"entity_type": string,"file_name": string,"id"?: string,"size_bytes": number,"storage_path": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "confirmed_at"?: string | null,"content_type"?: string,"created_at"?: string,"entity_id"?: string,"entity_type"?: string,"file_name"?: string,"id"?: string,"size_bytes"?: number,"storage_path"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "attachments_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_kind": string,"changes": NonNullable<Json>,"created_at": string,"entity_id": string | null,"entity_type": string,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_kind"?: string,"changes"?: NonNullable<Json>,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_kind"?: string,"changes"?: NonNullable<Json>,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    }
                  ]
                },"automation_rules": {
                  Row: {
                    "category": string,"config": NonNullable<Json>,"created_at": string,"description": string,"enabled": boolean,"id": string,"key": string,"name": string,"schedule": NonNullable<Json>,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"config"?: NonNullable<Json>,"created_at"?: string,"description"?: string,"enabled"?: boolean,"id"?: string,"key": string,"name": string,"schedule"?: NonNullable<Json>,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "category"?: string,"config"?: NonNullable<Json>,"created_at"?: string,"description"?: string,"enabled"?: boolean,"id"?: string,"key"?: string,"name"?: string,"schedule"?: NonNullable<Json>,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "automation_rules_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    }
                  ]
                },"automation_runs": {
                  Row: {
                    "error": string | null,"finished_at": string | null,"id": string,"items_created": number,"occurrence_key": string,"rule_id": string,"started_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"finished_at"?: string | null,"id"?: string,"items_created"?: number,"occurrence_key": string,"rule_id": string,"started_at"?: string,"status"?: string
                  }
                  Update: {
                    "error"?: string | null,"finished_at"?: string | null,"id"?: string,"items_created"?: number,"occurrence_key"?: string,"rule_id"?: string,"started_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "automation_runs_rule_id_fkey"
      columns: ["rule_id"]
isOneToOne: false
      referencedRelation: "automation_rules"
      referencedColumns: ["id"]
    }
                  ]
                },"deadline_proposals": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"decided_by": string | null,"id": string,"note": string,"proposed_by": string | null,"proposed_due_at": string,"state": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"note"?: string,"proposed_by"?: string | null,"proposed_due_at": string,"state"?: string,"task_id": string
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"note"?: string,"proposed_by"?: string | null,"proposed_due_at"?: string,"state"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "deadline_proposals_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deadline_proposals_proposed_by_fkey"
      columns: ["proposed_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deadline_proposals_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"departments": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"description": string,"head_position_id": string | null,"id": string,"name": string,"slug": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"description"?: string,"head_position_id"?: string | null,"id"?: string,"name": string,"slug": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"description"?: string,"head_position_id"?: string | null,"id"?: string,"name"?: string,"slug"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "departments_head_position_fk"
      columns: ["head_position_id"]
isOneToOne: false
      referencedRelation: "positions"
      referencedColumns: ["id"]
    }
                  ]
                },"event_departments": {
                  Row: {
                    "department_id": string,"event_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "department_id": string,"event_id": string
                  }
                  Update: {
                    "department_id"?: string,"event_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_departments_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_departments_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"event_guests": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"name": string,"role": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"name": string,"role"?: string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"name"?: string,"role"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_guests_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"event_leads": {
                  Row: {
                    "event_id": string,"executive_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"executive_id": string
                  }
                  Update: {
                    "event_id"?: string,"executive_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_leads_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_leads_executive_id_fkey"
      columns: ["executive_id"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "academic_year_id": string | null,"archived_at": string | null,"created_at": string,"decided_at": string | null,"decided_by": string | null,"description": string,"ends_at": string | null,"estimated_budget": number | null,"id": string,"location": string,"marketing_notes": string,"name": string,"objectives": string,"program": string,"registration_notes": string,"requires_communications": boolean,"requires_finance": boolean,"requires_founder_support": boolean,"requires_logistics": boolean,"requires_media": boolean,"requires_member_participation": boolean,"requires_registration": boolean,"requires_speakers": boolean,"requires_sponsorship": boolean,"sponsorship_notes": string,"starts_at": string,"status": string,"submitted_at": string | null,"submitted_by": string | null,"tier": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id"?: string | null,"archived_at"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"description"?: string,"ends_at"?: string | null,"estimated_budget"?: number | null,"id"?: string,"location"?: string,"marketing_notes"?: string,"name": string,"objectives"?: string,"program"?: string,"registration_notes"?: string,"requires_communications"?: boolean,"requires_finance"?: boolean,"requires_founder_support"?: boolean,"requires_logistics"?: boolean,"requires_media"?: boolean,"requires_member_participation"?: boolean,"requires_registration"?: boolean,"requires_speakers"?: boolean,"requires_sponsorship"?: boolean,"sponsorship_notes"?: string,"starts_at": string,"status"?: string,"submitted_at"?: string | null,"submitted_by"?: string | null,"tier": string,"updated_at"?: string
                  }
                  Update: {
                    "academic_year_id"?: string | null,"archived_at"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"description"?: string,"ends_at"?: string | null,"estimated_budget"?: number | null,"id"?: string,"location"?: string,"marketing_notes"?: string,"name"?: string,"objectives"?: string,"program"?: string,"registration_notes"?: string,"requires_communications"?: boolean,"requires_finance"?: boolean,"requires_founder_support"?: boolean,"requires_logistics"?: boolean,"requires_media"?: boolean,"requires_member_participation"?: boolean,"requires_registration"?: boolean,"requires_speakers"?: boolean,"requires_sponsorship"?: boolean,"sponsorship_notes"?: string,"starts_at"?: string,"status"?: string,"submitted_at"?: string | null,"submitted_by"?: string | null,"tier"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    }
                  ]
                },"executives": {
                  Row: {
                    "activated_at": string | null,"created_at": string,"deactivated_at": string | null,"email": string,"full_name": string,"id": string,"onboarding": NonNullable<Json>,"preferred_name": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activated_at"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"email": string,"full_name": string,"id": string,"onboarding"?: NonNullable<Json>,"preferred_name"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "activated_at"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"email"?: string,"full_name"?: string,"id"?: string,"onboarding"?: NonNullable<Json>,"preferred_name"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string,"full_name": string,"grant_admin": boolean,"id": string,"invited_by": string | null,"position_id": string | null,"revoked_at": string | null,"seat_no": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email": string,"full_name": string,"grant_admin"?: boolean,"id"?: string,"invited_by"?: string | null,"position_id"?: string | null,"revoked_at"?: string | null,"seat_no"?: number | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string,"grant_admin"?: boolean,"id"?: string,"invited_by"?: string | null,"position_id"?: string | null,"revoked_at"?: string | null,"seat_no"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_position_id_fkey"
      columns: ["position_id"]
isOneToOne: false
      referencedRelation: "positions"
      referencedColumns: ["id"]
    }
                  ]
                },"jobs": {
                  Row: {
                    "attempts": number,"causation_id": string | null,"created_at": string,"dedupe_key": string | null,"depth": number,"entity_id": string | null,"entity_type": string | null,"finished_at": string | null,"id": string,"kind": string,"last_error": string | null,"max_attempts": number,"next_run_at": string,"payload": NonNullable<Json>,"state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"causation_id"?: string | null,"created_at"?: string,"dedupe_key"?: string | null,"depth"?: number,"entity_id"?: string | null,"entity_type"?: string | null,"finished_at"?: string | null,"id"?: string,"kind": string,"last_error"?: string | null,"max_attempts"?: number,"next_run_at"?: string,"payload"?: NonNullable<Json>,"state"?: string
                  }
                  Update: {
                    "attempts"?: number,"causation_id"?: string | null,"created_at"?: string,"dedupe_key"?: string | null,"depth"?: number,"entity_id"?: string | null,"entity_type"?: string | null,"finished_at"?: string | null,"id"?: string,"kind"?: string,"last_error"?: string | null,"max_attempts"?: number,"next_run_at"?: string,"payload"?: NonNullable<Json>,"state"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jobs_causation_id_fkey"
      columns: ["causation_id"]
isOneToOne: false
      referencedRelation: "jobs"
      referencedColumns: ["id"]
    }
                  ]
                },"meeting_action_items": {
                  Row: {
                    "converted_task_id": string | null,"created_at": string,"due_on": string | null,"id": string,"meeting_id": string,"owner_id": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "converted_task_id"?: string | null,"created_at"?: string,"due_on"?: string | null,"id"?: string,"meeting_id": string,"owner_id"?: string | null,"title": string
                  }
                  Update: {
                    "converted_task_id"?: string | null,"created_at"?: string,"due_on"?: string | null,"id"?: string,"meeting_id"?: string,"owner_id"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meeting_action_items_converted_task_id_fkey"
      columns: ["converted_task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meeting_action_items_meeting_id_fkey"
      columns: ["meeting_id"]
isOneToOne: false
      referencedRelation: "meetings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meeting_action_items_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    }
                  ]
                },"meeting_attendees": {
                  Row: {
                    "executive_id": string,"meeting_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "executive_id": string,"meeting_id": string
                  }
                  Update: {
                    "executive_id"?: string,"meeting_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meeting_attendees_executive_id_fkey"
      columns: ["executive_id"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meeting_attendees_meeting_id_fkey"
      columns: ["meeting_id"]
isOneToOne: false
      referencedRelation: "meetings"
      referencedColumns: ["id"]
    }
                  ]
                },"meeting_departments": {
                  Row: {
                    "department_id": string,"meeting_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "department_id": string,"meeting_id": string
                  }
                  Update: {
                    "department_id"?: string,"meeting_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meeting_departments_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meeting_departments_meeting_id_fkey"
      columns: ["meeting_id"]
isOneToOne: false
      referencedRelation: "meetings"
      referencedColumns: ["id"]
    }
                  ]
                },"meeting_project_links": {
                  Row: {
                    "meeting_id": string,"project_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "meeting_id": string,"project_id": string
                  }
                  Update: {
                    "meeting_id"?: string,"project_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meeting_project_links_meeting_id_fkey"
      columns: ["meeting_id"]
isOneToOne: false
      referencedRelation: "meetings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meeting_project_links_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"meetings": {
                  Row: {
                    "academic_year_id": string | null,"agenda": string,"archived_at": string | null,"created_at": string,"created_by": string | null,"decisions": string,"department_id": string,"id": string,"minutes": string,"starts_at": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id"?: string | null,"agenda"?: string,"archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"decisions"?: string,"department_id": string,"id"?: string,"minutes"?: string,"starts_at": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "academic_year_id"?: string | null,"agenda"?: string,"archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"decisions"?: string,"department_id"?: string,"id"?: string,"minutes"?: string,"starts_at"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meetings_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meetings_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    }
                  ]
                },"milestones": {
                  Row: {
                    "completed_at": string | null,"core_visible": boolean,"created_at": string,"created_by": string | null,"due_on": string,"event_id": string | null,"id": string,"project_id": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"core_visible"?: boolean,"created_at"?: string,"created_by"?: string | null,"due_on": string,"event_id"?: string | null,"id"?: string,"project_id"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"core_visible"?: boolean,"created_at"?: string,"created_by"?: string | null,"due_on"?: string,"event_id"?: string | null,"id"?: string,"project_id"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "milestones_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "milestones_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "milestones_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_preferences": {
                  Row: {
                    "email_digest": boolean,"executive_id": string,"muted_kinds": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "email_digest"?: boolean,"executive_id": string,"muted_kinds"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "email_digest"?: boolean,"executive_id"?: string,"muted_kinds"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_preferences_executive_id_fkey"
      columns: ["executive_id"]
isOneToOne: true
      referencedRelation: "executives"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"dedupe_key": string,"emailed_at": string | null,"entity_id": string | null,"entity_type": string,"id": string,"kind": string,"read_at": string | null,"recipient_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dedupe_key": string,"emailed_at"?: string | null,"entity_id"?: string | null,"entity_type": string,"id"?: string,"kind": string,"read_at"?: string | null,"recipient_id": string
                  }
                  Update: {
                    "created_at"?: string,"dedupe_key"?: string,"emailed_at"?: string | null,"entity_id"?: string | null,"entity_type"?: string,"id"?: string,"kind"?: string,"read_at"?: string | null,"recipient_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    }
                  ]
                },"permission_grants": {
                  Row: {
                    "created_at": string,"department_id": string | null,"executive_id": string | null,"id": string,"org_role": string | null,"permission_key": string,"position_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"department_id"?: string | null,"executive_id"?: string | null,"id"?: string,"org_role"?: string | null,"permission_key": string,"position_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"department_id"?: string | null,"executive_id"?: string | null,"id"?: string,"org_role"?: string | null,"permission_key"?: string,"position_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "permission_grants_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "permission_grants_executive_id_fkey"
      columns: ["executive_id"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "permission_grants_permission_key_fkey"
      columns: ["permission_key"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "permission_grants_position_id_fkey"
      columns: ["position_id"]
isOneToOne: false
      referencedRelation: "positions"
      referencedColumns: ["id"]
    }
                  ]
                },"permissions": {
                  Row: {
                    "action": string,"description": string,"key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"description": string,"key": string
                  }
                  Update: {
                    "action"?: string,"description"?: string,"key"?: string
                  }
                  Relationships: [
                    
                  ]
                },"position_assignments": {
                  Row: {
                    "academic_year_id": string,"created_at": string,"created_by": string | null,"during": unknown,"executive_id": string,"id": string,"is_acting": boolean,"position_id": string,"seat_no": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id": string,"created_at"?: string,"created_by"?: string | null,"during": unknown,"executive_id": string,"id"?: string,"is_acting"?: boolean,"position_id": string,"seat_no"?: number,"updated_at"?: string
                  }
                  Update: {
                    "academic_year_id"?: string,"created_at"?: string,"created_by"?: string | null,"during"?: unknown,"executive_id"?: string,"id"?: string,"is_acting"?: boolean,"position_id"?: string,"seat_no"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "position_assignments_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "position_assignments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "position_assignments_executive_id_fkey"
      columns: ["executive_id"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "position_assignments_position_id_fkey"
      columns: ["position_id"]
isOneToOne: false
      referencedRelation: "positions"
      referencedColumns: ["id"]
    }
                  ]
                },"positions": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"department_id": string,"id": string,"org_role": string,"reports_to_position_id": string | null,"seat_count": number,"sort_order": number,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"department_id": string,"id"?: string,"org_role": string,"reports_to_position_id"?: string | null,"seat_count"?: number,"sort_order"?: number,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"department_id"?: string,"id"?: string,"org_role"?: string,"reports_to_position_id"?: string | null,"seat_count"?: number,"sort_order"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "positions_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "positions_reports_to_position_id_fkey"
      columns: ["reports_to_position_id"]
isOneToOne: false
      referencedRelation: "positions"
      referencedColumns: ["id"]
    }
                  ]
                },"project_departments": {
                  Row: {
                    "department_id": string,"project_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "department_id": string,"project_id": string
                  }
                  Update: {
                    "department_id"?: string,"project_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_departments_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_departments_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"project_participants": {
                  Row: {
                    "executive_id": string,"project_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "executive_id": string,"project_id": string
                  }
                  Update: {
                    "executive_id"?: string,"project_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_participants_executive_id_fkey"
      columns: ["executive_id"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_participants_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"project_sop_refs": {
                  Row: {
                    "linked_at": string,"linked_by": string | null,"project_id": string,"sop_version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "linked_at"?: string,"linked_by"?: string | null,"project_id": string,"sop_version_id": string
                  }
                  Update: {
                    "linked_at"?: string,"linked_by"?: string | null,"project_id"?: string,"sop_version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_sop_refs_linked_by_fkey"
      columns: ["linked_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_sop_refs_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_sop_refs_sop_version_id_fkey"
      columns: ["sop_version_id"]
isOneToOne: false
      referencedRelation: "sop_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "academic_year_id": string | null,"approval_status": string,"archived_at": string | null,"completed_at": string | null,"created_at": string,"created_by": string | null,"decided_at": string | null,"decided_by": string | null,"due_on": string | null,"event_id": string | null,"id": string,"kind": string,"lead_executive_id": string | null,"name": string,"owning_department_id": string | null,"share_progress_with_event_lead": boolean,"starts_on": string | null,"status": string,"submitted_by": string | null,"summary": string,"system_key": string | null,"template_id": string | null,"template_version_id": string | null,"updated_at": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id"?: string | null,"approval_status"?: string,"archived_at"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"decided_at"?: string | null,"decided_by"?: string | null,"due_on"?: string | null,"event_id"?: string | null,"id"?: string,"kind": string,"lead_executive_id"?: string | null,"name": string,"owning_department_id"?: string | null,"share_progress_with_event_lead"?: boolean,"starts_on"?: string | null,"status"?: string,"submitted_by"?: string | null,"summary"?: string,"system_key"?: string | null,"template_id"?: string | null,"template_version_id"?: string | null,"updated_at"?: string,"visibility"?: string
                  }
                  Update: {
                    "academic_year_id"?: string | null,"approval_status"?: string,"archived_at"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"decided_at"?: string | null,"decided_by"?: string | null,"due_on"?: string | null,"event_id"?: string | null,"id"?: string,"kind"?: string,"lead_executive_id"?: string | null,"name"?: string,"owning_department_id"?: string | null,"share_progress_with_event_lead"?: boolean,"starts_on"?: string | null,"status"?: string,"submitted_by"?: string | null,"summary"?: string,"system_key"?: string | null,"template_id"?: string | null,"template_version_id"?: string | null,"updated_at"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_lead_executive_id_fkey"
      columns: ["lead_executive_id"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_owning_department_id_fkey"
      columns: ["owning_department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "templates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_template_version_id_fkey"
      columns: ["template_version_id"]
isOneToOne: false
      referencedRelation: "template_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"roster_snapshots": {
                  Row: {
                    "academic_year_id": string,"department_name": string,"executive_id": string | null,"full_name": string,"id": string,"position_title": string,"seat_no": number,"taken_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id": string,"department_name": string,"executive_id"?: string | null,"full_name": string,"id"?: string,"position_title": string,"seat_no": number,"taken_at"?: string
                  }
                  Update: {
                    "academic_year_id"?: string,"department_name"?: string,"executive_id"?: string | null,"full_name"?: string,"id"?: string,"position_title"?: string,"seat_no"?: number,"taken_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "roster_snapshots_academic_year_id_fkey"
      columns: ["academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roster_snapshots_executive_id_fkey"
      columns: ["executive_id"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    }
                  ]
                },"settings": {
                  Row: {
                    "description": string,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    }
                  ]
                },"sop_approvals": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"decision": string,"id": string,"note": string,"sop_version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"decision": string,"id"?: string,"note"?: string,"sop_version_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"decision"?: string,"id"?: string,"note"?: string,"sop_version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sop_approvals_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sop_approvals_sop_version_id_fkey"
      columns: ["sop_version_id"]
isOneToOne: false
      referencedRelation: "sop_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"sop_versions": {
                  Row: {
                    "author_id": string | null,"change_note": string,"content": string,"created_at": string,"id": string,"major": number,"minor": number,"published_at": string | null,"published_by": string | null,"restored_from_version_id": string | null,"sop_id": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"change_note"?: string,"content"?: string,"created_at"?: string,"id"?: string,"major": number,"minor": number,"published_at"?: string | null,"published_by"?: string | null,"restored_from_version_id"?: string | null,"sop_id": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string | null,"change_note"?: string,"content"?: string,"created_at"?: string,"id"?: string,"major"?: number,"minor"?: number,"published_at"?: string | null,"published_by"?: string | null,"restored_from_version_id"?: string | null,"sop_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sop_versions_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sop_versions_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sop_versions_restored_from_version_id_fkey"
      columns: ["restored_from_version_id"]
isOneToOne: false
      referencedRelation: "sop_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sop_versions_sop_id_fkey"
      columns: ["sop_id"]
isOneToOne: false
      referencedRelation: "sops"
      referencedColumns: ["id"]
    }
                  ]
                },"sops": {
                  Row: {
                    "approver_position_id": string | null,"archived_at": string | null,"created_at": string,"created_by": string | null,"current_version_id": string | null,"department_id": string,"description": string,"id": string,"responsible_executive_id": string | null,"review_on": string | null,"title": string,"updated_at": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approver_position_id"?: string | null,"archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"current_version_id"?: string | null,"department_id": string,"description"?: string,"id"?: string,"responsible_executive_id"?: string | null,"review_on"?: string | null,"title": string,"updated_at"?: string,"visibility"?: string
                  }
                  Update: {
                    "approver_position_id"?: string | null,"archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"current_version_id"?: string | null,"department_id"?: string,"description"?: string,"id"?: string,"responsible_executive_id"?: string | null,"review_on"?: string | null,"title"?: string,"updated_at"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sops_approver_position_id_fkey"
      columns: ["approver_position_id"]
isOneToOne: false
      referencedRelation: "positions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sops_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sops_current_version_fk"
      columns: ["current_version_id"]
isOneToOne: false
      referencedRelation: "sop_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sops_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sops_responsible_executive_id_fkey"
      columns: ["responsible_executive_id"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    }
                  ]
                },"system_admins": {
                  Row: {
                    "executive_id": string,"granted_at": string,"granted_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "executive_id": string,"granted_at"?: string,"granted_by"?: string | null
                  }
                  Update: {
                    "executive_id"?: string,"granted_at"?: string,"granted_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "system_admins_executive_id_fkey"
      columns: ["executive_id"]
isOneToOne: true
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "system_admins_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    }
                  ]
                },"task_assignment_history": {
                  Row: {
                    "assigned_by": string | null,"assigned_to": string | null,"created_at": string,"id": number,"note": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_by"?: string | null,"assigned_to"?: string | null,"created_at"?: string,"id"?: never,"note"?: string,"task_id": string
                  }
                  Update: {
                    "assigned_by"?: string | null,"assigned_to"?: string | null,"created_at"?: string,"id"?: never,"note"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_assignment_history_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_assignment_history_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_assignment_history_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"task_checklist_items": {
                  Row: {
                    "created_at": string,"id": string,"is_done": boolean,"label": string,"position": number,"task_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_done"?: boolean,"label": string,"position"?: number,"task_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_done"?: boolean,"label"?: string,"position"?: number,"task_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_checklist_items_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"task_comments": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"id": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"id"?: string,"task_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_comments_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"task_dependencies": {
                  Row: {
                    "created_at": string,"created_by": string | null,"depends_on_task_id": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"depends_on_task_id": string,"task_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"depends_on_task_id"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_dependencies_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
      columns: ["depends_on_task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_dependencies_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"task_review_events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"id": string,"kind": string,"note": string,"task_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"note"?: string,"task_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"note"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_review_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_review_events_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "assigned_by": string | null,"assigned_to": string | null,"blocked_auto": boolean,"completed_at": string | null,"created_at": string,"created_by": string | null,"deliverables": string,"description": string,"due_at": string | null,"due_source": string,"due_was_clamped": boolean,"id": string,"is_cross_team": boolean,"offset_anchor": string | null,"offset_days": number | null,"parent_task_id": string | null,"priority": string,"project_id": string,"request_state": string | null,"requesting_department_id": string,"requires_review": boolean,"responsible_department_id": string,"reviewed_at": string | null,"reviewed_by": string | null,"source": string,"status": string,"submitted_at": string | null,"template_task_key": string | null,"template_version_id": string | null,"title": string,"updated_at": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_by"?: string | null,"assigned_to"?: string | null,"blocked_auto"?: boolean,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"deliverables"?: string,"description"?: string,"due_at"?: string | null,"due_source"?: string,"due_was_clamped"?: boolean,"id"?: string,"is_cross_team"?: boolean,"offset_anchor"?: string | null,"offset_days"?: number | null,"parent_task_id"?: string | null,"priority"?: string,"project_id": string,"request_state"?: string | null,"requesting_department_id": string,"requires_review"?: boolean,"responsible_department_id": string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"source"?: string,"status"?: string,"submitted_at"?: string | null,"template_task_key"?: string | null,"template_version_id"?: string | null,"title": string,"updated_at"?: string,"visibility"?: string
                  }
                  Update: {
                    "assigned_by"?: string | null,"assigned_to"?: string | null,"blocked_auto"?: boolean,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"deliverables"?: string,"description"?: string,"due_at"?: string | null,"due_source"?: string,"due_was_clamped"?: boolean,"id"?: string,"is_cross_team"?: boolean,"offset_anchor"?: string | null,"offset_days"?: number | null,"parent_task_id"?: string | null,"priority"?: string,"project_id"?: string,"request_state"?: string | null,"requesting_department_id"?: string,"requires_review"?: boolean,"responsible_department_id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"source"?: string,"status"?: string,"submitted_at"?: string | null,"template_task_key"?: string | null,"template_version_id"?: string | null,"title"?: string,"updated_at"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subtask_same_project"
      columns: ["parent_task_id","project_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","project_id"]
    },{
      foreignKeyName: "tasks_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_requesting_department_id_fkey"
      columns: ["requesting_department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_responsible_department_id_fkey"
      columns: ["responsible_department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_template_version_id_fkey"
      columns: ["template_version_id"]
isOneToOne: false
      referencedRelation: "template_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"template_versions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"definition": NonNullable<Json>,"id": string,"template_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"definition": NonNullable<Json>,"id"?: string,"template_id": string,"version": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"definition"?: NonNullable<Json>,"id"?: string,"template_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "template_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "template_versions_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "templates"
      referencedColumns: ["id"]
    }
                  ]
                },"templates": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"current_version_id": string | null,"department_id": string | null,"description": string,"id": string,"key": string,"kind": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"current_version_id"?: string | null,"department_id"?: string | null,"description"?: string,"id"?: string,"key": string,"kind": string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"current_version_id"?: string | null,"department_id"?: string | null,"description"?: string,"id"?: string,"key"?: string,"kind"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "templates_current_version_fk"
      columns: ["current_version_id"]
isOneToOne: false
      referencedRelation: "template_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "templates_department_id_fkey"
      columns: ["department_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    }
                  ]
                },"year_transitions": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"from_year_id": string,"id": string,"started_by": string | null,"status": string,"to_year_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"from_year_id": string,"id"?: string,"started_by"?: string | null,"status"?: string,"to_year_id"?: string | null
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"from_year_id"?: string,"id"?: string,"started_by"?: string | null,"status"?: string,"to_year_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "year_transitions_from_year_id_fkey"
      columns: ["from_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "year_transitions_started_by_fkey"
      columns: ["started_by"]
isOneToOne: false
      referencedRelation: "executives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "year_transitions_to_year_id_fkey"
      columns: ["to_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "api">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "api": {
          Enums: {
            
          }
        },"os": {
          Enums: {
            
          }
        }
} as const
