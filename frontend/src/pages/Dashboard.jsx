import { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function Dashboard() {
  const [status, setStatus] = useState({ api: 'LOADING', monitor: 'UNKNOWN', database: 'UNKNOWN' });
  const [devices, setDevices] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [recentQueries, setRecentQueries] = useState([]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const statusRes = await axios.get('/api/status');
      setStatus(statusRes.data);
      
      const devicesRes = await axios.get('/api/devices');
      setDevices(devicesRes.data);

      const alertsRes = await axios.get('/api/alerts?limit=5');
      setRecentAlerts(alertsRes.data);

      const queriesRes = await axios.get('/api/queries?limit=10');
      setRecentQueries(queriesRes.data);
    } catch (error) {
      console.error("Error fetching dashboard data", error);
      setStatus(prev => ({ ...prev, api: 'OFFLINE' }));
    }
  };

  const totalQueries = devices.reduce((sum, dev) => sum + dev.total_queries, 0);
  const suspiciousQueries = devices.reduce((sum, dev) => sum + dev.suspicious_queries, 0);

  return (
    <div>
      <div className="header-flex">
        <h2>Dashboard</h2>
        <div>
          <span className={`badge ${status.api === 'ONLINE' ? 'low' : 'critical'}`}>API: {status.api}</span>
          <span className="badge medium" style={{marginLeft: 10}}>Monitor: {status.monitor}</span>
        </div>
      </div>

      <div className="grid-cards">
        <div className="stat-card">
          <div className="stat-title">Total DNS Queries</div>
          <div className="stat-value">{totalQueries}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Suspicious Queries</div>
          <div className="stat-value" style={{color: suspiciousQueries > 0 ? 'var(--warning)' : 'inherit'}}>
            {suspiciousQueries}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Active Devices</div>
          <div className="stat-value">{devices.length}</div>
        </div>
      </div>

      <div className="panel">
        <h3>Suspicious Alerts (Score ≥ 60)</h3>
        {recentAlerts.length === 0 ? (
          <p style={{color: 'var(--text-muted)'}}>No suspicious activity detected recently.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source IP</th>
                  <th>Domain</th>
                  <th>Length</th>
                  <th>Entropy</th>
                  <th>Freq</th>
                  <th>Risk Score</th>
                  <th>Severity</th>
                </tr>
              </thead>
              <tbody>
                {recentAlerts.map(alert => (
                  <tr key={alert.id}>
                    <td>{new Date(alert.timestamp * 1000).toLocaleTimeString()}</td>
                    <td>{alert.source_ip}</td>
                    <td>{alert.query_name}</td>
                    <td>{alert.query_length || 0}</td>
                    <td>{alert.entropy ? alert.entropy.toFixed(2) : '0.00'}</td>
                    <td>{alert.current_frequency || 1}</td>
                    <td>{alert.risk_score}</td>
                    <td>
                      <span className={`badge ${alert.severity.toLowerCase()}`}>
                        {alert.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <h3>All Browsing History</h3>
        {recentQueries.length === 0 ? (
          <p style={{color: 'var(--text-muted)'}}>No websites visited yet.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source IP</th>
                  <th>Domain</th>
                  <th>Length</th>
                  <th>Entropy</th>
                  <th>Freq</th>
                  <th>Risk Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentQueries.map(query => (
                  <tr key={query.id}>
                    <td>{new Date(query.timestamp * 1000).toLocaleTimeString()}</td>
                    <td>{query.source_ip || 'Chrome Browser'}</td>
                    <td>{query.query_name}</td>
                    <td>{query.query_length || 0}</td>
                    <td>{query.entropy ? query.entropy.toFixed(2) : '0.00'}</td>
                    <td>{query.current_frequency || 1}</td>
                    <td>{query.risk_score}</td>
                    <td>
                      <span className={`badge ${query.severity.toLowerCase()}`}>
                        {query.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
