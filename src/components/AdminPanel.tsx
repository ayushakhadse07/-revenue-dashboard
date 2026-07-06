import React, { useState, useRef } from 'react';
import { Upload, Download, Trash2, CheckCircle2, AlertTriangle, ShieldAlert, FileText, Database, Lock, KeyRound } from 'lucide-react';

interface UploadHistoryItem {
  id: string;
  filename: string;
  upload_date: string;
  row_count: number;
  status: string;
}

interface AdminPanelProps {
  role: 'Admin' | 'Viewer';
  history: UploadHistoryItem[];
  onUploadSuccess: () => void;
  onDeleteUpload: (id: string) => void;
}

const isLocal = window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' || 
                window.location.hostname === '[::1]' ||
                window.location.hostname === '::1' ||
                window.location.hostname.startsWith('192.168.') ||
                window.location.hostname.startsWith('10.') ||
                window.location.hostname.startsWith('172.');

const API_BASE = import.meta.env.VITE_API_URL || (isLocal ? `http://${window.location.hostname}:5000` : '');

export default function AdminPanel({ role, history = [], onUploadSuccess, onDeleteUpload }: AdminPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; details?: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security PIN states
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (role === 'Viewer') return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls')) {
        setFile(droppedFile);
        setMessage(null);
      } else {
        setMessage({ type: 'error', text: 'Unsupported file type. Please upload an Excel file (.xlsx or .xls).' });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setMessage(null);
    }
  };

  const downloadTemplate = () => {
    window.open(`${API_BASE}/api/template`, '_blank');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setMessage({ type: 'success', text: result.message });
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        onUploadSuccess();
      } else {
        setMessage({
          type: 'error',
          text: result.error || 'Failed to upload spreadsheet.',
          details: result.errors || null
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Network connection failed. Make sure the backend server is running.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPin || !newPin) return;

    setPinLoading(true);
    setPinMessage(null);

    try {
      const response = await fetch(`${API_BASE}/api/change-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPin: currentPin, newPin }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setPinMessage({ type: 'success', text: result.message });
        setCurrentPin('');
        setNewPin('');
      } else {
        setPinMessage({ type: 'error', text: result.error || 'Failed to update PIN.' });
      }
    } catch (err) {
      setPinMessage({ type: 'error', text: 'Network connection failed. Make sure the backend server is running.' });
    } finally {
      setPinLoading(false);
    }
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="admin-panel-view">
      <div className="section-header">
        <div>
          <h2>Admin Operations Control</h2>
          <p className="subtitle">Manage ingestion logs, configure security PINs, and parse multi-firm spreadsheets.</p>
        </div>
      </div>

      {role === 'Viewer' && (
        <div className="alert-box alert-yellow flex-start" style={{ marginBottom: '24px' }}>
          <ShieldAlert size={20} style={{ marginRight: '12px', marginTop: '2px', flexShrink: 0 }} />
          <div>
            <h4 style={{ margin: 0, fontWeight: 600 }}>Viewer Access Mode Enabled</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#b45309' }}>
              You are currently viewing the platform with Viewer credentials. File uploads, deletion rolls, and PIN configurations are disabled. Switch to the **Admin** role in the top header panel to simulate upload capabilities.
            </p>
          </div>
        </div>
      )}

      <div className="admin-grid">
        
        {/* Upload Column */}
        <div className="admin-card card-glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Upload size={20} className="icon-blue" />
              Spreadsheet Ingestion (Multi-Firm)
            </h3>
            <button 
              onClick={downloadTemplate} 
              className="btn-text" 
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            >
              <Download size={14} />
              Download Template
            </button>
          </div>

          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px', lineHeight: '1.5', padding: '10px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
            <strong>Upload Guidelines:</strong> Acceptable format is a single workbook (.xlsx) containing three sheets named exactly <strong>KF</strong>, <strong>LLP</strong>, and <strong>OZA</strong>. Columns in each sheet must contain: <em>Month/Date</em>, <em>Product Category</em>, and <em>Revenue Amount</em>.
          </div>

          <form onSubmit={handleUpload}>
            <div 
              className={`upload-zone ${isDragActive ? 'drag-active' : ''} ${role === 'Viewer' ? 'disabled' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => {
                if (role !== 'Viewer') fileInputRef.current?.click();
              }}
              style={{
                border: '2px dashed #475569',
                borderRadius: '12px',
                padding: '40px 20px',
                textAlign: 'center',
                cursor: role === 'Viewer' ? 'not-allowed' : 'pointer',
                backgroundColor: isDragActive ? 'rgba(59, 130, 246, 0.05)' : 'rgba(30, 41, 59, 0.3)',
                transition: 'all 0.2s ease',
                marginBottom: '20px'
              }}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                disabled={role === 'Viewer'}
              />
              <FileText size={48} style={{ margin: '0 auto 12px auto', color: '#64748b' }} />
              {file ? (
                <div>
                  <p className="font-semibold" style={{ color: '#fff', marginBottom: '4px' }}>{file.name}</p>
                  <p style={{ color: '#64748b', fontSize: '13px' }}>{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold" style={{ color: '#cbd5e1', marginBottom: '4px' }}>
                    {role === 'Viewer' ? 'File Uploader Locked' : 'Drag & Drop 3-Sheet Excel Here'}
                  </p>
                  <p style={{ color: '#64748b', fontSize: '13px' }}>
                    {role === 'Viewer' ? 'Switch to Admin to upload' : 'or click to browse local files (.xlsx)'}
                  </p>
                </div>
              )}
            </div>

            {message && (
              <div 
                className={`alert-box ${message.type === 'success' ? 'alert-green' : 'alert-red'}`} 
                style={{ marginBottom: '20px', borderRadius: '8px', padding: '12px 16px' }}
              >
                <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                  {message.type === 'success' ? (
                    <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                  ) : (
                    <AlertTriangle size={18} style={{ color: '#f43f5e', flexShrink: 0, marginTop: '2px' }} />
                  )}
                  <div style={{ fontSize: '13px' }}>
                    <span className="font-semibold">{message.text}</span>
                    {message.details && message.details.length > 0 && (
                      <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: '#fda4af', listStyleType: 'disc' }}>
                        {message.details.map((err, i) => <li key={i}>{err}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              {file && (
                <button 
                  type="button" 
                  onClick={() => setFile(null)} 
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  disabled={loading}
                >
                  Clear
                </button>
              )}
              <button 
                type="submit" 
                className="btn-primary" 
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                disabled={!file || loading || role === 'Viewer'}
              >
                {loading ? 'Uploading & Processing...' : 'Upload Multi-Firm Sheet'}
              </button>
            </div>
          </form>
        </div>

        {/* Security PIN Column */}
        <div className="admin-card card-glass" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <KeyRound size={20} className="icon-gold" />
            Security PIN Configuration
          </h3>

          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px', lineHeight: '1.5' }}>
            Modify the passkey required to access this dashboard. The PIN must be at least 4 numerical digits.
          </div>

          <form onSubmit={handlePinChange}>
            <div className="filter-group" style={{ marginBottom: '12px' }}>
              <label>Current Security PIN</label>
              <input 
                type="password" 
                placeholder="••••"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/[^0-9]/g, ''))}
                disabled={role === 'Viewer' || pinLoading}
                maxLength={8}
                style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  color: '#fff',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            <div className="filter-group" style={{ marginBottom: '16px' }}>
              <label>New Security PIN</label>
              <input 
                type="password" 
                placeholder="••••"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                disabled={role === 'Viewer' || pinLoading}
                maxLength={8}
                style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  color: '#fff',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            {pinMessage && (
              <div className={`alert-box ${pinMessage.type === 'success' ? 'alert-green' : 'alert-red'}`} style={{ padding: '8px 12px', fontSize: '12px', marginBottom: '12px' }}>
                {pinMessage.text}
              </div>
            )}

            <button
              type="submit"
              className="btn-secondary"
              disabled={!currentPin || !newPin || role === 'Viewer' || pinLoading}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Lock size={14} />
              {pinLoading ? 'Updating PIN...' : 'Update Security PIN'}
            </button>
          </form>
        </div>

      </div>

      {/* History Log Row */}
      <div className="admin-card card-glass" style={{ padding: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={20} className="icon-purple" />
          Ingestion History & Database Rollbacks
        </h3>

        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {history.length === 0 ? (
            <div className="no-data-placeholder" style={{ padding: '40px 0' }}>
              No uploads found. Ingest a monthly report template to start.
            </div>
          ) : (
            <div className="log-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {history.map((log) => (
                <div 
                  key={log.id} 
                  className="log-item card-glass" 
                  style={{ 
                    padding: '12px 16px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    border: '1px solid #1e293b'
                  }}
                >
                  <div>
                    <div className="font-semibold" style={{ fontSize: '14px', color: '#fff', wordBreak: 'break-all' }}>{log.filename}</div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '4px', fontSize: '12px', color: '#94a3b8' }}>
                      <span>Rows: {log.row_count}</span>
                      <span>Ingested: {formatDate(log.upload_date)}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete "${log.filename}"? This will rollback all associated revenue records.`)) {
                        onDeleteUpload(log.id);
                      }
                    }}
                    className="btn-icon-danger"
                    disabled={role === 'Viewer'}
                    title={role === 'Viewer' ? 'Locked for viewers' : 'Rollback upload'}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: role === 'Viewer' ? 'transparent' : 'rgba(239, 68, 68, 0.1)',
                      color: role === 'Viewer' ? '#475569' : '#ef4444',
                      cursor: role === 'Viewer' ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
