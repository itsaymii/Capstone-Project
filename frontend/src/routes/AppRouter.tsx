import { Navigate, Route, Routes } from 'react-router-dom'

import { LoginPage } from '../pages/auth/login/LoginPage'
import { RegisterPage } from '../pages/auth/register/RegisterPage'
import { LandingPage } from '../pages/landing/LandingPage'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
