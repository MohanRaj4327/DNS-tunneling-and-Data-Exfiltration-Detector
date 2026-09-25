import { useState, useEffect } from 'react';
import axios from 'axios';

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await axios.get('/api/alerts?limit=100');
      setAlerts(res.data);
    } catch (error) {
      console.error("Error fetching alerts", error);
    }
  };

  const viewDetails = async (id) => {
    try {
      const res = await axios.get(`/api/alerts/${id}`);
      setSelectedAlert(res.data);
    } catch (error) {
      console.error("Error fetching alert details", error);
    }
  };

  return (
    <div>
      <h2>Alert History</h2>
      
      {selectedAlert && (
        <div className="panel" style={{border: '1px solid var(--danger)'}}>
          <div className="header-flex">
            <h3>Alert Details: {selectedAlert.query_name}</h3>
            <button className="btn" onClick={() => setSelectedAlert(null)}>Close</button>
          </div>
          
          <div className="grid-cards" style={{marginBottom: 0}}>
            <div>
              <p style={{color: 'var(--text-muted)'}}>Risk Score</p>
              <h2>{selectedAlert.risk_score} / 100</h2>
              <span className={`badge ${selectedAlert.severity.toLowerCase()}`}>{selectedAlert.severity}</span>
            </div>
            <div>
              <p style={{color: 'var(--text-muted)'}}>Source IP</p>
              <h3>{selectedAlert.source_ip}</h3>
            </div>
            <div>
              <p style={{color: 'var(--text-muted)'}}>Time</p>
              <h3>{new Date(selectedAlert.timestamp * 1000).toLocaleString()}</h3>
            </div>
          </div>

          <div style={{marginTop: 20}}>
            <h4>Triggered Tripwires:</h4>
            <ul>
              {selectedAlert.tripwires.map((tw, i) => <li key={i} style={{color: 'var(--warning)'}}>✓ {tw}</li>)}
            </ul>
          </div>
          
          <div style={{marginTop: 20}}>
            <h4>WHY WAS THIS FLAGGED?</h4>
            <ul>
              {selectedAlert.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </div>
      )}

      <div className="panel">
        {alerts.length === 0 ? (
          <p style={{color: 'var(--text-muted)'}}>No alerts found.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Source IP</th>
                  <th>Domain</th>
                  <th>Risk Score</th>
                  <th>Severity</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(alert => (
                  <tr key={alert.id}>
                    <td>{new Date(alert.timestamp * 1000).toLocaleString()}</td>
                    <td>{alert.source_ip}</td>
                    <td>{alert.query_name}</td>
                    <td>{alert.risk_score}</td>
                    <td>
                      <span className={`badge ${alert.severity.toLowerCase()}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td>
                      <button className="btn" style={{padding: '4px 8px', fontSize: '12px'}} onClick={() => viewDetails(alert.id)}>
                        Investigate
                      </button>
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

export default Alerts;
