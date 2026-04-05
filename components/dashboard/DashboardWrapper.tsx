'use client'

import dynamic from 'next/dynamic'
import TopBar from '@/components/layout/TopBar'
import Sidebar from '@/components/layout/Sidebar'

const WormholeCanvas    = dynamic(() => import('@/components/canvas/WormholeCanvas'), { ssr: false })
const DashboardClient   = dynamic(() => import('./DashboardClient'),                   { ssr: false })

interface Props {
  stats:  unknown
  userId: string
}

export default function DashboardWrapper({ stats, userId }: Props) {
  return (
    <div className="relative h-screen flex flex-col overflow-hidden">
      <WormholeCanvas />
      <TopBar />
      <div className="flex flex-1 overflow-hidden relative z-10">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <DashboardClient stats={stats as never} userId={userId} />
        </main>
      </div>
    </div>
  )
}
