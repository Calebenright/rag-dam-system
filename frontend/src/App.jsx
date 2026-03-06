import { Routes, Route, Navigate } from 'react-router-dom';
import ClientsView from './pages/ClientsViewDark';
import ClientDetail from './pages/ClientDetail';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <div className="min-h-screen bg-dark-950">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ClientsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/:clientId"
          element={
            <ProtectedRoute>
              <ClientDetail />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
