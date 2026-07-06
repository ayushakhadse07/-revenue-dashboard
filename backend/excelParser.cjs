const XLSX = require('xlsx');
const { getIndianFYAndQuarter, getCalendarQuarter } = require('./db.cjs');

const ALLOWED_CATEGORIES = [
  'Mutual Fund',
  'PMS',
  'AIF',
  'Bonds',
  'GIFT City',
  'Insurance',
  'FD'
];

function normalizeCategory(catStr) {
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

function parseExcelDate(val) {
  if (!val) return null;

  if (val instanceof Date && !isNaN(val)) {
    return val;
  }

  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }

  const str = String(val).trim();
  
  // Try YYYY-MM-DD
  let match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    const d = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    if (!isNaN(d.getTime())) return d;
  }

  // Try DD-MM-YYYY
  match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) {
    const d = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
    if (!isNaN(d.getTime())) return d;
  }

  // Standard Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // Try Month Year like "Jan 2025" or "January 2025"
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

function parseAndValidateExcel(fileBuffer) {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    const requiredSheets = ['KF', 'LLP', 'OZA'];
    const sheetNames = workbook.SheetNames;

    // Validate that all required sheets are present
    const missingSheets = requiredSheets.filter(s => !sheetNames.includes(s));
    if (missingSheets.length > 0) {
      return {
        success: false,
        errors: [`Missing required worksheets: ${missingSheets.join(', ')}. The file must contain three separate sheets named KF, LLP, and OZA.`]
      };
    }

    const errors = [];
    const parsedRecords = [];

    // Parse each sheet
    requiredSheets.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rawRows.length === 0) {
        // We log it as a warning or skip, but let's allow empty sheets silently
        return;
      }

      const firstRow = rawRows[0];
      const keys = Object.keys(firstRow);

      let dateKey = keys.find(k => /month|date/i.test(k));
      let categoryKey = keys.find(k => /category|product/i.test(k));
      let revenueKey = keys.find(k => /revenue|amount/i.test(k));

      // Optional columns - exclude firm Name from matching as rm or client name
      let rmKey = keys.find(k => /rm|manager|relationship/i.test(k) && !/firm|company/i.test(k));
      let clientKey = keys.find(k => /client|customer/i.test(k) || (/name/i.test(k) && !/firm|company|rm|manager|relationship/i.test(k)));

      if (!dateKey) errors.push(`Sheet "${sheetName}": Missing column for "Month / Date"`);
      if (!categoryKey) errors.push(`Sheet "${sheetName}": Missing column for "Product Category"`);
      if (!revenueKey) errors.push(`Sheet "${sheetName}": Missing column for "Revenue Amount"`);

      if (errors.length > 0) return;

      rawRows.forEach((row, index) => {
        const rowNum = index + 2;

        const rawDate = row[dateKey];
        const parsedDate = parseExcelDate(rawDate);
        if (!parsedDate) {
          errors.push(`Sheet "${sheetName}", Row ${rowNum}: Invalid Date/Month format "${rawDate}". Use YYYY-MM-DD or Month Year (e.g. Apr 2025).`);
          return;
        }

        const rawCategory = row[categoryKey];
        const normalizedCategory = normalizeCategory(String(rawCategory));
        if (!normalizedCategory) {
          errors.push(`Sheet "${sheetName}", Row ${rowNum}: Unsupported Category "${rawCategory}". Allowed: ${ALLOWED_CATEGORIES.join(', ')}.`);
          return;
        }

        const rawRevenue = row[revenueKey];
        const parsedRevenue = parseFloat(String(rawRevenue).replace(/[^0-9.-]/g, ''));
        if (isNaN(parsedRevenue)) {
          errors.push(`Sheet "${sheetName}", Row ${rowNum}: Revenue must be a valid number. Got "${rawRevenue}".`);
          return;
        }

        const clientName = clientKey ? String(row[clientKey]).trim() : 'Unspecified Client';
        const rmName = rmKey ? String(row[rmKey]).trim() : 'Unassigned';

        // Get Indian Financial Year & Quarter
        const { fy, quarter: indianQuarter } = getIndianFYAndQuarter(parsedDate);
        const calendarYear = parsedDate.getFullYear();
        const calendarQuarter = getCalendarQuarter(parsedDate);

        const year = parsedDate.getFullYear();
        const monthNum = parsedDate.getMonth() + 1;
        const monthFormatted = monthNum < 10 ? `0${monthNum}` : `${monthNum}`;
        const dayNum = parsedDate.getDate();
        const dayFormatted = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;

        parsedRecords.push({
          date: `${year}-${monthFormatted}-${dayFormatted}`,
          month_year: `${year}-${monthFormatted}`,
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
          firm: sheetName // Automatically set to sheetName (KF, LLP, OZA)
        });
      });
    });

    if (errors.length > 0) {
      return { success: false, errors };
    }

    if (parsedRecords.length === 0) {
      return { success: false, errors: ['All three sheets KF, LLP, and OZA in the Excel file are empty.'] };
    }

    return { success: true, data: parsedRecords };
  } catch (error) {
    return { success: false, errors: [`Failed to parse Excel file: ${error.message}`] };
  }
}

function generateExcelTemplate() {
  const wb = XLSX.utils.book_new();

  // Columns: Month/Date, Firm Name, Product Category, Revenue Amount, Relationship Manager, Client Name
  const kfAoa = [
    ['Month/Date', 'Firm Name', 'Product Category', 'Revenue Amount', 'Relationship Manager', 'Client Name'],
    ['2025-04-15', 'KF', 'Mutual Fund', '500000', 'Amit Sharma', 'Client A'],
    ['2025-05-20', 'KF', 'PMS', '350000', 'Priya Patel', 'Client B'],
    ['2025-06-22', 'KF', 'AIF', '450000', 'Rohan Sen', 'Client C']
  ];

  const llpAoa = [
    ['Month/Date', 'Firm Name', 'Product Category', 'Revenue Amount', 'Relationship Manager', 'Client Name'],
    ['2025-04-20', 'LLP', 'PMS', '300000', 'Rohan Sen', 'Client D'],
    ['2025-06-25', 'LLP', 'AIF', '400000', 'Amit Sharma', 'Client E'],
    ['2025-08-10', 'LLP', 'Bonds', '200000', 'Priya Patel', 'Client F']
  ];

  const ozaAoa = [
    ['Month/Date', 'Firm Name', 'Product Category', 'Revenue Amount', 'Relationship Manager', 'Client Name'],
    ['2025-04-22', 'OZA', 'Bonds', '200000', 'Priya Patel', 'Client G'],
    ['2025-05-28', 'OZA', 'GIFT City', '150000', 'Rohan Sen', 'Client H'],
    ['2025-07-15', 'OZA', 'FD', '100000', 'Amit Sharma', 'Client I']
  ];

  // Append sheets
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kfAoa), 'KF');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(llpAoa), 'LLP');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ozaAoa), 'OZA');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

module.exports = {
  parseAndValidateExcel,
  generateExcelTemplate,
  ALLOWED_CATEGORIES
};
