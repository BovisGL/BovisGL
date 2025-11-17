import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/home/HomePage';
import { PasskeyAuth } from './pages/auth/PasskeyAuth';
import { PasskeyRegister } from './pages/auth/PasskeyRegister';
import { ProtectedRoute } from './pages/auth/ProtectedRoute';
import { SessionExpiredPage } from './pages/auth/SessionExpiredPage';
import { AdminPanel } from './pages/admin/AdminPanel';
import { PlayerManagerPage } from './pages/player manager';
import { SessionManager } from './components/SessionManager';
import './pages/common/styles/index.css';

export default function App() {
  return (
    <Router>
      <SessionManager />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<PasskeyAuth />} />
        <Route path="/register/:token" element={<PasskeyRegister />} />
        <Route path="/session-expired" element={<SessionExpiredPage />} />
        
        {/* Protected admin routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/playermanger" element={<PlayerManagerPage />} />
        </Route>
      </Routes>
    </Router>
  );
}
