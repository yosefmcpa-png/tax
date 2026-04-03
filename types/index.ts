// ============================================================
// Tax Solver — Global TypeScript Types
// ============================================================

// --- Supabase DB Row Types ---
export interface DbUser {
  id: string
  email: string
  full_name?: string
  created_at: string
}

export interface DbCase {
  id: string
  user_id: string
  title: string
  status: 'open' | 'closed' | 'pending'
  case_type: 'research' | 'document' | 'simulation'
  created_at: string
  updated_at: string
}

export interface DbConversation {
  id: string
  case_id: string
  role: 'user' | 'model'
  content: string
  sources: Source[]
  action_type: ActionType | null
  token_count: number | null
  created_at: string
}

export interface DbDocument {
  id: string
  case_id: string
  filename: string
  content_preview: string   // ראשון 500 תווים בלבד
  word_count: number
  created_at: string
}

export interface DbAuditLog {
  id: string
  user_id: string
  case_id: string | null
  action_type: string
  input_tokens: number | null
  output_tokens: number | null
  success: boolean
  error_message: string | null
  ip_address: string | null
  created_at: string
}

// --- Agent Types ---
export type ActionType =
  | 'research'
  | 'analyze'
  | 'summarize'
  | 'explain'
  | 'email'
  | 'risk'
  | 'agenda'
  | 'international'
  | 'predict'
  | 'checklist'
  | 'appeal'
  | 'planning'
  | 'compare'
  | 'extract'
  | 'followup'
  | 'simulation'

export const ALLOWED_ACTIONS: ActionType[] = [
  'research', 'analyze', 'summarize', 'explain', 'email',
  'risk', 'agenda', 'international', 'predict', 'checklist',
  'appeal', 'planning', 'compare', 'extract', 'followup', 'simulation',
]

export interface Source {
  title: string
  uri: string
}

export interface ConversationMessage {
  role: 'user' | 'model'
  content: string
  sources?: Source[]
  actionType?: ActionType | null
}

// --- API Request/Response Types ---
export interface AgentRequest {
  query: string
  actionType: ActionType
  caseId?: string
  history?: ConversationMessage[]
  isGrounded?: boolean
}

export interface AgentResponse {
  text: string
  sources: Source[]
  caseId: string
  conversationId: string
  tokenCount?: number
}

export interface ExtractedData {
  document_type: string
  document_date: string
  deadlines: string[]
  involved_parties: string[]
  disputed_amounts: Array<{ amount: number; currency: string }>
  mentioned_law_sections: string[]
}

// --- UI State Types ---
export interface CaseWithPreview extends DbCase {
  last_message?: string
  message_count?: number
}

export interface UIMessage extends ConversationMessage {
  id: string
  timestamp: Date
  isLoading?: boolean
  error?: boolean
}
