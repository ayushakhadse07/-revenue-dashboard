import React, { useState, useRef } from 'react';
import { Upload, Download, Trash2, CheckCircle2, AlertTriangle, ShieldAlert, FileText, Database, Lock, KeyRound } from 'lucide-react';
import * as XLSX from 'xlsx';

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

// --------------------------------------------------------------------
// CLIENT-SIDE PARSING HELPER FUNCTIONS
// --------------------------------------------------------------------
function getIndianFYAndQuarter(dateObj: Date) {
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();
  
  let fyStart, fyEnd;
  if (month >= 3) {
    fyStart = year;
    fyEnd = (year + 1) % 100;
  } else {
    fyStart = year - 1;
    fyEnd = year % 100;
  }
  const fy = `FY ${fyStart}-${fyEnd < 10 ? '0' + fyEnd : fyEnd}`;

  let quarter = 'Q1';
  if (month >= 3 && month <= 5) quarter = 'Q1';
  else if (month >= 6 && month <= 8) quarter = 'Q2';
  else if (month >= 9 && month <= 11) quarter = 'Q3';
  else if (month >= 0 && month <= 2) quarter = 'Q4';

  return { fy, quarter };
}

function getCalendarQuarter(dateObj: Date) {
  const month = dateObj.getMonth();
  if (month >= 0 && month <= 2) return 'Q1';
  if (month >= 3 && month <= 5) return 'Q2';
  if (month >= 6 && month <= 8) return 'Q3';
  return 'Q4';
}

function normalizeCategory(catStr: string) {
  if (!catStr) return null;
  const lower = catStr.trim().toLowerCase();
  if (lower.includes('mutual fund') || lower === 'mf') return 'Mutual Fund';
  if (lower === 'pms' || lower.includes('portfolio management')) return 'PMS';
  if (lower === 'aif' || lower.includes('alternative investment')) return 'AIF';
  if (lower.includes('bond')) return 'Bonds';
  if (lower.includes('gift city') || lower === 'gift') return 'GIFT City';
  if (lower.includes('insurance')) return 'Insurance';
  if (lower === 'fd' || lower.includes('fixed deposit')) return 'FD';
  return null;
}

function parseExcelDate(val: any): Date | null {
  if (!val) return null;

  if (val instanceof Date && !isNaN(val.getTime())) {
    return val;
  }

  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }

  const str = String(val).trim();
  
  let match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    const d = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    if (!isNaN(d.getTime())) return d;
  }

  match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) {
    const d = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
    if (!isNaN(d.getTime())) return d;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  match = str.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (match) {
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const fullMonthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
    const mStr = match[1].toLowerCase();
    let mIdx = monthNames.indexOf(mStr.substring(0, 3));
    if (mIdx === -1) mIdx = fullMonthNames.indexOf(mStr);
    if (mIdx !== -1) {
      return new Date(parseInt(match[2]), mIdx, 1);
    }
  }

  return null;
}

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
    try {
      const wb = XLSX.utils.book_new();
      const headers = ['Month/Date', 'Firm Name', 'Product Category', 'Revenue Amount', 'Relationship Manager', 'Client Name'];
      
      const kfAoa = [
        headers,
        ['2025-04-15', 'KF', 'Mutual Fund', '500000', 'Amit Sharma', 'Client A'],
        ['2025-05-20', 'KF', 'PMS', '350000', 'Priya Patel', 'Client B'],
        ['2025-06-10', 'KF', 'AIF', '600000', 'Rohan Sen', 'Client C']
      ];
      const kfWs = XLSX.utils.aoa_to_sheet(kfAoa);
      XLSX.utils.book_append_sheet(wb, kfWs, 'KF');
      
      const llpAoa = [
        headers,
        ['2025-04-18', 'LLP', 'Bonds', '200000', 'Amit Sharma', 'Client D'],
        ['2025-05-15', 'LLP', 'GIFT City', '450000', 'Priya Patel', 'Client E'],
        ['2025-06-25', 'LLP', 'Insurance', '300000', 'Rohan Sen', 'Client F']
      ];
      const llpWs = XLSX.utils.aoa_to_sheet(llpAoa);
      XLSX.utils.book_append_sheet(wb, llpWs, 'LLP');
      
      const ozaAoa = [
        headers,
        ['2025-04-20', 'OZA', 'FD', '150000', 'Amit Sharma', 'Client G'],
        ['2025-05-10', 'OZA', 'Mutual Fund', '250000', 'Priya Patel', 'Client H'],
        ['2025-06-30', 'OZA', 'PMS', '400000', 'Rohan Sen', 'Client I']
      ];
      const ozaWs = XLSX.utils.aoa_to_sheet(ozaAoa);
      XLSX.utils.book_append_sheet(wb, ozaWs, 'OZA');
      
      XLSX.writeFile(wb, 'revenue_upload_template.xlsx');
    } catch (err: any) {
      alert('Failed to generate template: ' + err.message);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setMessage(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error("Could not read file data.");
        
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const requiredSheets = ['KF', 'LLP', 'OZA'];
        const sheetNames = workbook.SheetNames;
        
        const missingSheets = requiredSheets.filter(s => !sheetNames.includes(s));
        if (missingSheets.length > 0) {
          throw new Error(`Missing required worksheets: ${missingSheets.join(', ')}. The file must contain three separate sheets named KF, LLP, and OZA.`);
        }

        const errors: string[] = [];
        const parsedRecords: any[] = [];
        const ALLOWED_CATEGORIES = ['Mutual Fund', 'PMS', 'AIF', 'Bonds', 'GIFT City', 'Insurance', 'FD'];

        requiredSheets.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[];
          
          if (rawRows.length === 0) return;
          
          const firstRow = rawRows[0];
          const keys = Object.keys(firstRow);
          
          const dateKey = keys.find(k => /month|date/i.test(k));
          const categoryKey = keys.find(k => /category|product/i.test(k));
          const revenueKey = keys.find(k => /revenue|amount/i.test(k));
          const rmKey = keys.find(k => /rm|manager|relationship/i.test(k) && !/firm|company/i.test(k));
          const clientKey = keys.find(k => /client|customer/i.test(k) || (/name/i.test(k) && !/firm|company|rm|manager|relationship/i.test(k)));

          if (!dateKey) errors.push(`Sheet "${sheetName}": Missing column for "Month / Date"`);
          if (!categoryKey) errors.push(`Sheet "${sheetName}": Missing column for "Product Category"`);
          if (!revenueKey) errors.push(`Sheet "${sheetName}": Missing column for "Revenue Amount"`);

          if (errors.length > 0) return;

          rawRows.forEach((row, rowIndex) => {
            const rowNum = rowIndex + 2;
            
            // Allow completely empty row skip
            const isRowEmpty = Object.values(row).every(v => v === '');
            if (isRowEmpty) return;

            const rawDate = row[dateKey!];
            const parsedDate = parseExcelDate(rawDate);
            if (!parsedDate) {
              errors.push(`Sheet "${sheetName}", Row ${rowNum}: Invalid Date/Month format "${rawDate}". Use YYYY-MM-DD or Month Year (e.g. Apr 2025).`);
              return;
            }

            const rawCategory = row[categoryKey!];
            const normalizedCategory = normalizeCategory(String(rawCategory));
            if (!normalizedCategory) {
              errors.push(`Sheet "${sheetName}", Row ${rowNum}: Unsupported Category "${rawCategory}". Allowed: ${ALLOWED_CATEGORIES.join(', ')}.`);
              return;
            }

            const rawRevenue = row[revenueKey!];
            const parsedRevenue = parseFloat(String(rawRevenue).replace(/[^0-9.-]/g, ''));
            if (isNaN(parsedRevenue)) {
              errors.push(`Sheet "${sheetName}", Row ${rowNum}: Revenue must be a valid number. Got "${rawRevenue}".`);
              return;
            }

            const clientName = clientKey ? String(row[clientKey]).trim() : 'Unspecified Client';
            const rmName = rmKey ? String(row[rmKey]).trim() : 'Unassigned';

            const { fy, quarter: indianQuarter } = getIndianFYAndQuarter(parsedDate);
            const calendarYear = parsedDate.getFullYear();
            const calendarQuarter = getCalendarQuarter(parsedDate);
            
            const monthNum = parsedDate.getMonth() + 1;
            const monthFormatted = monthNum < 10 ? `0${monthNum}` : `${monthNum}`;
            const dayNum = parsedDate.getDate();
            const dayFormatted = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;

            parsedRecords.push({
              date: `${calendarYear}-${monthFormatted}-${dayFormatted}`,
              month_year: `${calendarYear}-${monthFormatted}`,
              year: calendarYear,
              quarter: indianQuarter,
              fy,
              calendar_year: calendarYear,
              calendar_quarter: calendarQuarter,
              indian_fy: fy,
              indian_quarter: indianQuarter,
              month_name: parsedDate.toLocaleString('default', { month: 'long' }),
              client_name: clientName,
              category: normalizedCategory,
              revenue_amount: parsedRevenue,
              rm_name: rmName,
              firm: sheetName
            });
          });
        });

        if (errors.length > 0) {
          setMessage({
            type: 'error',
            text: 'Validation failed in spreadsheet.',
            details: errors
          });
          setLoading(false);
          return;
        }

        if (parsedRecords.length === 0) {
          throw new Error('All three sheets KF, LLP, and OZA in the Excel file are empty.');
        }

        // Upload to Google Apps Script Web App
        const response = await fetch(`${API_BASE}?action=upload`, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'upload',
            filename: file.name,
            records: parsedRecords
          })
        });

        const result = await response.json();
        if (result.success) {
          setMessage({ type: 'success', text: result.message });
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          onUploadSuccess();
        } else {
          setMessage({
            type: 'error',
            text: result.error || 'Failed to upload records to database.'
          });
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message || 'Error occurred while processing Excel file.' });
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setMessage({ type: 'error', text: 'Error reading file.' });
      setLoading(false);
    };
    reader.readAsBinaryString(file);
  };

  const handlePinChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPin || !newPin) return;

    setPinLoading(true);
    setPinMessage(null);

    try {
      const response = await fetch(`${API_BASE}?action=changePin`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'changePin', oldPin: currentPin, newPin }),
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
      setPinMessage({ type: 'error', text: 'Network connection failed. Make sure the Google Apps Script Web App is deployed.' });
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
