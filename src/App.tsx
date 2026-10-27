import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { CommandPalette } from './components/CommandPalette'

// Lazy-loaded routes for code splitting
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const MarketsPage = lazy(() => import('./pages/MarketsPage'))
const EventTerminalPage = lazy(() => import('./pages/EventTerminalPage'))
const DivergencePage = lazy(() => import('./pages/DivergencePage'))
const WalletsPage = lazy(() => import('./pages/WalletsPage'))
const WalletDetailPage = lazy(() => import('./pages/WalletDetailPage'))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'))
const PickJournalPage = lazy(() => import('./pages/PickJournalPage'))
const WalrusMemoryPage = lazy(() => import('./pages/WalrusMemoryPage'))
const AlertsPage = lazy(() => import('./pages/AlertsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const TradePage = lazy(() => import('./pages/TradePage'))

function LoadingFallback() {
  return (
    <div className="p-xl text-center font-mono text-xs text-quaternary flex items-center justify-center gap-sm">
      <span className="w-2 h-2 rounded-full bg-brand-solid animate-ping" />
      <span>Loading Terminal View...</span>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="p-xl text-center font-mono space-y-md">
      <h2 className="text-heading-xs font-bold text-primary">404 — View Not Found</h2>
      <p className="text-xs text-tertiary">The requested prediction terminal route does not exist.</p>
    </div>
  )
}

export default function App() {
  return (
    <AppLayout>
      <CommandPalette />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/markets" element={<MarketsPage />} />
          <Route path="/markets/:slug" element={<EventTerminalPage />} />
          <Route path="/trade" element={<TradePage />} />
          <Route path="/divergence" element={<DivergencePage />} />
          <Route path="/wallets" element={<WalletsPage />} />
          <Route path="/wallets/:address" element={<WalletDetailPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/journal" element={<PickJournalPage />} />
          <Route path="/memory" element={<WalrusMemoryPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppLayout>
  )
}
