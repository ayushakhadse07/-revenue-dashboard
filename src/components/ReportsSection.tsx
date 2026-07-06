import React, { useState } from 'react';
import { Printer, Search, ArrowUpDown, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface RecordItem {
  id: string;
  date: string;
  month_name: string;
  year: number;
  quarter: string;
  client_name: string;
  category: string;
  revenue_amount: number;
  rm_name: string;
  firm: string;
}

interface ReportsSectionProps {
  records: RecordItem[];
  activeFilters: {
    year: string;
    quarter: string;
    month: string;
    rm: string;
    firm: string;
    product: string;
  };
}

export default function ReportsSection({ records = [], activeFilters }: ReportsSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof RecordItem>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatCurrencyLakhs = (amount: number) => {
    const lakhs = amount / 100000;
    return `₹ ${lakhs.toFixed(2)} Lakhs`;
  };

  // Filter based on search input
  const filteredRecords = records.filter(rec => {
    const client = (rec.client_name || '').toLowerCase();
    const rm = (rec.rm_name || '').toLowerCase();
    const firm = (rec.firm || '').toLowerCase();
    const category = (rec.category || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    
    return client.includes(search) || rm.includes(search) || firm.includes(search) || category.includes(search);
  });

  // Handle sorting
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = (bVal as string).toLowerCase();
    }

    if (aVal < bVal) return sortAsc ? -1 : 1;
    if (aVal > bVal) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleSort = (field: keyof RecordItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Pagination
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = sortedRecords.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(sortedRecords.length / rowsPerPage);

  // Generate Excel workbook dynamically
  const exportToExcel = () => {
    const exportData = sortedRecords.map((r, index) => ({
      'S.No': index + 1,
      'Date': r.date,
      'Month': r.month_name,
      'Year': r.year,
      'Quarter': r.quarter,
      'Client Name': r.client_name || 'N/A',
      'Product Category': r.category,
      'Revenue (INR)': r.revenue_amount,
      'Relationship Manager': r.rm_name || 'N/A',
      'Firm Name': r.firm
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    
    const wscols = [
      {wch: 6},  // Serial Number
      {wch: 12}, // Date
      {wch: 12}, // Month
      {wch: 8},  // Year
      {wch: 8},  // Quarter
      {wch: 22}, // Client Name
      {wch: 16}, // Category
      {wch: 15}, // Revenue
      {wch: 22}, // RM
      {wch: 12}  // Firm
    ];
    worksheet['!cols'] = wscols;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Revenue Ledger');

    // Generate filename based on active filters
    let filterString = '';
    if (activeFilters.firm) filterString += `_${activeFilters.firm}`;
    if (activeFilters.product) filterString += `_${activeFilters.product}`;
    if (activeFilters.year) filterString += `_${activeFilters.year.replace(/\s+/g, '')}`;
    
    const filename = `Wealth_Revenue_Ledger${filterString || '_Full'}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="reports-section-view">
      <div className="section-header no-print">
        <div>
          <h2>Financial Ledger & Reporting</h2>
          <p className="subtitle">Search complete transaction histories, filter parameters, and export professional spreadsheets or printable PDF audits.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={exportToExcel} 
            className="btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            disabled={sortedRecords.length === 0}
          >
            <FileSpreadsheet size={16} />
            Export to Excel
          </button>
          <button 
            onClick={handlePrint} 
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            disabled={sortedRecords.length === 0}
          >
            <Printer size={16} />
            Print PDF Report
          </button>
        </div>
      </div>

      {/* Print-only Header */}
      <div className="print-only-header" style={{ display: 'none', marginBottom: '24px' }}>
        <h1 style={{ color: '#0f172a', margin: '0 0 8px 0' }}>WEALTH MANAGEMENT REVENUE AUDIT LEDGER</h1>
        <div style={{ display: 'flex', gap: '24px', fontSize: '13px', color: '#475569', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px' }}>
          <span>Generated: {new Date().toLocaleDateString('en-IN')}</span>
          {activeFilters.year && <span>Period: {activeFilters.year}</span>}
          {activeFilters.firm && <span>Firm: {activeFilters.firm}</span>}
          {activeFilters.product && <span>Product: {activeFilters.product}</span>}
          <span>Total Records: {records.length}</span>
        </div>
      </div>

      {/* Active Filter Metrics (Print Friendly) */}
      <div className="print-only-metrics" style={{ display: 'none', gap: '16px', gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px' }}>
        <div style={{ border: '1px solid #e2e8f0', padding: '16px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Filtered Revenue Sum</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>
            {formatCurrencyLakhs(sortedRecords.reduce((sum, r) => sum + r.revenue_amount, 0))}
          </div>
        </div>
        <div style={{ border: '1px solid #e2e8f0', padding: '16px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Average Revenue Deal</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>
            {sortedRecords.length > 0 
              ? formatCurrency(Math.round(sortedRecords.reduce((sum, r) => sum + r.revenue_amount, 0) / sortedRecords.length))
              : '₹0'}
          </div>
        </div>
        <div style={{ border: '1px solid #e2e8f0', padding: '16px', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Deals Inflow Count</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginTop: '4px' }}>
            {sortedRecords.length} Transactions
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="table-card card-glass">
        <div className="table-search-row no-print" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b' }}>
          <div style={{ position: 'relative', width: '320px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search Client, RM, Firm, Product..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                border: '1px solid #334155',
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                color: '#fff',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>
            Showing {Math.min(indexOfFirstRow + 1, sortedRecords.length)} - {Math.min(indexOfLastRow, sortedRecords.length)} of {sortedRecords.length} records
          </div>
        </div>

        {/* Ledger Table */}
        <div className="table-responsive">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>
                  Date <ArrowUpDown size={12} style={{ marginLeft: '4px' }} className="no-print" />
                </th>
                <th onClick={() => handleSort('client_name')} style={{ cursor: 'pointer' }}>
                  Client Name <ArrowUpDown size={12} style={{ marginLeft: '4px' }} className="no-print" />
                </th>
                <th onClick={() => handleSort('category')} style={{ cursor: 'pointer' }}>
                  Product Category <ArrowUpDown size={12} style={{ marginLeft: '4px' }} className="no-print" />
                </th>
                <th onClick={() => handleSort('revenue_amount')} style={{ cursor: 'pointer' }}>
                  Revenue <ArrowUpDown size={12} style={{ marginLeft: '4px' }} className="no-print" />
                </th>
                <th onClick={() => handleSort('rm_name')} style={{ cursor: 'pointer' }}>
                  Relationship Manager <ArrowUpDown size={12} style={{ marginLeft: '4px' }} className="no-print" />
                </th>
                <th onClick={() => handleSort('firm')} style={{ cursor: 'pointer' }}>
                  Firm Name <ArrowUpDown size={12} style={{ marginLeft: '4px' }} className="no-print" />
                </th>
              </tr>
            </thead>
            <tbody>
              {currentRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                    No ledger entries match search parameters.
                  </td>
                </tr>
              ) : (
                currentRows.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.date).toLocaleDateString('en-IN')}</td>
                    <td className="font-semibold">{item.client_name || 'N/A'}</td>
                    <td>
                      <span className="product-badge" style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        color: '#818cf8',
                        textTransform: 'uppercase'
                      }}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: '#10b981' }}>{formatCurrency(item.revenue_amount)}</td>
                    <td>{item.rm_name || 'Unassigned'}</td>
                    <td style={{ fontWeight: 600 }}>{item.firm}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Rows */}
        {totalPages > 1 && (
          <div className="table-pagination-row no-print" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'center', gap: '8px', borderTop: '1px solid #1e293b' }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="btn-secondary btn-sm"
              style={{ padding: '4px 10px', fontSize: '13px' }}
            >
              Previous
            </button>
            {[...Array(totalPages)].map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx + 1)}
                className={currentPage === idx + 1 ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                style={{ padding: '4px 10px', fontSize: '13px' }}
              >
                {idx + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="btn-secondary btn-sm"
              style={{ padding: '4px 10px', fontSize: '13px' }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
