import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Activity, AlertTriangle, Monitor, Upload, Settings } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import CSVUpload from './pages/CSVUpload';
import './App.css';

function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-brand">DNSentinel</div>
      <NavLink to="/" className={({isActive}) => isActive ? "nav-link active" : "nav-link"} end>
        <Activity size={18} /> Overview
      </NavLink>
      <NavLink to="/alerts" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
        <AlertTriangle size={18} /> Alerts
      </NavLink>
      <NavLink to="/upload" className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
        <Upload size={18} /> CSV Analysis
      </NavLink>

      <div style={{ marginTop: 'auto', padding: '20px', borderTop: '1px solid var(--border)' }}>
        <h4 style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 0, marginBottom: 10 }}>TESTING</h4>
        <button 
          className="btn" 
          style={{ width: '100%', marginBottom: '10px' }}
          onClick={() => fetch('/api/demo/start', { method: 'POST' })}
        >
          ▶ Start Demo
        </button>
        <button 
          className="btn" 
          style={{ width: '100%', backgroundColor: 'transparent', border: '1px solid var(--border)' }}
          onClick={() => {
            fetch('/api/demo/reset', { method: 'POST' }).then(() => window.location.reload());
          }}
        >
          Reset Demo
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/upload" element={<CSVUpload />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
