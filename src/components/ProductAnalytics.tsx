import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface CategoryData {
  category: string;
  revenue: number;
  contribution: number;
  target: number;
  achievementPercent: number;
}

interface TrendItem {
  month_year: string;
  month_name: string;
  year: number;
  total: number;
  [key: string]: any;
}

interface ProductAnalyticsProps {
  categoryBreakdown: CategoryData[];
  trendData: TrendItem[];
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444', '#10b981', '#fbbf24'];

export default function ProductAnalytics({ categoryBreakdown = [], trendData = [] }: ProductAnalyticsProps) {
  const formatCurrency = (amount: number) => {
    return `₹ ${(amount / 100000).toFixed(2)} Lakhs`;
  };

  const categoriesList = ['Mutual Fund', 'PMS', 'AIF', 'Bonds', 'GIFT City', 'Insurance', 'FD'];
  
  // Select latest 6 months of data for the heatmap
  const heatmapMonths = trendData.slice(-6);

  let maxHeatmapValue = 0;
  heatmapMonths.forEach(m => {
    categoriesList.forEach(cat => {
      const val = m[cat] || 0;
      if (val > maxHeatmapValue) maxHeatmapValue = val;
    });
  });

  const getHeatmapColor = (value: number) => {
    if (value === 0) return 'rgba(30, 41, 59, 0.3)';
    const ratio = maxHeatmapValue > 0 ? value / maxHeatmapValue : 0;
    return `rgba(99, 102, 241, ${Math.max(0.1, ratio * 0.9)})`;
  };

  return (
    <div className="product-analytics-view">
      <div className="section-header">
        <div>
          <h2>Product Revenue Intelligence</h2>
          <p className="subtitle">Drill down into product-wise contributions, growth trend lines, target achievements, and density heatmaps.</p>
        </div>
      </div>

      {/* Product Summary Grid */}
      <div className="product-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {categoryBreakdown.map((cat, idx) => (
          <div key={cat.category} className="product-stat-card card-glass" style={{ borderLeft: `4px solid ${COLORS[idx % COLORS.length]}`, padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.category}</div>
            <div style={{ fontSize: '18px', fontWeight: 700, margin: '8px 0 4px 0', color: '#fff' }}>
              ₹{(cat.revenue / 100000).toFixed(1)}L
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#cbd5e1' }}>
              <span>Share: {cat.contribution}%</span>
              <span style={{ color: cat.achievementPercent >= 100 ? '#10b981' : '#cbd5e1' }}>
                Tgt: {cat.achievementPercent.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Charts Row */}
      <div className="charts-grid-two">
        
        {/* Pie: Share Contribution */}
        <div className="chart-card card-glass">
          <h3>Revenue Share Contribution %</h3>
          <div className="chart-wrapper flex-center">
            {categoryBreakdown.every(c => c.revenue === 0) ? (
              <div className="no-data-placeholder">No active revenue data.</div>
            ) : (
              <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="50%" height={260}>
                  <PieChart>
                    <Pie
                      data={categoryBreakdown.filter(c => c.revenue > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="revenue"
                      nameKey="category"
                    >
                      {categoryBreakdown.filter(c => c.revenue > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      formatter={(value: number) => [`₹ ${(value / 100000).toFixed(2)} Lakhs`, 'Revenue']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pie-legend" style={{ width: '45%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {categoryBreakdown.map((item, index) => (
                    <div key={item.category} className="pie-legend-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: COLORS[index % COLORS.length] }}></div>
                      <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{item.category}</span>
                      <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>{item.contribution}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Target vs Achievement */}
        <div className="chart-card card-glass">
          <h3>Target vs Achievement Comparison</h3>
          <div className="chart-wrapper">
            {categoryBreakdown.length === 0 ? (
              <div className="no-data-placeholder">No categories found.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categoryBreakdown} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2f42" />
                  <XAxis dataKey="category" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    formatter={(value: number) => [`₹ ${(value / 100000).toFixed(2)} Lakhs`, '']}
                  />
                  <Legend wrapperStyle={{ color: '#94a3b8' }} />
                  <Bar dataKey="revenue" name="Achieved Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="target" name="Monthly Target" fill="#10b981" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Historical Product Trends */}
      <div className="chart-card card-glass" style={{ marginTop: '24px' }}>
        <h3>Historical Product Performance Trends</h3>
        <div className="chart-wrapper" style={{ height: '320px' }}>
          {trendData.length === 0 ? (
            <div className="no-data-placeholder">Upload Excel data to check historical trend lines.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2f42" />
                <XAxis dataKey="month_name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  formatter={(value: number) => [`₹ ${(value / 100000).toFixed(2)} Lakhs`, '']}
                />
                <Legend wrapperStyle={{ color: '#94a3b8' }} />
                {categoriesList.map((cat, idx) => (
                  <Line 
                    key={cat} 
                    type="monotone" 
                    dataKey={cat} 
                    stroke={COLORS[idx % COLORS.length]} 
                    activeDot={{ r: 8 }} 
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Heatmap: Monthly Product Density */}
      <div className="table-card card-glass" style={{ marginTop: '24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={20} className="icon-blue" />
          Product Revenue Density Heatmap (Latest Months)
        </h3>
        {heatmapMonths.length === 0 ? (
          <div className="no-data-placeholder" style={{ padding: '40px' }}>Upload Excel sheets to view the product revenue matrix.</div>
        ) : (
          <div className="heatmap-container" style={{ padding: '16px', overflowX: 'auto' }}>
            <table className="heatmap-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '6px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px', color: '#94a3b8', fontSize: '13px' }}>Category</th>
                  {heatmapMonths.map(m => (
                    <th key={m.month_year} style={{ padding: '8px', color: '#fff', fontSize: '13px', textAlign: 'center' }}>
                      {m.month_name} {m.year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categoriesList.map(cat => (
                  <tr key={cat}>
                    <td style={{ padding: '12px 8px', color: '#cbd5e1', fontWeight: 600, fontSize: '13px', width: '140px' }}>
                      {cat}
                    </td>
                    {heatmapMonths.map(m => {
                      const val = m[cat] || 0;
                      return (
                        <td 
                          key={m.month_year} 
                          style={{ 
                            backgroundColor: getHeatmapColor(val), 
                            textAlign: 'center', 
                            padding: '16px 8px', 
                            borderRadius: '6px',
                            color: val > 0 ? '#fff' : '#475569',
                            fontWeight: val > 0 ? 600 : 400,
                            fontSize: '13px',
                            transition: 'all 0.2s ease',
                            border: '1px solid rgba(255,255,255,0.03)'
                          }}
                          title={`${cat} - ${m.month_name} ${m.year}: ${formatCurrency(val)}`}
                        >
                          {val > 0 ? `₹${(val / 100000).toFixed(1)}L` : '0.0L'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
              <span>Lower Revenue</span>
              <div style={{ display: 'flex', gap: '2px' }}>
                <div style={{ width: '16px', height: '10px', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '2px' }}></div>
                <div style={{ width: '16px', height: '10px', backgroundColor: 'rgba(99, 102, 241, 0.3)', borderRadius: '2px' }}></div>
                <div style={{ width: '16px', height: '10px', backgroundColor: 'rgba(99, 102, 241, 0.6)', borderRadius: '2px' }}></div>
                <div style={{ width: '16px', height: '10px', backgroundColor: 'rgba(99, 102, 241, 0.9)', borderRadius: '2px' }}></div>
              </div>
              <span>Higher Revenue</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
