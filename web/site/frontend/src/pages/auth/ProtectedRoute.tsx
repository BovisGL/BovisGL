/**
 * ProtectedRoute Component
 * 
 * Wrapper for admin routes requiring authentication.
 * Verifies JWT token and redirects to login if invalid.
 */

import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { api } from '../../services/apiService';

export const ProtectedRoute = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const verifyAuth = async () => {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        setIsAuthenticated(false);
        return;
      }

      try {
        const response = await api.get('/api/locked/auth/verify');
        
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('auth_token');
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth verification failed:', error);
        localStorage.removeItem('auth_token');
        setIsAuthenticated(false);
      }
    };

    verifyAuth();
  }, []);

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#23272f',
        color: '#fff'
      }}>
        Verifying authentication...
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Render protected content
  return <Outlet />;
};
