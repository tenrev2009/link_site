import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PublicLinks } from './components/PublicLinks';
import { AdminDashboard } from './components/AdminDashboard';
import { Login } from './components/Login';
import { PrivateRoute } from './components/PrivateRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PublicLinks />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/admin/*"
          element={
            <PrivateRoute>
              <AdminDashboard />
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;