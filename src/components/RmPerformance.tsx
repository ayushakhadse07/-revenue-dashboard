import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { Users, Target, Award, ArrowUpRight, ShieldCheck } from 'lucide-react';

interface RMData {
  rm: string;
  revenue: number;
  clientsCount: number;
  transactions: number;
  target: number;
  achievementPercent: number;
}

interface RmPerformanceProps {
  data: RMData[];
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#e11d48', '#10b981', '#f59e0b'];

export default function RmPerformance({ data = [] }: RmPerformanceProps) {
  // Format currency in Lakhs (Indian Numbering Format)
  const formatCurrency = (amount: number) => {
    const lakhs = amount / 100000;
    return `₹${lakhs.toFixed(2)} Lakhs`;
  };

  const totalTeamRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  const totalTeamTarget = data.reduce((sum, item) => sum + item.target, 0);
  const teamAchievementPercent = totalTeamTarget > 0 
    ? parseFloat(((totalTeamRevenue / totalTeamTarget) * 100).toFixed(1)) 
    : 0;

  const topRM = data.length > 0 
    ? [...data].sort((a, b) => b.revenue - a.revenue)[0] 
    : null;

  return (
    <div className="rm-performance-view">
      <div className="section-header">
        <div>
          <h2>RM & Team Performance</h2>
          <p className="subtitle">Track targets, contribution share, and individual Relationship Manager achievements.</p>
        </div>
        <div className="badge-ready">
          <ShieldCheck size={16} />
          <span>Production Ready Structure</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card card-glass">
          <div className="kpi-header">
            <span className="kpi-title">Team Total Revenue</span>
            <Users className="icon-purple" size={24} />
          </div>
          <div className="kpi-value">{formatCurrency(totalTeamRevenue)}</div>
          <div className="kpi-footer">
            <span className="trend-up">
              <ArrowUpRight size={16} /> Active Sales Desk
            </span>
          </div>
        </div>

        <div className="kpi-card card-glass">
          <div className="kpi-header">
            <span className="kpi-title">Overall Team Target</span>
            <Target className="icon-blue" size={24} />
          </div>
          <div className="kpi-value">{formatCurrency(totalTeamTarget)}</div>
          <div className="kpi-footer">
            <div className="target-progress-bar-container" style={{ width: '100%', marginTop: '8px' }}>
              <div className="target-progress-lbl">Achievement: {teamAchievementPercent}%</div>
              <div className="target-progress-bg">
                <div 
                  className="target-progress-fill" 
                  style={{ width: `${Math.min(teamAchievementPercent, 100)}%`, backgroundColor: '#8b5cf6' }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="kpi-card card-glass">
          <div className="kpi-header">
            <span className="kpi-title">Top Relationship Manager</span>
            <Award className="icon-gold" size={24} />
          </div>
          <div className="kpi-value">{topRM ? topRM.rm : 'N/A'}</div>
          <div className="kpi-footer">
            <span className="trend-up">
              {topRM ? formatCurrency(topRM.revenue) : '₹0 Lakhs'} generated
            </span>
          </div>
        </div>
      </div>

      {/* Visualizations Grid */}
      <div className="charts-grid-two">
        <div className="chart-card card-glass">
          <h3>Target vs Achievement (by RM)</h3>
          <div className="chart-wrapper">
            {data.length === 0 ? (
              <div className="no-data-placeholder">No RM records found. Upload data to view performance.</div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2f42" />
                  <XAxis dataKey="rm" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                    formatter={(value: number) => [formatCurrency(value), '']}
                  />
                  <Legend wrapperStyle={{ color: '#94a3b8' }} />
                  <Bar dataKey="revenue" name="Achievement" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="target" name="Target" fill="#3b82f6" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="chart-card card-glass">
          <h3>RM Revenue Contribution %</h3>
          <div className="chart-wrapper flex-center">
            {data.length === 0 ? (
              <div className="no-data-placeholder">No RM records found. Upload data to view performance.</div>
            ) : (
              <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="50%" height={260}>
                  <PieChart>
                    <Pie
                      data={data}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="revenue"
                      nameKey="rm"
                    >
                      {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pie-legend" style={{ width: '45%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.map((item, index) => {
                    const percent = totalTeamRevenue > 0 ? (item.revenue / totalTeamRevenue) * 100 : 0;
                    return (
                      <div key={item.rm} className="pie-legend-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{item.rm}</span>
                        <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>{percent.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="table-card card-glass" style={{ marginTop: '24px' }}>
        <h3>Relationship Manager Performance Ledger</h3>
        <div className="table-responsive">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Relationship Manager</th>
                <th>Total Revenue</th>
                <th>Unique Clients</th>
                <th>Transactions</th>
                <th>Target Achievement</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                    No records found. Upload spreadsheet in the Admin Panel to display performance.
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.rm}>
                    <td className="font-semibold">{item.rm}</td>
                    <td>{formatCurrency(item.revenue)}</td>
                    <td>{item.clientsCount} Clients</td>
                    <td>{item.transactions} Deals</td>
                    <td>
                      <div className="table-progress-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', minWidth: '40px' }}>{item.achievementPercent}%</span>
                        <div className="target-progress-bg" style={{ width: '80px', height: '6px' }}>
                          <div 
                            className="target-progress-fill" 
                            style={{ 
                              width: `${Math.min(item.achievementPercent, 100)}%`, 
                              height: '100%',
                              backgroundColor: item.achievementPercent >= 100 ? '#10b981' : item.achievementPercent >= 75 ? '#8b5cf6' : '#f59e0b' 
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge-status ${item.achievementPercent >= 100 ? 'status-green' : item.achievementPercent >= 75 ? 'status-purple' : 'status-yellow'}`}>
                        {item.achievementPercent >= 100 ? 'Target Achieved' : item.achievementPercent >= 75 ? 'On Track' : 'Needs Review'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
