import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'
import TopBar from '@/components/layout/TopBar'
import Sidebar from '@/components/layout/Sidebar'

// Canvas — client only (window API)
const WormholeCanvas = dynamic(() => import('@/components/canvas/WormholeCanvas'), { ssr: false })
const ChatInterface  = dynamic(() => import('@/components/chat/ChatInterface'),   { ssr: false })

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="relative h-screen flex flex-col overflow-hidden">
      <WormholeCanvas />
      <TopBar />
      <div className="flex flex-1 overflow-hidden relative z-10">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <ChatInterface />
        </main>
      </div>
    </div>
  )
}
