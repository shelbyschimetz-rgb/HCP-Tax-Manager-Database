/**
 * Config — table schemas, enums, and script-property keys.
 *
 * Every table is one tab in the master "Tax Manager DB" spreadsheet. Row 1 is
 * the header; columns are looked up by header name, so adding / reordering
 * columns in the sheet is safe. All cells are stored as plain text (dates as
 * YYYY-MM-DD, timestamps as ISO-8601 UTC) so Sheets never auto-converts them.
 *
 * Column type codes: s = string (default), n = number, b = boolean, j = JSON.
 */

var PROP = {
  DB_ID: 'DB_SPREADSHEET_ID',
  SFDC_SHEET_ID: 'SFDC_SOURCE_SHEET_ID',
  SFDC_TAB: 'SFDC_SOURCE_TAB',
  DRIVE_PARENT: 'DRIVE_PARENT_FOLDER_ID',
  EMAIL_DOMAIN: 'EMAIL_DOMAIN',
  TIMER_MAX_HOURS: 'TIMER_MAX_HOURS',
  LAST_SFDC_SYNC: 'LAST_SFDC_SYNC',
  LAST_SFDC_RESULT: 'LAST_SFDC_RESULT',
  EXPORT_SHEET_ID: 'EXPORT_SHEET_ID',
  LAST_EXPORT: 'LAST_EXPORT',
  SCHEMA_SIG: 'SCHEMA_SIG',
  CHURN_SHEET_ID: 'CHURN_SHEET_ID',
  CHURN_TAB: 'CHURN_TAB',
  CHURN_ENABLED: 'CHURN_ENABLED',
  LAST_CHURN: 'LAST_CHURN',
};

var DEFAULTS = {
  EMAIL_DOMAIN: 'housecallpro.com',
  TIMER_MAX_HOURS: 8,
  SFDC_TAB: '',
  // "Bizsol Retention Data - All Time" → Tax tab
  CHURN_SHEET_ID: '1VfM9lRbnGEE2-k9f4_StW_QP16bcRk5_d-gGrNZvjvo',
  CHURN_TAB: 'Tax',
};

var AUDIT_COLS = ['created_at', 'created_by', 'updated_at', 'updated_by', 'row_version'];
var ARCHIVE_COLS = ['archived', 'archived_at', 'archived_by', 'archive_reason'];

function ownerCols_(n) {
  return ['owner' + n + '_name', 'owner' + n + '_phone', 'owner' + n + '_email', 'owner' + n + '_pct'];
}

var SCHEMA = {
  Pros: {
    key: 'org_id',
    cols: [
      'org_id', 'business_name', 'dba', 'vertical', 'state', 'time_zone', 'year_started',
      'scope_start_date', 'entity_type', 'lifecycle_status',
      'assigned_advisor_email', 'advisor_assigned_at', 'assigned_os_email', 'needs_os_assignment',
      'bk_lead_email', 'payroll_servicer',
    ].concat(ownerCols_(1), ownerCols_(2), ownerCols_(3), [
      'doc_collection_status', 'books_with_hcp', 'prior_books_status', 'books_access', 'inha_remarks',
      'at_risk', 'at_risk_reason', 'last_advisor_touchpoint', 'last_filing_year',
      'drive_folder_id', 'drive_folder_url', 'sfdc_case_number',
      'onboarding_claimed_by', 'onboarding_claimed_at', 'intake_state', 'source_ref',
    ], ARCHIVE_COLS, AUDIT_COLS),
    types: {
      year_started: 'n', last_filing_year: 'n', owner1_pct: 'n', owner2_pct: 'n', owner3_pct: 'n',
      books_with_hcp: 'b', at_risk: 'b', archived: 'b', needs_os_assignment: 'b', row_version: 'n',
      intake_state: 'j',
    },
  },
  Projects: {
    key: 'project_id',
    cols: [
      'project_id', 'org_id', 'filing_type', 'tax_year', 'pipeline_status', 'blocker_reason',
      'filing_deadline', 'project_start_date', 'efile_date', 'extension_needed', 'extension_filed',
      'tax_advisor_email', 'tax_preparer_email', 'peer_reviewer_email', 'os_email',
      'complexity', 'states_covered', 'tax_risk_level', 'books_status', 'billing_kind', 'add_ons',
      'stage_changed_at', 'source_ref',
    ].concat(ARCHIVE_COLS, AUDIT_COLS),
    types: { tax_year: 'n', extension_needed: 'b', extension_filed: 'b', archived: 'b', row_version: 'n' },
  },
  Tasks: {
    key: 'task_id',
    cols: [
      'task_id', 'entity_type', 'entity_id', 'parent_task_id', 'section', 'title',
      'assignee_email', 'assignee_role', 'due_date', 'due_anchor', 'offset_days', 'status', 'sort_order',
      'blocked_by', 'checklist', 'template_id', 'template_version', 'completed_at', 'completed_by',
    ].concat(AUDIT_COLS),
    types: { sort_order: 'n', offset_days: 'n', row_version: 'n', checklist: 'j' },
  },
  TasksArchive: {
    key: 'task_id',
    cols: [
      'task_id', 'entity_type', 'entity_id', 'parent_task_id', 'section', 'title',
      'assignee_email', 'assignee_role', 'due_date', 'due_anchor', 'offset_days', 'status', 'sort_order',
      'blocked_by', 'checklist', 'template_id', 'template_version', 'completed_at', 'completed_by',
    ].concat(AUDIT_COLS, ['cleared_at', 'cleared_by', 'cleared_reason']),
    types: { sort_order: 'n', offset_days: 'n', row_version: 'n', checklist: 'j' },
  },
  ChurnLog: {
    key: 'org_id',
    cols: ['org_id', 'business_name', 'lost_cases', 'action', 'projects_archived', 'processed_at', 'note'],
    types: { lost_cases: 'n', projects_archived: 'n' },
  },
  TaskTemplates: {
    key: 'template_id',
    cols: [
      'template_id', 'scope', 'section', 'title', 'default_role', 'due_anchor', 'offset_days',
      'active', 'sort_order', 'checklist', 'filing_types', 'parent_template_id', 'blocked_by_template_ids',
    ].concat(AUDIT_COLS),
    types: { offset_days: 'n', sort_order: 'n', active: 'b', row_version: 'n', checklist: 'j' },
  },
  TemplateVersions: {
    key: 'version_id',
    cols: ['version_id', 'scope', 'version', 'note', 'task_count', 'created_at', 'created_by', 'snapshot'],
    types: { version: 'n', task_count: 'n', snapshot: 'j' },
  },
  AuditLog: {
    key: 'audit_id',
    cols: ['audit_id', 'ts', 'actor_email', 'entity_type', 'entity_id', 'action', 'field', 'from_value', 'to_value'],
    types: {},
  },
  Notes: {
    key: 'note_id',
    cols: ['note_id', 'entity_type', 'entity_id', 'author_email', 'body', 'created_at', 'edited_at', 'deleted'],
    types: { deleted: 'b' },
  },
  TimeEntries: {
    key: 'entry_id',
    cols: ['entry_id', 'project_id', 'user_email', 'started_at', 'stopped_at', 'duration_min', 'auto_stopped', 'note'],
    types: { duration_min: 'n', auto_stopped: 'b' },
  },
  ProjectStageHistory: {
    key: 'history_id',
    cols: ['history_id', 'project_id', 'from_stage', 'to_stage', 'changed_at', 'changed_by', 'advisor_email', 'days_in_prev_stage'],
    types: { days_in_prev_stage: 'n' },
  },
  OutstandingItems: {
    key: 'item_id',
    cols: ['item_id', 'project_id', 'item', 'owner_email', 'due_date', 'created_at', 'created_by', 'resolved', 'resolved_at'],
    types: { resolved: 'b' },
  },
  Identity: {
    key: 'email',
    cols: ['name', 'email', 'active', 'roles', 'accepting_new', 'color'],
    types: { active: 'b', accepting_new: 'b' },
  },
  SfdcIntakeQueue: {
    key: 'sfdc_opportunity_id',
    cols: [
      'sfdc_opportunity_id', 'org_id', 'business_name', 'case_owner', 'resolved_os_email',
      'service_days', 'sub_status_notes', 'created_date', 'date_closed', 'case_record_type',
      'state', 'claimed_by', 'claimed_at', 'dismissed_by', 'dismissed_at', 'imported_at',
    ],
    types: { service_days: 'n' },
  },
  PeerReviews: {
    key: 'review_id',
    cols: [
      'review_id', 'project_id', 'org_id', 'business_name', 'tax_year', 'filing_type', 'status',
      'safe_harbor_amount', 'add_ons', 'advisor_email', 'comments', 'submitted_by', 'submitted_at',
      'reviewer_email', 'claimed_at', 'round', 'rework_count', 'last_rework_notes', 'last_rework_at', 'resubmitted_at',
      'completed_at', 'completed_by', 'completion_notes', 'cancelled_at', 'cancel_reason',
      'review_task_id', 'rework_task_id', 'events',
    ].concat(AUDIT_COLS),
    types: { tax_year: 'n', round: 'n', rework_count: 'n', row_version: 'n', events: 'j' },
  },
  IntakeAnswers: {
    key: 'answer_id',
    cols: ['answer_id', 'org_id', 'branch', 'question', 'answer', 'notes', 'source', 'source_ref', 'answered_at', 'answered_by', 'is_current'],
    types: { is_current: 'b' },
  },
};

var ENUMS = {
  LIFECYCLE_STATUS: ['CLOSED_WON', 'ONBOARDING_SCHEDULED', 'ONBOARDED', 'ACTIVE_PROJECT', 'ADVISORY_ONLY', 'PASS_BACK'],
  PIPELINE_STATUS: ['IN_QUEUE', 'IN_QUEUE_ESCALATED', 'DOC_GATHERING', 'PREP', 'WFP', 'QA', 'CLIENT_REVIEW', 'FILING_DELIVERY', 'COMPLETE', 'BLOCKED'],
  PIPELINE_SEQUENCE: ['IN_QUEUE', 'DOC_GATHERING', 'PREP', 'WFP', 'QA', 'CLIENT_REVIEW', 'FILING_DELIVERY', 'COMPLETE'],
  FILING_TYPE: ['F1040_SCHC', 'F1040', 'S_CORP', 'PARTNERSHIP', 'C_CORP', 'AMENDMENT', 'S_CORP_ELECTION', 'LLC_FORMATION', 'DISSOLUTION', 'UNKNOWN'],
  ENTITY_TYPE: ['SOLE_PROP_SCHED_C', 'PARTNERSHIP', 'S_CORP', 'C_CORP'],
  DOC_COLLECTION_STATUS: ['WAITING', 'PARTIAL', 'RECEIVED'],
  TASK_STATUS: ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'SKIPPED'],
  ROLE: ['ADVISOR', 'PREPARER', 'PEER_REVIEWER', 'OS', 'BK', 'BK_LEAD', 'BK_TEAM_LEAD', 'EXEC', 'ADMIN'],
  COMPLEXITY: ['LOW', 'MED', 'HIGH'],
  DUE_ANCHOR: ['CLAIMED_AT', 'PROJECT_START', 'FILING_DEADLINE', 'EFILE_DATE', 'NONE'],
  PEER_REVIEW_STATUS: ['SUBMITTED', 'IN_REVIEW', 'REWORK', 'COMPLETE', 'CANCELLED'],
  PEER_REVIEW_ADD_ONS: [
    'Additional K-1s', 'Additional State(s)', 'Form 2553 Timely', 'Form 2553 Late', 'Schedule A', 'Schedule B',
    'Schedule C', 'Schedule D', 'Schedule E', 'Schedule H', 'Form 8959/8960', 'No add-ons',
  ],
};

var LABELS = {
  LIFECYCLE_STATUS: {
    CLOSED_WON: 'Closed-won', ONBOARDING_SCHEDULED: 'Onboarding scheduled', PASS_BACK: 'Pass back',
    ONBOARDED: 'Onboarded', ADVISORY_ONLY: 'Advisory only', ACTIVE_PROJECT: 'Active project',
  },
  PIPELINE_STATUS: {
    IN_QUEUE: 'In queue', IN_QUEUE_ESCALATED: 'In queue (escalated)', DOC_GATHERING: 'Doc gathering',
    PREP: 'Prep', WFP: 'Waiting for pro', QA: 'QA', CLIENT_REVIEW: 'Client review',
    FILING_DELIVERY: 'Filing & delivery', COMPLETE: 'Complete', BLOCKED: 'Blocked',
  },
  FILING_TYPE: {
    F1040_SCHC: '1040 + Sched C', F1040: '1040 only', S_CORP: 'S-Corp', PARTNERSHIP: 'Partnership', C_CORP: 'C-Corp',
    AMENDMENT: 'Amendment', S_CORP_ELECTION: 'S-Corp election', LLC_FORMATION: 'LLC formation',
    DISSOLUTION: 'Dissolution', UNKNOWN: 'Unknown',
  },
  ENTITY_TYPE: { SOLE_PROP_SCHED_C: 'Sole prop / Sched C', PARTNERSHIP: 'Partnership', S_CORP: 'S-Corp', C_CORP: 'C-Corp' },
  DOC_COLLECTION_STATUS: { WAITING: 'Waiting', RECEIVED: 'Received', PARTIAL: 'Partial' },
  PEER_REVIEW_STATUS: {
    SUBMITTED: 'Waiting for reviewer', IN_REVIEW: 'In review', REWORK: 'Needs rework', COMPLETE: 'Review complete', CANCELLED: 'Cancelled',
  },
  TASK_SECTION: {
    ONBOARDING_SETUP: 'Onboarding & Setup', RETURN_PREP_KICKOFF: 'Return Prep Kickoff', ADVISORY_WORK: 'Advisory Work',
    DOC_GATHERING: 'Document Gathering', EXTENSION: 'Extension', PREP: 'Tax Return Preparation',
    INTERNAL_REVIEW_QC: 'Internal Review / QC', CLIENT_REVIEW: 'Client Review', FILING_DELIVERY: 'Filing & Delivery',
  },
};

/** Task section → pipeline stage it belongs to (used by migration to pre-complete earlier sections). */
var SECTION_STAGE = {
  DOC_GATHERING: 'DOC_GATHERING', EXTENSION: 'DOC_GATHERING', PREP: 'PREP',
  INTERNAL_REVIEW_QC: 'QA', CLIENT_REVIEW: 'CLIENT_REVIEW', FILING_DELIVERY: 'FILING_DELIVERY',
};

/** Default filing deadline (month-day, following year) per filing type. */
var DEADLINE_MMDD = {
  F1040_SCHC: '04-15', F1040: '04-15', S_CORP: '03-15', PARTNERSHIP: '03-15', C_CORP: '04-15',
};

var FILING_CODE = {
  F1040_SCHC: '1040', F1040: '1040ONLY', S_CORP: 'SCORP', PARTNERSHIP: 'PSHIP', C_CORP: 'CCORP', AMENDMENT: 'AMEND',
  S_CORP_ELECTION: 'SCELECT', LLC_FORMATION: 'LLC', DISSOLUTION: 'DISSOLVE', UNKNOWN: 'OTHER',
};

function getProp_(key, fallback) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  return v == null || v === '' ? (fallback == null ? '' : fallback) : v;
}

function setProp_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value == null ? '' : String(value));
}
