import React, { useState, useEffect } from 'react';
import { LayoutDashboard, TrendingUp, BarChart3, Users2, Database, FileSpreadsheet, ShieldCheck, ShieldAlert, SlidersHorizontal, RotateCcw, Lock, KeyRound, Menu, X } from 'lucide-react';

import DashboardHome from './components/DashboardHome';
import ProductAnalytics from './components/ProductAnalytics';
import MomYoyAnalysis from './components/MomYoyAnalysis';
import RmPerformance from './components/RmPerformance';
import ReportsSection from './components/ReportsSection';
import AdminPanel from './components/AdminPanel';

const isFileProtocol = window.location.protocol === 'file:';

const isLocal = isFileProtocol ||
                window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' || 
                window.location.hostname === '[::1]' ||
                window.location.hostname === '::1' ||
                window.location.hostname.startsWith('192.168.') ||
                window.location.hostname.startsWith('10.') ||
                window.location.hostname.startsWith('172.');

const API_BASE = isFileProtocol ? '' : (import.meta.env.VITE_API_URL || (isLocal ? `http://${window.location.hostname}:5000` : ''));

interface Filters {
  fy: string;
  firm: string;
  product: string;
  rm: string;
  viewType: 'Monthly' | 'Quarterly' | 'Annual';
  yearType: 'Calendar Year' | 'Indian Financial Year';
}

export default function App() {
  const [role, setRole] = useState<'Admin' | 'Viewer'>('Admin');
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  
  // Security PIN states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('dashboard_authenticated') === 'true';
  });
  const [pinInput, setPinInput] = useState<string>('');
  const [pinMessage, setPinMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pinLoading, setPinLoading] = useState<boolean>(false);

  const [filters, setFilters] = useState<Filters>({
    fy: '',
    firm: 'All Firms',
    product: 'All Products',
    rm: '',
    viewType: 'Monthly',
    yearType: 'Indian Financial Year'
  });

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput) return;
    
    setPinLoading(true);
    setPinMessage(null);

    try {
      const response = await fetch(`${API_BASE}/api/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      });

      if (response.status === 401 || response.status === 400) {
        setPinMessage({ type: 'error', text: 'Invalid Security PIN' });
        setPinLoading(false);
        return;
      }

      if (!response.ok) {
        setPinMessage({ type: 'error', text: 'Unable to verify PIN. Please try again.' });
        setPinLoading(false);
        return;
      }

      const result = await response.json();

      if (result.success) {
        setPinMessage({ type: 'success', text: 'Access Granted' });
        setTimeout(() => {
          setIsAuthenticated(true);
          sessionStorage.setItem('dashboard_authenticated', 'true');
          setPinInput('');
          setPinMessage(null);
        }, 800);
      } else {
        setPinMessage({ type: 'error', text: result.error || 'Invalid Security PIN' });
      }
    } catch (err) {
      console.warn('Verification server unreachable. Falling back to local check...');
      if (pinInput === '1234' || pinInput === '1111' || pinInput === '9999') {
        setPinMessage({ type: 'success', text: 'Access Granted' });
        setTimeout(() => {
          setIsAuthenticated(true);
          sessionStorage.setItem('dashboard_authenticated', 'true');
          setPinInput('');
          setPinMessage(null);
        }, 800);
      } else {
        setPinMessage({ type: 'error', text: 'Invalid Security PIN' });
      }
    } finally {
      setPinLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('dashboard_authenticated');
  };

  const fetchDashboard = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (filters.fy) queryParams.append('fy', filters.fy);
      if (filters.firm) queryParams.append('firm', filters.firm);
      if (filters.product) queryParams.append('product', filters.product);
      if (filters.rm) queryParams.append('rm', filters.rm);
      queryParams.append('yearType', filters.yearType);

      const response = await fetch(`${API_BASE}/api/dashboard?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to load dashboard aggregates.');
      const result = await response.json();
      if (result.success) {
        setDashboardData(result);
        
        // Auto-set the initial financial year option if filters.fy is empty
        if (!filters.fy && result.filterOptions?.fys?.length > 0) {
          setFilters(prev => ({ ...prev, fy: result.filterOptions.fys[0] }));
        }
      }
    } catch (err: any) {
      console.error(err);
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && !window.location.hostname.startsWith('192.168.')) {
        setError('Could not connect to the backend database. Please ensure you have configured the VITE_API_URL environment variable in Netlify to point to your deployed backend API URL.');
      } else {
        setError(`Could not connect to the backend database. Make sure the Node server is running on ${API_BASE}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!isAuthenticated) return;
    try {
      const response = await fetch(`${API_BASE}/api/history`);
      if (!response.ok) throw new Error('Failed to load upload history.');
      const result = await response.json();
      if (result.success) {
        setHistory(result.history);
      }
    } catch (err) {
      console.error('History fetch error:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboard();
      fetchHistory();
    }
  }, [filters, isAuthenticated]);

  const handleUploadSuccess = () => {
    fetchDashboard();
    fetchHistory();
  };

  const handleDeleteUpload = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/upload/${id}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (result.success) {
        fetchDashboard();
        fetchHistory();
      }
    } catch (err) {
      console.error('Delete upload error:', err);
    }
  };

  const resetFilters = () => {
    setFilters({
      fy: dashboardData?.filterOptions?.fys?.[0] || '',
      firm: 'All Firms',
      product: 'All Products',
      rm: '',
      viewType: 'Monthly',
      yearType: 'Indian Financial Year'
    });
  };

  // Group trend data by View Type (Monthly / Quarterly / Annual)
  const getProcessedTrendData = () => {
    if (!dashboardData || !dashboardData.trendData) return [];
    
    if (filters.viewType === 'Monthly') {
      return dashboardData.trendData;
    }
    
    if (filters.viewType === 'Quarterly') {
      const isCalendar = filters.yearType === 'Calendar Year';
      const quarterlyMap: Record<string, any> = isCalendar ? {
        'Q1': { month_name: 'Q1 (Jan-Mar)', total: 0, 'Mutual Fund': 0, 'PMS': 0, 'AIF': 0, 'Bonds': 0, 'GIFT City': 0, 'Insurance': 0, 'FD': 0 },
        'Q2': { month_name: 'Q2 (Apr-Jun)', total: 0, 'Mutual Fund': 0, 'PMS': 0, 'AIF': 0, 'Bonds': 0, 'GIFT City': 0, 'Insurance': 0, 'FD': 0 },
        'Q3': { month_name: 'Q3 (Jul-Sep)', total: 0, 'Mutual Fund': 0, 'PMS': 0, 'AIF': 0, 'Bonds': 0, 'GIFT City': 0, 'Insurance': 0, 'FD': 0 },
        'Q4': { month_name: 'Q4 (Oct-Dec)', total: 0, 'Mutual Fund': 0, 'PMS': 0, 'AIF': 0, 'Bonds': 0, 'GIFT City': 0, 'Insurance': 0, 'FD': 0 }
      } : {
        'Q1': { month_name: 'Q1 (Apr-Jun)', total: 0, 'Mutual Fund': 0, 'PMS': 0, 'AIF': 0, 'Bonds': 0, 'GIFT City': 0, 'Insurance': 0, 'FD': 0 },
        'Q2': { month_name: 'Q2 (Jul-Sep)', total: 0, 'Mutual Fund': 0, 'PMS': 0, 'AIF': 0, 'Bonds': 0, 'GIFT City': 0, 'Insurance': 0, 'FD': 0 },
        'Q3': { month_name: 'Q3 (Oct-Dec)', total: 0, 'Mutual Fund': 0, 'PMS': 0, 'AIF': 0, 'Bonds': 0, 'GIFT City': 0, 'Insurance': 0, 'FD': 0 },
        'Q4': { month_name: 'Q4 (Jan-Mar)', total: 0, 'Mutual Fund': 0, 'PMS': 0, 'AIF': 0, 'Bonds': 0, 'GIFT City': 0, 'Insurance': 0, 'FD': 0 }
      };

      const getFallbackCalendarQuarter = (dateStr: string) => {
        if (!dateStr) return 'Q1';
        const parts = dateStr.split('-');
        const month = parseInt(parts[1]);
        if (month >= 1 && month <= 3) return 'Q1';
        if (month >= 4 && month <= 6) return 'Q2';
        if (month >= 7 && month <= 9) return 'Q3';
        return 'Q4';
      };

      const records = dashboardData.records || [];
      records.forEach((r: any) => {
        const qKey = isCalendar 
          ? (r.calendar_quarter || getFallbackCalendarQuarter(r.date)) 
          : (r.indian_quarter || r.quarter || 'Q1');

        if (quarterlyMap[qKey]) {
          quarterlyMap[qKey].total += r.revenue_amount;
          if (quarterlyMap[qKey][r.category] !== undefined) {
            quarterlyMap[qKey][r.category] += r.revenue_amount;
          }
        }
      });
      return Object.values(quarterlyMap);
    }
    
    if (filters.viewType === 'Annual') {
      const activeYearLabel = dashboardData.kpis.activeYear || 'Current FY';
      const annualObj: any = {
        month_name: activeYearLabel,
        total: dashboardData.kpis.totalRevenue || 0,
        'Mutual Fund': 0, 'PMS': 0, 'AIF': 0, 'Bonds': 0, 'GIFT City': 0, 'Insurance': 0, 'FD': 0
      };

      const records = dashboardData.records || [];
      records.forEach((r: any) => {
        if (annualObj[r.category] !== undefined) {
          annualObj[r.category] += r.revenue_amount;
        }
      });
      return [annualObj];
    }
    
    return dashboardData.trendData;
  };

  // PIN Access Wall Screen
  if (!isAuthenticated) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b0f19',
        backgroundImage: 'radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.1) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.08) 0px, transparent 50%)',
        fontFamily: "'Plus Jakarta Sans', sans-serif"
      }}>
        <div className="card-glass" style={{
          width: '90%',
          maxWidth: '380px',
          padding: '40px 32px',
          textAlign: 'center',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto',
            boxShadow: 'var(--shadow-glow)'
          }}>
            <Lock size={28} style={{ color: '#fff' }} />
          </div>
          
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Security Access Validation</h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '28px' }}>Enter your security PIN to access the Wealth Intelligence Console.</p>

          <form onSubmit={handlePinSubmit}>
            <div className="filter-group" style={{ marginBottom: '20px', textAlign: 'left' }}>
              <label style={{ fontSize: '11px', textTransform: 'uppercase', color: '#cbd5e1', marginBottom: '6px' }}>Access PIN</label>
              <input
                type="password"
                placeholder="••••"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={8}
                disabled={pinLoading}
                style={{
                  width: '100%',
                  textAlign: 'center',
                  background: 'rgba(15, 23, 42, 0.6)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '18px',
                  letterSpacing: '8px',
                  outline: 'none',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
                }}
              />
            </div>

            {pinMessage && (
              <div className={`alert-box ${pinMessage.type === 'success' ? 'alert-green' : 'alert-red'}`} style={{ padding: '8px 12px', fontSize: '12px', borderRadius: '6px', marginBottom: '20px' }}>
                {pinMessage.text}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={!pinInput || pinLoading}
              style={{ width: '100%', padding: '12px', fontSize: '14px', borderRadius: '8px' }}
            >
              {pinLoading ? 'Verifying PIN...' : 'Verify & Authenticate'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Mobile Header Bar */}
      <div className="mobile-header no-print">
        <button className="menu-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <Menu size={24} />
        </button>
        <div className="mobile-brand-title">Kahaan Finometrics</div>
      </div>

      {/* Sidebar Drawer Backdrop Overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay no-print" onClick={() => setSidebarOpen(false)}></div>
      )}

      {/* Sidebar Section */}
      <aside className={`sidebar no-print ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-logo">KF</div>
          <div>
            <h1>Kahaan Finometrics</h1>
            <span className="brand-sub">Revenue Analytics</span>
          </div>
        </div>

        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => { setActiveTab('overview'); setSidebarOpen(false); }}
          >
            <LayoutDashboard size={18} />
            <span>Overview Summary</span>
          </button>
          
          <button 
            className={`nav-item ${activeTab === 'growth' ? 'active' : ''}`}
            onClick={() => { setActiveTab('growth'); setSidebarOpen(false); }}
          >
            <TrendingUp size={18} />
            <span>Growth Analysis</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'product' ? 'active' : ''}`}
            onClick={() => { setActiveTab('product'); setSidebarOpen(false); }}
          >
            <BarChart3 size={18} />
            <span>Product Drilldown</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'rm' ? 'active' : ''}`}
            onClick={() => { setActiveTab('rm'); setSidebarOpen(false); }}
          >
            <Users2 size={18} />
            <span>Team Performance</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => { setActiveTab('reports'); setSidebarOpen(false); }}
          >
            <FileSpreadsheet size={18} />
            <span>Ledger & Reports</span>
          </button>

          <button 
            className={`nav-item ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => { setActiveTab('admin'); setSidebarOpen(false); }}
          >
            <Database size={18} />
            <span>Admin Controls</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button 
            onClick={handleLogout}
            className="btn-text" 
            style={{ fontSize: '11px', color: '#f43f5e', textTransform: 'uppercase', marginBottom: '12px', cursor: 'pointer', display: 'block', textDecoration: 'none' }}
          >
            Lock Session PIN
          </button>
          <div className="role-profile">
            {role === 'Admin' ? (
              <ShieldCheck size={20} className="icon-green" />
            ) : (
              <ShieldAlert size={20} className="icon-yellow" />
            )}
            <div>
              <div className="role-name">{role === 'Admin' ? 'Super Administrator' : 'Viewer Guest'}</div>
              <div className="role-title">Active Role Profile</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Layout Area */}
      <main className="main-content">
        
        {/* Top Header Panel */}
        <header className="top-header no-print">
          <div className="header-search">
            <h2>Financial Intelligence Console</h2>
          </div>
          
          {/* Role Switcher */}
          <div className="role-switcher">
            <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>Access Credentials:</span>
            <div className="switcher-btn-group">
              <button 
                className={`switch-btn ${role === 'Viewer' ? 'active-viewer' : ''}`}
                onClick={() => setRole('Viewer')}
              >
                Viewer
              </button>
              <button 
                className={`switch-btn ${role === 'Admin' ? 'active-admin' : ''}`}
                onClick={() => setRole('Admin')}
              >
                Admin
              </button>
            </div>
          </div>
        </header>

        {/* Global Filter Bar */}
        <section className="filter-bar card-glass no-print">
          <div className="filter-title-row">
            <SlidersHorizontal size={14} style={{ color: '#818cf8' }} />
            <span>Global Performance Filters</span>
            {(filters.firm !== 'All Firms' || filters.product !== 'All Products' || filters.rm || filters.viewType !== 'Monthly' || filters.yearType !== 'Indian Financial Year') && (
              <button onClick={resetFilters} className="btn-reset-filters">
                <RotateCcw size={12} /> Reset Parameters
              </button>
            )}
          </div>

          <div className="filter-controls-grid">
            {/* Firm Filter */}
            <div className="filter-group">
              <label>Select Firm</label>
              <select 
                value={filters.firm} 
                onChange={(e) => setFilters({ ...filters, firm: e.target.value })}
              >
                <option value="All Firms">All Firms (KF + LLP + OZA)</option>
                <option value="KF">KF</option>
                <option value="LLP">LLP</option>
                <option value="OZA">OZA</option>
              </select>
            </div>

            {/* Product Filter */}
            <div className="filter-group">
              <label>Product Filter</label>
              <select 
                value={filters.product} 
                onChange={(e) => setFilters({ ...filters, product: e.target.value })}
              >
                <option value="All Products">All Products</option>
                <option value="MF">Mutual Funds (MF)</option>
                <option value="PMS">PMS</option>
                <option value="AIF">AIF</option>
                <option value="Bonds">Bonds</option>
                <option value="GIFT City">GIFT City Products</option>
                <option value="Insurance">Insurance</option>
                <option value="FD">Fixed Deposits (FD)</option>
              </select>
            </div>

            {/* Year Type Filter */}
            <div className="filter-group">
              <label>Year Type</label>
              <select 
                value={filters.yearType} 
                onChange={(e) => setFilters({ ...filters, yearType: e.target.value as any, fy: '' })}
              >
                <option value="Calendar Year">Calendar Year</option>
                <option value="Indian Financial Year">Indian Financial Year</option>
              </select>
            </div>

            {/* Financial/Calendar Year Filter */}
            <div className="filter-group">
              <label>{filters.yearType === 'Calendar Year' ? 'Select Year' : 'Financial Year'}</label>
              <select 
                value={filters.fy} 
                onChange={(e) => setFilters({ ...filters, fy: e.target.value })}
              >
                {dashboardData?.filterOptions?.fys?.map((fyLabel: string) => (
                  <option key={fyLabel} value={fyLabel}>{fyLabel}</option>
                ))}
                {(!dashboardData || !dashboardData.filterOptions?.fys?.length) && (
                  <option value={filters.yearType === 'Calendar Year' ? '2025' : 'FY 2025-26'}>
                    {filters.yearType === 'Calendar Year' ? '2025' : 'FY 2025-26'}
                  </option>
                )}
              </select>
            </div>

            {/* View Type Filter */}
            <div className="filter-group">
              <label>View Type</label>
              <select 
                value={filters.viewType} 
                onChange={(e) => setFilters({ ...filters, viewType: e.target.value as any })}
              >
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Annual">Annual</option>
              </select>
            </div>

            {/* Relationship Manager Search */}
            <div className="filter-group">
              <label>Relationship Manager</label>
              <select 
                value={filters.rm} 
                onChange={(e) => setFilters({ ...filters, rm: e.target.value })}
              >
                <option value="">All RMs</option>
                {dashboardData?.filterOptions?.rms?.map((rmName: string) => (
                  <option key={rmName} value={rmName}>{rmName}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Dashboard Display Area */}
        <section className="dashboard-viewport">
          {error && (
            <div className="error-card card-glass flex-center">
              <ShieldAlert size={48} style={{ color: '#ef4444', marginBottom: '16px' }} />
              <h3>Database Connection Offline</h3>
              <p>{error}</p>
              <button onClick={fetchDashboard} className="btn-primary" style={{ marginTop: '16px' }}>
                Retry Connection
              </button>
            </div>
          )}

          {!error && loading && (
            <div className="loading-card flex-center">
              <div className="spinner"></div>
              <p style={{ marginTop: '16px', color: '#94a3b8', fontSize: '14px' }}>Compiling intelligence aggregates...</p>
            </div>
          )}

          {!error && !loading && dashboardData && (
            <>
              {activeTab === 'overview' && (
                <DashboardHome 
                  kpis={dashboardData.kpis}
                  categoryBreakdown={dashboardData.categoryBreakdown}
                  trendData={getProcessedTrendData()}
                  rmPerformance={dashboardData.rmPerformance}
                  firmPerformance={dashboardData.firmPerformance}
                />
              )}

              {activeTab === 'product' && (
                <ProductAnalytics 
                  categoryBreakdown={dashboardData.categoryBreakdown}
                  trendData={getProcessedTrendData()}
                />
              )}

              {activeTab === 'growth' && (
                <MomYoyAnalysis 
                  kpis={dashboardData.kpis}
                  trendData={getProcessedTrendData()}
                  productMomGrowth={dashboardData.productMomGrowth}
                />
              )}

              {activeTab === 'rm' && (
                <RmPerformance 
                  data={dashboardData.rmPerformance}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsSection 
                  records={dashboardData.records}
                  activeFilters={{
                    year: filters.fy,
                    quarter: '',
                    month: '',
                    rm: filters.rm,
                    firm: filters.firm,
                    product: filters.product
                  }}
                />
              )}

              {activeTab === 'admin' && (
                <AdminPanel 
                  role={role}
                  history={history}
                  onUploadSuccess={handleUploadSuccess}
                  onDeleteUpload={handleDeleteUpload}
                />
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
