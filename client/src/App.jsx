import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import PhotoFinderPage from './pages/PhotoFinderPage';
import AdishaPage from './pages/AdishaPage';
import AdminPage from './pages/AdminPage';
import './index.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

function App() {
  return (
    <Router>
      <div className="app">
        <div className="ambient-bg">
          <div className="ambient-orb ambient-orb-1"></div>
          <div className="ambient-orb ambient-orb-2"></div>
          <div className="ambient-orb ambient-orb-3"></div>
        </div>
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/photos" element={<PhotoFinderPage apiBase={API_BASE} />} />
            <Route path="/adisha" element={<AdishaPage apiBase={API_BASE} />} />
            <Route path="/admin" element={<AdminPage apiBase={API_BASE} />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
