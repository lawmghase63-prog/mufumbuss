import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './layouts/DashboardLayout'
import ComingSoon from './components/ComingSoon'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import Profile from './pages/Profile'
import Students from './pages/Students'
import Subjects from './pages/Subjects'
import Assignments from './pages/Assignments'
import Teachers from './pages/Teachers'
import Exams from './pages/Exams'
import MarkEntry from './pages/MarkEntry'
import ResultsEntry from './pages/ResultsEntry'
import MyClasses from './pages/MyClasses'
import HeadmasterDashboard from './pages/dashboard/HeadmasterDashboard'
import AcademicDashboard from './pages/dashboard/AcademicDashboard'
import TeacherDashboard from './pages/dashboard/TeacherDashboard'
import type { Role } from './lib/types'

const Analysis = lazy(() => import('./pages/Analysis'))
const Reports = lazy(() => import('./pages/Reports'))
const Sms = lazy(() => import('./pages/Sms'))
const ViewResults = lazy(() => import('./pages/ViewResults'))
const Comparison = lazy(() => import('./pages/Comparison'))
const Landing = lazy(() => import('./pages/Landing'))
const JoiningInstructions = lazy(() => import('./pages/JoiningInstructions'))

const analysisFallback = (
  <div className="list-state">Loading analysis...</div>
)
const reportsFallback = (
  <div className="list-state">Loading reports...</div>
)
const smsFallback = (
  <div className="list-state">Loading SMS...</div>
)
const viewResultsFallback = (
  <div className="list-state">Loading results...</div>
)
const comparisonFallback = (
  <div className="list-state">Loading comparison...</div>
)

const ALL_ROLES: Role[] = ['headmaster', 'academic', 'teacher']

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/"
            element={
              <Suspense fallback={<div className="list-state">Loading...</div>}>
                <Landing />
              </Suspense>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute roles={ALL_ROLES}>
                <DashboardLayout>
                  <Profile />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/headmaster"
            element={
              <ProtectedRoute roles={['headmaster']}>
                <DashboardLayout>
                  <HeadmasterDashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
<Route
            path="/headmaster/students"
            element={
              <ProtectedRoute roles={['headmaster']}>
                <DashboardLayout>
                  <Students />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/headmaster/teachers"
            element={
              <ProtectedRoute roles={['headmaster']}>
                <DashboardLayout>
                  <Teachers />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/headmaster/view-results"
            element={
              <ProtectedRoute roles={ALL_ROLES}>
                <DashboardLayout>
                  <Suspense fallback={viewResultsFallback}><ViewResults /></Suspense>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/headmaster/reports"
            element={
              <ProtectedRoute roles={['headmaster']}>
                <DashboardLayout>
                  <Suspense fallback={reportsFallback}><Reports /></Suspense>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/headmaster/comparison"
            element={
              <ProtectedRoute roles={['headmaster']}>
                <DashboardLayout>
                  <Suspense fallback={comparisonFallback}><Comparison /></Suspense>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/headmaster/joining-instructions"
            element={
              <ProtectedRoute roles={['headmaster']}>
                <DashboardLayout>
                  <Suspense fallback={smsFallback}><JoiningInstructions /></Suspense>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/headmaster/:page"
            element={
              <ProtectedRoute roles={['headmaster']}>
                <DashboardLayout>
                  <ComingSoon />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/academic"
            element={
              <ProtectedRoute roles={['academic']}>
                <DashboardLayout>
                  <AcademicDashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/students"
            element={
              <ProtectedRoute roles={['academic']}>
                <DashboardLayout>
                  <Students />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/subjects"
            element={
              <ProtectedRoute roles={['academic']}>
                <DashboardLayout>
                  <Subjects />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/assignments"
            element={
              <ProtectedRoute roles={['academic']}>
                <DashboardLayout>
                  <Assignments />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/teachers"
            element={
              <ProtectedRoute roles={['academic']}>
                <DashboardLayout>
                  <Teachers />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/exams"
            element={
              <ProtectedRoute roles={['academic']}>
                <DashboardLayout>
                  <Exams />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/results"
            element={
              <ProtectedRoute roles={['academic']}>
                <DashboardLayout>
                  <ResultsEntry />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/reports"
            element={
              <ProtectedRoute roles={['academic']}>
                <DashboardLayout>
                  <Suspense fallback={reportsFallback}><Reports /></Suspense>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/analysis/:examId"
            element={
              <ProtectedRoute roles={['academic']}>
                <DashboardLayout>
                  <Suspense fallback={analysisFallback}><Analysis /></Suspense>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/sms"
            element={
              <ProtectedRoute roles={['academic']}>
                <DashboardLayout>
                  <Suspense fallback={smsFallback}><Sms /></Suspense>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/view-results"
            element={
              <ProtectedRoute roles={ALL_ROLES}>
                <DashboardLayout>
                  <Suspense fallback={viewResultsFallback}><ViewResults /></Suspense>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/joining-instructions"
            element={
              <ProtectedRoute roles={['academic']}>
                <DashboardLayout>
                  <Suspense fallback={smsFallback}><JoiningInstructions /></Suspense>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/comparison"
            element={
              <ProtectedRoute roles={['academic']}>
                <DashboardLayout>
                  <Suspense fallback={comparisonFallback}><Comparison /></Suspense>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/academic/:page"
            element={
              <ProtectedRoute roles={['academic']}>
                <DashboardLayout>
                  <ComingSoon />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher"
            element={
              <ProtectedRoute roles={['teacher']}>
                <DashboardLayout>
                  <TeacherDashboard />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/my-classes"
            element={
              <ProtectedRoute roles={['teacher']}>
                <DashboardLayout>
                  <MyClasses />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/entry"
            element={
              <ProtectedRoute roles={['teacher']}>
                <DashboardLayout>
                  <MarkEntry />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/view-results"
            element={
              <ProtectedRoute roles={ALL_ROLES}>
                <DashboardLayout>
                  <Suspense fallback={viewResultsFallback}><ViewResults /></Suspense>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/reports"
            element={
              <ProtectedRoute roles={['teacher']}>
                <DashboardLayout>
                  <Suspense fallback={reportsFallback}><Reports /></Suspense>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/comparison"
            element={
              <ProtectedRoute roles={['teacher']}>
                <DashboardLayout>
                  <Suspense fallback={comparisonFallback}><Comparison /></Suspense>
                </DashboardLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/:page"
            element={
              <ProtectedRoute roles={['teacher']}>
                <DashboardLayout>
                  <ComingSoon />
                </DashboardLayout>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

