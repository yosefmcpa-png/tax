'use client'

import dynamic from 'next/dynamic'
import TopBar from '@/components/layout/TopBar'
import Sidebar from '@/components/layout/Sidebar'

const WormholeCanvas = dynamic(() => import('@/components/canvas/WormholeCanvas'), { ssr: false })
const ChatInterface  = dynamic(() => import('@/components/chat/ChatInterface'),    { ssr: false })

export default function HomeClient() {
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
