import { create } from 'zustand'
import { UIMessage, Source, ActionType, CaseWithPreview } from '@/types'

// ============================================================
// Zustand Store — ניהול מצב גלובלי
// ============================================================

interface CaseStore {
  // --- Cases list ---
  cases:     CaseWithPreview[]
  setCases:  (cases: CaseWithPreview[]) => void

  // --- Active case ---
  activeCaseId:    string | null
  setActiveCaseId: (id: string | null) => void

  // --- Chat messages ---
  messages:      UIMessage[]
  addMessage:    (msg: Omit<UIMessage, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, updates: Partial<UIMessage>) => void
  setMessages:   (msgs: UIMessage[]) => void
  clearMessages: () => void

  // --- Loading state ---
  isLoading:    boolean
  setIsLoading: (v: boolean) => void
  loadingText:  string
  setLoadingText: (t: string) => void

  // --- Modal ---
  modalContent: { text: string; sources: Source[]; title: string } | null
  setModalContent: (c: { text: string; sources: Source[]; title: string } | null) => void

  // --- Source filters ---
  sourceGov:    boolean
  sourceNews:   boolean
  sourceForums: boolean
  toggleSource: (key: 'sourceGov' | 'sourceNews' | 'sourceForums') => void
}

export const useCaseStore = create<CaseStore>((set) => ({
  cases:         [],
  setCases:      (cases) => set({ cases }),

  activeCaseId:    null,
  setActiveCaseId: (id) => set({ activeCaseId: id }),

  messages:   [],
  addMessage: (msg) => {
    const id = crypto.randomUUID()
    set(state => ({
      messages: [...state.messages, { ...msg, id, timestamp: new Date() }],
    }))
    return id
  },
  updateMessage: (id, updates) => set(state => ({
    messages: state.messages.map(m => m.id === id ? { ...m, ...updates } : m),
  })),
  setMessages:   (msgs) => set({ messages: msgs }),
  clearMessages: ()     => set({ messages: [], activeCaseId: null }),

  isLoading:      false,
  setIsLoading:   (v) => set({ isLoading: v }),
  loadingText:    'מעבד...',
  setLoadingText: (t) => set({ loadingText: t }),

  modalContent:    null,
  setModalContent: (c) => set({ modalContent: c }),

  sourceGov:    true,
  sourceNews:   true,
  sourceForums: false,
  toggleSource: (key) => set(state => ({ [key]: !state[key] })),
}))

// ---- Helper: Action type → Loading text ----
export const ACTION_LOADING_TEXT: Record<ActionType, string> = {
  research:      'מבצע מחקר מס מעמיק...',
  analyze:       'מנתח את המסמך הרשמי...',
  summarize:     'מסכם את הדוח...',
  explain:       'מנסח הסבר פשוט...',
  email:         'מנסח מייל ללקוח...',
  risk:          'מעריך סיכונים...',
  agenda:        'יוצר סדר יום לפגישה...',
  international: 'מנתח היבטים בינלאומיים...',
  predict:       'מחשב תרחישים...',
  checklist:     'יוצר רשימת מסמכים...',
  appeal:        'מנסח מכתב ערעור...',
  planning:      'מזהה הזדמנויות תכנון מס...',
  compare:       'מחפש פסיקה רלוונטית...',
  extract:       'חולץ נתונים...',
  followup:      'מחפש תשובה לשאלתך...',
  simulation:    'מכין סימולציית דיון...',
}
