import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Award, Building, IndianRupee, ArrowUpRight, ArrowDownRight, LayoutDashboard, ShieldCheck } from 'lucide-react';

interface KPIProps {
  totalRevenue: number;
  currentMonthRevenue: number;
  prevMonthRevenue: number;
  momGrowth: number;
  currentYearRevenue: number;
  prevYearRevenue: number;
  yoyGrowth: number;
  activeMonthName: string;
  activeYear: string | number;
}

interface CategoryItem {
  category: string;
  revenue: number;
  contribution: number;
}

interface TrendItem {
  month_year: string;
  month_name: string;
  year: number;
  total: number;
  [key: string]: any;
}

interface RMItem {
  rm: string;
  revenue: number;
  clientsCount: number;
  achievementPercent: number;
}

interface FirmItem {
  firm: string;
  revenue: number;
}

interface DashboardHomeProps {
  kpis: KPIProps;
  categoryBreakdown: CategoryItem[];
  trendData: TrendItem[];
  rmPerformance: RMItem[];
  firmPerformance: FirmItem[];
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444', '#10b981', '#fbbf24'];

export default function DashboardHome({
  kpis,
  categoryBreakdown = [],
  trendData = [],
  rmPerformance = [],
  firmPerformance = []
}: DashboardHomeProps) {

  const formatCurrency = (amount: number) => {
    const lakhs = amount / 100000;
    return `₹ ${lakhs.toFixed(2)} Lakhs`;
  };

  const getGrowthBadge = (growth: number) => {
    const isPositive = growth >= 0;
    return (
      <span className={`trend-badge ${isPositive ? 'trend-up-badge' : 'trend-down-badge'}`} style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600,
        backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
        color: isPositive ? '#10b981' : '#ef4444',
        marginLeft: '8px'
      }}>
        {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {isPositive ? '+' : ''}{growth.toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="dashboard-home-view">
      
      {/* Header */}
      <div className="section-header">
        <div>
          <h2>Executive Revenue Summary</h2>
          <p className="subtitle">High-level financial performance indicators, product matrices, and firm allocation breakdowns.</p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        {/* Total Revenue */}
        <div className="kpi-card card-glass">
          <div className="kpi-header">
            <span className="kpi-title">Total Cumulative Revenue</span>
            <IndianRupee className="icon-blue" size={20} />
          </div>
          <div className="kpi-value">{formatCurrency(kpis.totalRevenue)}</div>
          <div className="kpi-footer">
            <span style={{ color: '#94a3b8' }}>Aggregated across all active filters</span>
          </div>
        </div>

        {/* Current Month Revenue */}
        <div className="kpi-card card-glass">
          <div className="kpi-header">
            <span className="kpi-title">Monthly Run Rate ({kpis.activeMonthName})</span>
            <TrendingUp className="icon-purple" size={20} />
          </div>
          <div className="kpi-value" style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
            {formatCurrency(kpis.currentMonthRevenue)}
            {getGrowthBadge(kpis.momGrowth)}
          </div>
          <div className="kpi-footer">
            <span style={{ color: '#cbd5e1' }}>Prev Month: {formatCurrency(kpis.prevMonthRevenue)}</span>
          </div>
        </div>

        {/* Current Year Revenue */}
        <div className="kpi-card card-glass">
          <div className="kpi-header">
            <span className="kpi-title">Annual Performance ({kpis.activeYear})</span>
            <ShieldCheck className="icon-green" size={20} />
          </div>
          <div className="kpi-value" style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
            {formatCurrency(kpis.currentYearRevenue)}
            {getGrowthBadge(kpis.yoyGrowth)}
          </div>
          <div className="kpi-footer">
            <span style={{ color: '#cbd5e1' }}>Prev Year: {formatCurrency(kpis.prevYearRevenue)}</span>
          </div>
        </div>
      </div>

      {/* Main Charts Matrix */}
      <div className="charts-grid-two">
        
        {/* Chart 1: Monthly Run-Rate Trend */}
        <div className="chart-card card-glass">
          <h3>Monthly Inflow Progression</h3>
          <div className="chart-wrapper">
            {trendData.length === 0 ? (
              <div className="no-data-placeholder">No revenue records found. Upload Excel data in the Admin Panel to populate graphs.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2f42" />
                  <XAxis dataKey="month_name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                    formatter={(value: number) => [`₹ ${(value / 100000).toFixed(2)} Lakhs`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Product Breakdown Pie */}
        <div className="chart-card card-glass">
          <h3>Product Revenue Distribution</h3>
          <div className="chart-wrapper flex-center">
            {categoryBreakdown.every(c => c.revenue === 0) ? (
              <div className="no-data-placeholder">No product breakdown available.</div>
            ) : (
              <div className="pie-chart-wrapper-flex">
                <ResponsiveContainer className="pie-chart-responsive-container" width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={categoryBreakdown.filter(c => c.revenue > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="revenue"
                      nameKey="category"
                    >
                      {categoryBreakdown.filter(c => c.revenue > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      formatter={(value: number) => [`₹ ${(value / 100000).toFixed(2)} Lakhs`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pie-legend">
                  {categoryBreakdown.map((item, index) => (
                    <div key={item.category} className="pie-legend-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{item.category}</span>
                      <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>{item.contribution.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* RMs and Firms Performance Lists */}
      <div className="charts-grid-two" style={{ marginTop: '24px' }}>
        
        {/* Relationship Managers List */}
        <div className="table-card card-glass" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Award className="icon-gold" size={20} />
            <h3 style={{ margin: 0 }}>Relationship Manager Leaderboard</h3>
          </div>
          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
            <table className="dashboard-table small-table">
              <thead>
                <tr>
                  <th>RM Name</th>
                  <th>Total Revenue</th>
                  <th>Target Accomplished</th>
                </tr>
              </thead>
              <tbody>
                {rmPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>No RM logs available.</td>
                  </tr>
                ) : (
                  rmPerformance.slice(0, 4).map((rm) => (
                    <tr key={rm.rm}>
                      <td className="font-semibold">{rm.rm}</td>
                      <td>{formatCurrency(rm.revenue)}</td>
                      <td>
                        <span className={`badge-status ${rm.achievementPercent >= 100 ? 'status-green' : rm.achievementPercent >= 75 ? 'status-purple' : 'status-yellow'}`}>
                          {rm.achievementPercent.toFixed(0)}% Achieved
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Firms Performance List (instead of branch) */}
        <div className="table-card card-glass" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Building className="icon-blue" size={20} />
            <h3 style={{ margin: 0 }}>Firm Revenue Breakdown</h3>
          </div>
          <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
            <table className="dashboard-table small-table">
              <thead>
                <tr>
                  <th>Firm Name</th>
                  <th>Total Inflow</th>
                  <th>Share Contribution %</th>
                </tr>
              </thead>
              <tbody>
                {firmPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>No Firm logs available.</td>
                  </tr>
                ) : (
                  firmPerformance.map((f) => {
                    const contribution = kpis.totalRevenue > 0 ? (f.revenue / kpis.totalRevenue) * 100 : 0;
                    return (
                      <tr key={f.firm}>
                        <td className="font-semibold">{f.firm}</td>
                        <td>{formatCurrency(f.revenue)}</td>
                        <td>{contribution.toFixed(1)}%</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
