import { useState } from 'react';
import axios from 'axios';

function CSVUpload() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setResults(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResults(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>CSV Analysis</h2>
      
      <div className="panel">
        <form onSubmit={handleUpload} style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
          <input 
            type="file" 
            accept=".csv" 
            onChange={e => setFile(e.target.files[0])} 
          />
          <button type="submit" className="btn" disabled={!file || loading}>
            {loading ? 'Analyzing...' : 'Analyze Dataset'}
          </button>
        </form>
        {error && (
          <div style={{marginTop: 15, padding: 15, background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', borderRadius: 4}}>
            {error}
          </div>
        )}
      </div>

      {results && (
        <div className="panel">
          <h3>Analysis Results</h3>
          <p>Processed Rows: <strong>{results.processed_rows}</strong></p>
          
          {results.has_labels ? (
            <div>
              <h4 style={{marginTop: 20}}>Evaluation Metrics</h4>
              <div className="grid-cards">
                <div className="stat-card">
                  <div className="stat-title">Precision</div>
                  <div className="stat-value">{(results.metrics.precision * 100).toFixed(1)}%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-title">Recall</div>
                  <div className="stat-value">{(results.metrics.recall * 100).toFixed(1)}%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-title">F1 Score</div>
                  <div className="stat-value">{(results.metrics.f1_score * 100).toFixed(1)}%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-title">Accuracy</div>
                  <div className="stat-value">{(results.metrics.accuracy * 100).toFixed(1)}%</div>
                </div>
              </div>

              <h4>Confusion Matrix</h4>
              <table style={{width: 'auto', minWidth: 300}}>
                <thead>
                  <tr>
                    <th></th>
                    <th>Predicted Normal</th>
                    <th>Predicted Suspicious</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>Actual Normal</th>
                    <td>{results.metrics.confusion_matrix.true_negative}</td>
                    <td>{results.metrics.confusion_matrix.false_positive}</td>
                  </tr>
                  <tr>
                    <th>Actual Suspicious</th>
                    <td>{results.metrics.confusion_matrix.false_negative}</td>
                    <td>{results.metrics.confusion_matrix.true_positive}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{color: 'var(--text-muted)'}}>
              Dataset did not contain 'expected_label' column. Evaluation metrics were not calculated.
              Results have been added to the overall dashboard.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default CSVUpload;
