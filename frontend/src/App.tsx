import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'

import DashboardPage       from './pages/dashboard/DashboardPage'
import SettingsPage        from './pages/settings/SettingsPage'
import ExamsPage           from './pages/exams/ExamsPage'
import ExamLayout          from './pages/exams/ExamLayout'
import BranchesPage        from './pages/exams/branches/BranchesPage'
import SchedulePage        from './pages/exams/schedule/SchedulePage'
import RoomAssignmentsPage from './pages/exams/rooms/RoomAssignmentsPage'
import TeachersPage        from './pages/exams/teachers/TeachersPage'
import ConfigPage          from './pages/exams/config/ConfigPage'
import DistributionPage    from './pages/exams/distribution/DistributionPage'
import DocumentsPage       from './pages/documents/DocumentsPage'
import TeachersGlobalPage  from './pages/teachers/TeachersGlobalPage'
import FilieresGlobalPage  from './pages/filieres/FilieresGlobalPage'

const NotFound = () => (
  <div className="animate-fade-up" style={{ padding: '60px 32px', textAlign: 'center' }}>
    <h1 style={{ fontSize: '40px', color: 'var(--border-2)', fontFamily: 'var(--font-head)' }}>404</h1>
    <p style={{ color: 'var(--muted)', marginTop: '8px' }}>Page introuvable</p>
  </div>
)

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />

        <Route path="dashboard"  element={<DashboardPage      />} />
        <Route path="settings"   element={<SettingsPage       />} />
        <Route path="exams"      element={<ExamsPage          />} />
        <Route path="documents"  element={<DocumentsPage      />} />
        <Route path="teachers"   element={<TeachersGlobalPage />} />
        <Route path="filieres"   element={<FilieresGlobalPage />} />

        {/* Exam nested routes */}
        <Route path="exams/:examId" element={<ExamLayout />}>
          <Route index element={<Navigate to="branches" replace />} />
          <Route path="branches"     element={<BranchesPage        />} />
          <Route path="schedule"     element={<SchedulePage         />} />
          <Route path="rooms"        element={<RoomAssignmentsPage  />} />
          <Route path="teachers"     element={<TeachersPage         />} />
          <Route path="config"       element={<ConfigPage           />} />
          <Route path="distribution" element={<DistributionPage     />} />
        </Route>

        {/* Legacy redirect */}
        <Route path="assignment" element={<Navigate to="/exams" replace />} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
