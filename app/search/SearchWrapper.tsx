'use client'
import dynamic from 'next/dynamic'
const SearchClient = dynamic(() => import('./SearchClient'), { ssr: false })
export default function SearchWrapper() { return <SearchClient /> }
