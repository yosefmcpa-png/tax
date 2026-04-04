import { ActionType } from '@/types'

// ============================================================
// Automation Engine Types
// ============================================================

export type TriggerType =
  | 'manual'          // הפעלה ידנית
  | 'schedule'        // לוח זמנים (cron)
  | 'new_case'        // כשנפתח תיק חדש
  | 'keyword'         // כשמילת מפתח מופיעה בתיק

export type StepType =
  | 'ai_action'       // קריאה לסוכן AI
  | 'condition'       // תנאי if/else
  | 'notify'          // התראה (email/SMS עתידי)
  | 'export'          // ייצוא דוח

export interface WorkflowStep {
  id:         string
  type:       StepType
  label:      string
  config:     StepConfig
  onSuccess?: string   // id של השלב הבא בהצלחה
  onError?:   string   // id של השלב הבא בכישלון
}

export type StepConfig =
  | AiActionConfig
  | ConditionConfig
  | NotifyConfig
  | ExportConfig

export interface AiActionConfig {
  kind:        'ai_action'
  actionType:  ActionType
  promptExtra?: string   // הוראות נוספות לפרומפט
  useContext:  boolean   // השתמש בתוצאת השלב הקודם כקונטקסט
}

export interface ConditionConfig {
  kind:      'condition'
  field:     string    // שדה לבדיקה ב-context
  operator:  'contains' | 'not_contains' | 'equals'
  value:     string
  stepTrue:  string    // id של השלב אם התנאי נכון
  stepFalse: string    // id של השלב אם התנאי לא נכון
}

export interface NotifyConfig {
  kind:    'notify'
  channel: 'dashboard'  // בשלב זה רק dashboard, בעתיד: email, webhook
  message: string
}

export interface ExportConfig {
  kind:   'export'
  format: 'markdown' | 'json'
}

export interface Workflow {
  id:          string
  userId:      string
  name:        string
  description: string
  trigger:     TriggerType
  triggerConfig?: {
    cron?:     string    // "0 9 * * 1"  — כל שני ב-9:00
    keywords?: string[]  // מילות מפתח להפעלה אוטומטית
  }
  steps:       WorkflowStep[]
  enabled:     boolean
  createdAt:   string
  lastRunAt?:  string
  lastRunStatus?: 'success' | 'error' | 'running'
}

export interface WorkflowRun {
  id:         string
  workflowId: string
  userId:     string
  status:     'running' | 'success' | 'error'
  steps:      WorkflowStepResult[]
  startedAt:  string
  endedAt?:   string
  error?:     string
}

export interface WorkflowStepResult {
  stepId:    string
  label:     string
  status:    'pending' | 'running' | 'success' | 'error' | 'skipped'
  output?:   string
  error?:    string
  startedAt?: string
  endedAt?:  string
}

// ── Built-in Workflow Templates ──────────────────────────────
export const WORKFLOW_TEMPLATES: Omit<Workflow, 'id' | 'userId' | 'createdAt'>[] = [
  {
    name:        'ניתוח מסמך מלא',
    description: 'ניתוח + סיכום + הערכת סיכונים + מכתב ערעור בלחיצה אחת',
    trigger:     'manual',
    enabled:     true,
    steps: [
      {
        id: 'step-1', type: 'ai_action', label: 'ניתוח המסמך',
        config: { kind: 'ai_action', actionType: 'analyze', useContext: false },
        onSuccess: 'step-2',
      },
      {
        id: 'step-2', type: 'ai_action', label: 'סיכום מנהלים',
        config: { kind: 'ai_action', actionType: 'summarize', useContext: true },
        onSuccess: 'step-3',
      },
      {
        id: 'step-3', type: 'ai_action', label: 'הערכת סיכונים',
        config: { kind: 'ai_action', actionType: 'risk', useContext: true },
        onSuccess: 'step-4',
      },
      {
        id: 'step-4', type: 'ai_action', label: 'טיוטת ערעור',
        config: { kind: 'ai_action', actionType: 'appeal', useContext: true },
      },
    ],
  },
  {
    name:        'חבילת לקוח מלאה',
    description: 'סיכום + מייל ללקוח + רשימת מסמכים + המלצות תכנון',
    trigger:     'manual',
    enabled:     true,
    steps: [
      {
        id: 'step-1', type: 'ai_action', label: 'סיכום',
        config: { kind: 'ai_action', actionType: 'summarize', useContext: false },
        onSuccess: 'step-2',
      },
      {
        id: 'step-2', type: 'ai_action', label: 'מייל ללקוח',
        config: { kind: 'ai_action', actionType: 'email', useContext: true },
        onSuccess: 'step-3',
      },
      {
        id: 'step-3', type: 'ai_action', label: 'רשימת מסמכים',
        config: { kind: 'ai_action', actionType: 'checklist', useContext: true },
        onSuccess: 'step-4',
      },
      {
        id: 'step-4', type: 'ai_action', label: 'המלצות תכנון מס',
        config: { kind: 'ai_action', actionType: 'planning', useContext: true },
      },
    ],
  },
  {
    name:        'מחקר + פסיקה + חיזוי',
    description: 'מחקר מעמיק, השוואה לפסיקה, וחיזוי תוצאות',
    trigger:     'manual',
    enabled:     true,
    steps: [
      {
        id: 'step-1', type: 'ai_action', label: 'מחקר מס',
        config: { kind: 'ai_action', actionType: 'research', useContext: false },
        onSuccess: 'step-2',
      },
      {
        id: 'step-2', type: 'ai_action', label: 'השוואה לפסיקה',
        config: { kind: 'ai_action', actionType: 'compare', useContext: true },
        onSuccess: 'step-3',
      },
      {
        id: 'step-3', type: 'ai_action', label: 'חיזוי תוצאות',
        config: { kind: 'ai_action', actionType: 'predict', useContext: true },
      },
    ],
  },
]
