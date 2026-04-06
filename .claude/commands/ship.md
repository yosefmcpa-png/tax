# Ship Feature

לפני push של feature:

1. הרץ `npx tsc --noEmit` — חייב להיות 0 שגיאות
2. הרץ `npm run build` — חייב לעבור
3. בדוק שאין secrets בקוד (ANTHROPIC_API_KEY, passwords)
4. כתוב commit message תיאורי בעברית + אנגלית
5. Push ל-branch הנכון: `claude/hebrew-tax-calculator-ZxcUv`
