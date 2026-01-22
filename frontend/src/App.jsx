import { Routes, Route, Navigate } from 'react-router-dom';
import ClientsView from './pages/ClientsViewDark';
import ClientDetail from './pages/ClientDetail';

function App() {
  return (
    <div className="min-h-screen bg-dark-950">
      <Routes>
        <Route path="/" element={<ClientsView />} />
        <Route path="/client/:clientId" element={<ClientDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
