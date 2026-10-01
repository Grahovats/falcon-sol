import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AdminRoute } from './components/AdminRoute'
import { AppShell } from './layouts/AppShell'
import { AdminPage } from './pages/AdminPage'
import { HomePage } from './pages/HomePage'
import { MissionDetailPage } from './pages/MissionDetailPage'
import { MissionsPage } from './pages/MissionsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProfilePage } from './pages/ProfilePage'
import { RankingsPage } from './pages/RankingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="missions" element={<MissionsPage />} />
          <Route path="missions/:id" element={<MissionDetailPage />} />
          <Route path="rankings" element={<RankingsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
