import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ============================================================
// Rate Limiter — הגנה מפני שימוש לרעה
// ============================================================

// Sliding window: 20 בקשות לדקה למשתמש
export const agentRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  analytics: true,
  prefix: 'tax-solver:agent',
})

// TTS — מוגבל יותר (יקר יותר)
export const ttsRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  analytics: true,
  prefix: 'tax-solver:tts',
})
