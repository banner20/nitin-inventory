import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider'
import { RequireAuth, RequireManager } from '@/components/guards'
import { supabaseConfigured } from '@/lib/supabase'
import SetupScreen from '@/components/SetupScreen'
import CrewShell from '@/components/CrewShell'
import AdminShell from '@/components/AdminShell'
import LoginScreen from '@/features/auth/LoginScreen'
import CrewHome from '@/features/crew/CrewHome'
import Me from '@/features/crew/Me'
import TakeOut from '@/features/crew/TakeOut'
import BringBack from '@/features/crew/BringBack'
import Events from '@/features/admin/Events'
import People from '@/features/admin/People'
import MasterSheet from '@/features/admin/MasterSheet'
import StockIn from '@/features/admin/StockIn'
import ConflictQueue from '@/features/admin/ConflictQueue'

function LoginRoute() {
  const { session, profile } = useAuth()
  if (session && profile) return <Navigate to="/" replace />
  return <LoginScreen />
}

function Routing() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      <Route element={<RequireAuth />}>
        {/* Crew app — phone first */}
        <Route element={<CrewShell />}>
          <Route index element={<CrewHome />} />
          <Route path="out" element={<TakeOut />} />
          <Route path="in" element={<BringBack />} />
          <Route path="me" element={<Me />} />
        </Route>

        {/* Admin console — desktop, manager and admin only */}
        <Route element={<RequireManager />}>
          <Route path="admin" element={<AdminShell />}>
            <Route index element={<MasterSheet />} />
            <Route path="stock-in" element={<StockIn />} />
            <Route path="conflicts" element={<ConflictQueue />} />
            <Route path="events" element={<Events />} />
            <Route path="people" element={<People />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  if (!supabaseConfigured) return <SetupScreen />

  return (
    <AuthProvider>
      <Routing />
    </AuthProvider>
  )
}
