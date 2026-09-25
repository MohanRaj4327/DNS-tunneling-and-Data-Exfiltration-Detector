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
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
