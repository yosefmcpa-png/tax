import HomeClient from '@/components/home/HomeClient'

// supports both Supabase session and local cookie session (set by /login quick-login)
export default function HomePage() {
  return <HomeClient />
}
