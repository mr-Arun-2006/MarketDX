
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

import LandingPage     from './pages/public/LandingPage.jsx'
import PublicDashboard from './pages/public/PublicDashboard.jsx'

import UserLoginPage   from './pages/auth/UserLoginPage.jsx'
import UserSignupPage  from './pages/auth/UserSignupPage.jsx'
import AdminLoginPage  from './pages/auth/AdminLoginPage.jsx'

import UserLayout      from './components/layout/UserLayout.jsx'
import UserDashboard   from './pages/user/UserDashboard.jsx'
import UserReport      from './pages/user/UserReport.jsx'
import UserAIChat      from './pages/user/UserAIChat.jsx'
import UserIndicators  from './pages/user/UserIndicators.jsx'

import AdminLayout     from './components/layout/AdminLayout.jsx'
import AdminDashboard  from './pages/admin/AdminDashboard.jsx'
import AdminUsers      from './pages/admin/AdminUsers.jsx'
import AdminMarket     from './pages/admin/AdminMarket.jsx'

function RequireUser({ children }) {
  const { token, role } = useAuthStore()
  if (!token) return <Navigate to="/login/user" replace />
  if (role === 'admin') return <Navigate to="/admin" replace />
  return children
}

function RequireAdmin({ children }) {
  const { token, role } = useAuthStore()
  if (!token) return <Navigate to="/login/admin" replace />
  if (role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* PUBLIC ROUTES */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<PublicDashboard />} />

        <Route path="/login/user"  element={<UserLoginPage />} />
        <Route path="/signup"      element={<UserSignupPage />} />
        <Route path="/login/admin" element={<AdminLoginPage />} />

        {/* USER ROUTES */}
        <Route path="/app" element={<RequireUser><UserLayout /></RequireUser>}>
          <Route path="dashboard"  element={<UserDashboard />} />
          <Route path="indicators" element={<UserIndicators />} />
          <Route path="report"     element={<UserReport />} />
          <Route path="ai-chat"    element={<UserAIChat />} />
        </Route>

        {/* ADMIN ROUTES */}
        <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index          element={<AdminDashboard />} />
          <Route path="users"   element={<AdminUsers />} />
          <Route path="market"  element={<AdminMarket />} />
        </Route>

      </Routes>
    </BrowserRouter>
  )
}
