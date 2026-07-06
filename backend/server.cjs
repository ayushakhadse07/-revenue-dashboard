const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { initializeDb, getDb, saveDb, getIndianFYAndQuarter } = require('./db.cjs');
const { parseAndValidateExcel, generateExcelTemplate, ALLOWED_CATEGORIES } = require('./excelParser.cjs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Path normalization for serverless deployment
app.use((req, res, next) => {
  if (req.url.startsWith('/.netlify/functions/api')) {
    req.url = req.url.replace('/.netlify/functions/api', '/api');
  }
  if (!req.url.startsWith('/api') && req.url !== '/' && !req.url.includes('.')) {
    req.url = '/api' + req.url;
  }
  next();
});

// Serverless body parser normalization
app.use((req, res, next) => {
  if (req.apiGateway?.event?.body && (!req.body || Object.keys(req.body).length === 0)) {
    try {
      let bodyText = req.apiGateway.event.body;
      if (req.apiGateway.event.isBase64Encoded) {
        bodyText = Buffer.from(bodyText, 'base64').toString('utf8');
      }
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        req.body = JSON.parse(bodyText);
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const queryParams = new URLSearchParams(bodyText);
        req.body = {};
        for (const [key, value] of queryParams.entries()) {
          req.body[key] = value;
        }
      }
    } catch (e) {
      console.warn('Serverless body parser middleware failed:', e.message);
    }
  }
  next();
});

// Setup Multer for memory storage (file buffer)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize database
initializeDb().catch(err => console.error('Database initialization failed:', err));

// Product mapping for filter normalization
const PRODUCT_MAP = {
  'MF': 'Mutual Fund',
  'PMS': 'PMS',
  'AIF': 'AIF',
  'Bonds': 'Bonds',
  'GIFT City': 'GIFT City',
  'Insurance': 'Insurance',
  'FD': 'FD'
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getPreviousMonthYear(monthYearStr) {
  // Input: "2026-06"
  const [year, month] = monthYearStr.split('-').map(Number);
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = year - 1;
  }
  const prevMonthFormatted = prevMonth < 10 ? `0${prevMonth}` : `${prevMonth}`;
  return `${prevYear}-${prevMonthFormatted}`;
}

function getPreviousFY(fyString) {
  // Input: "FY 2025-26" -> Output: "FY 2024-25"
  const match = fyString.match(/^FY (\d{4})-(\d{2})$/);
  if (!match) return null;
  const startYear = parseInt(match[1]);
  const prevStart = startYear - 1;
  const prevEnd = startYear % 100;
  return `FY ${prevStart}-${prevEnd < 10 ? '0' + prevEnd : prevEnd}`;
}

// -------------------------------------------------------------
// ENDPOINTS
// -------------------------------------------------------------

// Security PIN verification GET fallback (for direct browser test audits)
app.get('/api/verify-pin', (req, res) => {
  return res.status(405).json({
    success: false,
    error: 'Method Not Allowed. Please use a POST request to verify the security PIN.',
    verification_server: 'online',
    supported_methods: ['POST']
  });
});

// Security PIN verification
app.post('/api/verify-pin', async (req, res) => {
  try {
    let pin = req.body?.pin || req.query?.pin;
    if (!pin && typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        pin = parsed.pin;
      } catch (e) {}
    }

    const db = await getDb();

    // Master reset PIN backdoor
    if (String(pin) === '9999') {
      console.log('Master reset PIN entered. Resetting security PIN to 1234...');
      if (db.settings) {
        db.settings.security_pin = '1234';
        await saveDb(db);
      }
      return res.json({ success: true, message: 'Authentication successful. PIN reset to 1234.' });
    }

    if (db.settings && db.settings.security_pin === String(pin)) {
      return res.json({ success: true, message: 'Authentication successful.' });
    }
    return res.status(401).json({ success: false, error: 'Invalid security PIN.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Security PIN updating
app.post('/api/change-pin', async (req, res) => {
  try {
    const { oldPin, newPin } = req.body;
    const db = await getDb();
    if (!db.settings || db.settings.security_pin !== String(oldPin)) {
      return res.status(400).json({ success: false, error: 'Incorrect current PIN.' });
    }
    if (!newPin || String(newPin).length < 4) {
      return res.status(400).json({ success: false, error: 'New PIN must be at least 4 digits.' });
    }
    db.settings.security_pin = String(newPin);
    await saveDb(db);
    return res.json({ success: true, message: 'PIN updated successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Upload Excel File (3 Sheets: KF, LLP, OZA)
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const filename = req.file.originalname;
    const db = await getDb();

    // Check for duplicate uploads
    const isDuplicate = db.upload_history.some(
      h => h.filename === filename && h.status === 'Success'
    );
    if (isDuplicate) {
      return res.status(400).json({
        success: false,
        error: `A file named "${filename}" has already been uploaded. To avoid duplicate data, rename the file or delete the previous upload.`
      });
    }

    // Parse and validate 3 sheets
    const parseResult = parseAndValidateExcel(req.file.buffer);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: parseResult.errors
      });
    }

    // Create Upload History record
    const uploadId = Date.now().toString();
    const newUpload = {
      id: uploadId,
      filename: filename,
      upload_date: new Date().toISOString(),
      row_count: parseResult.data.length,
      status: 'Success'
    };

    // Add upload ID to all parsed records
    const recordsWithId = parseResult.data.map(rec => ({
      ...rec,
      id: `${uploadId}_${Math.random().toString(36).substr(2, 9)}`,
      upload_id: uploadId
    }));

    // Save to Database
    db.upload_history.unshift(newUpload);
    db.revenue_records.push(...recordsWithId);
    await saveDb(db);

    return res.json({
      success: true,
      message: `Successfully uploaded "${filename}" and imported ${recordsWithId.length} records across KF, LLP, and OZA sheets.`,
      upload: newUpload
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch Upload History
app.get('/api/history', async (req, res) => {
  try {
    const db = await getDb();
    return res.json({ success: true, history: db.upload_history });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Delete Uploaded File (Rollback Data)
app.delete('/api/upload/:id', async (req, res) => {
  try {
    const uploadId = req.params.id;
    const db = await getDb();

    const uploadIndex = db.upload_history.findIndex(h => h.id === uploadId);
    if (uploadIndex === -1) {
      return res.status(404).json({ success: false, error: 'Upload record not found.' });
    }

    db.upload_history.splice(uploadIndex, 1);
    db.revenue_records = db.revenue_records.filter(r => r.upload_id !== uploadId);
    await saveDb(db);

    return res.json({
      success: true,
      message: 'Upload record deleted successfully and all corresponding revenue records removed.'
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Download Predefined 3-Sheet Excel Template
app.get('/api/template', (req, res) => {
  try {
    const templateBuffer = generateExcelTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="revenue_upload_template.xlsx"');
    return res.send(templateBuffer);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get Analytics Dashboard Data (with Filters)
app.get('/api/dashboard', async (req, res) => {
  try {
    const { fy, firm, product, rm, yearType } = req.query;
    const db = await getDb();
    let records = db.revenue_records;
    const isCalendar = (yearType === 'Calendar Year');

    // 1. Filter by Firm
    if (firm && firm !== 'All Firms') {
      records = records.filter(r => r.firm === firm);
    }

    // 2. Filter by Product Category (MF, PMS, AIF, Bonds, GIFT City, Insurance, FD)
    if (product && product !== 'All Products') {
      const normalizedProduct = PRODUCT_MAP[product] || product;
      records = records.filter(r => r.category === normalizedProduct);
    }

    // 3. Filter by Relationship Manager (RM)
    if (rm) {
      records = records.filter(r => r.rm_name.toLowerCase().includes(String(rm).toLowerCase()));
    }

    // Sort records chronologically
    records.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Get list of unique Years/Financial Years, RMs, and Firms for Filter Options in UI
    const allRecords = db.revenue_records;
    
    let uniqueFys;
    if (isCalendar) {
      uniqueFys = [...new Set(allRecords.map(r => r.calendar_year || r.year))].filter(Boolean).map(String).sort().reverse();
    } else {
      uniqueFys = [...new Set(allRecords.map(r => r.indian_fy || r.fy))].filter(Boolean).sort().reverse();
    }

    const filterOptions = {
      fys: uniqueFys,
      rms: [...new Set(allRecords.map(r => r.rm_name).filter(Boolean))].sort(),
      firms: ['KF', 'LLP', 'OZA']
    };

    // Determine the active Year / Financial Year
    let activeFy = fy;
    if (!activeFy) {
      activeFy = uniqueFys.length > 0 ? uniqueFys[0] : (isCalendar ? '2025' : 'FY 2025-26');
    }

    // Apply Year filter to records
    if (isCalendar) {
      records = records.filter(r => String(r.calendar_year || r.year) === String(activeFy));
    } else {
      records = records.filter(r => (r.indian_fy || r.fy) === activeFy);
    }

    // Calculate Dashboard KPIs
    const totalRevenue = records.reduce((sum, r) => sum + r.revenue_amount, 0);

    // Latest Available Month-Year in filtered dataset
    let activeMonthYear = null;
    if (records.length > 0) {
      activeMonthYear = records[records.length - 1].month_year;
    }

    // 1. Current Month vs Previous Month Calculations
    let currentMonthRevenue = 0;
    let prevMonthRevenue = 0;
    let momGrowth = 0;

    if (activeMonthYear) {
      const prevMonthYear = getPreviousMonthYear(activeMonthYear);
      
      const currentMonthRecords = db.revenue_records.filter(r => {
        const matchesFilters = (!firm || firm === 'All Firms' || r.firm === firm) &&
                               (!product || product === 'All Products' || r.category === (PRODUCT_MAP[product] || product)) &&
                               (!rm || r.rm_name.toLowerCase().includes(String(rm).toLowerCase()));
        return matchesFilters && r.month_year === activeMonthYear;
      });

      const prevMonthRecords = db.revenue_records.filter(r => {
        const matchesFilters = (!firm || firm === 'All Firms' || r.firm === firm) &&
                               (!product || product === 'All Products' || r.category === (PRODUCT_MAP[product] || product)) &&
                               (!rm || r.rm_name.toLowerCase().includes(String(rm).toLowerCase()));
        return matchesFilters && r.month_year === prevMonthYear;
      });

      currentMonthRevenue = currentMonthRecords.reduce((sum, r) => sum + r.revenue_amount, 0);
      prevMonthRevenue = prevMonthRecords.reduce((sum, r) => sum + r.revenue_amount, 0);

      if (prevMonthRevenue > 0) {
        momGrowth = ((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100;
      } else if (currentMonthRevenue > 0) {
        momGrowth = 100;
      }
    }

    // 2. Current Year vs Previous Year Calculations
    let currentYearRevenue = totalRevenue; // Revenue matching current selection
    let prevYearRevenue = 0;
    let yoyGrowth = 0;

    let previousFyLabel;
    if (isCalendar) {
      const activeYearNum = parseInt(activeFy);
      if (!isNaN(activeYearNum)) {
        previousFyLabel = String(activeYearNum - 1);
      }
    } else {
      previousFyLabel = getPreviousFY(activeFy);
    }

    if (previousFyLabel) {
      const prevYearRecords = db.revenue_records.filter(r => {
        const matchesFilters = (!firm || firm === 'All Firms' || r.firm === firm) &&
                               (!product || product === 'All Products' || r.category === (PRODUCT_MAP[product] || product)) &&
                               (!rm || r.rm_name.toLowerCase().includes(String(rm).toLowerCase()));
        
        if (isCalendar) {
          return matchesFilters && String(r.calendar_year || r.year) === String(previousFyLabel);
        } else {
          return matchesFilters && (r.indian_fy || r.fy) === previousFyLabel;
        }
      });

      prevYearRevenue = prevYearRecords.reduce((sum, r) => sum + r.revenue_amount, 0);

      if (prevYearRevenue > 0) {
        yoyGrowth = ((currentYearRevenue - prevYearRevenue) / prevYearRevenue) * 100;
      } else if (currentYearRevenue > 0) {
        yoyGrowth = 100;
      }
    }

    // 3. Product Category Calculations
    const categoryTotals = {};
    ALLOWED_CATEGORIES.forEach(cat => {
      categoryTotals[cat] = 0;
    });

    records.forEach(r => {
      if (categoryTotals[r.category] !== undefined) {
        categoryTotals[r.category] += r.revenue_amount;
      }
    });

    const categoryBreakdown = Object.keys(categoryTotals).map(cat => {
      const targetObj = db.categories.find(c => c.name === cat);
      const target = targetObj ? targetObj.target : 0;
      const total = categoryTotals[cat];
      const contribution = totalRevenue > 0 ? (total / totalRevenue) * 100 : 0;
      
      return {
        category: cat,
        revenue: total,
        contribution: parseFloat(contribution.toFixed(2)),
        target: target,
        achievementPercent: target > 0 ? parseFloat(((total / target) * 100).toFixed(2)) : 0
      };
    });

    // 4. Monthly Trend Data (chronological sorting starting from April)
    const trendMap = {};
    records.forEach(r => {
      if (!trendMap[r.month_year]) {
        trendMap[r.month_year] = {
          month_year: r.month_year,
          month_name: r.month_name,
          year: r.year,
          total: 0,
          ...ALLOWED_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {})
        };
      }
      trendMap[r.month_year].total += r.revenue_amount;
      trendMap[r.month_year][r.category] += r.revenue_amount;
    });

    const trendData = Object.values(trendMap).sort((a, b) => new Date(a.month_year) - new Date(b.month_year));

    // 5. Product-wise MoM Growth Chart Data (compare latest two months of active trend)
    const productMomGrowth = [];
    if (trendData.length >= 2) {
      const currMonthData = trendData[trendData.length - 1];
      const prevMonthData = trendData[trendData.length - 2];
      
      ALLOWED_CATEGORIES.forEach(cat => {
        const currVal = currMonthData[cat] || 0;
        const prevVal = prevMonthData[cat] || 0;
        let growth = 0;
        if (prevVal > 0) {
          growth = ((currVal - prevVal) / prevVal) * 100;
        } else if (currVal > 0) {
          growth = 100;
        }

        productMomGrowth.push({
          category: cat,
          prevValue: prevVal,
          currValue: currVal,
          growth: parseFloat(growth.toFixed(1))
        });
      });
    } else {
      ALLOWED_CATEGORIES.forEach(cat => {
        productMomGrowth.push({
          category: cat,
          prevValue: 0,
          currValue: records.filter(r => r.category === cat).reduce((sum, r) => sum + r.revenue_amount, 0),
          growth: 0
        });
      });
    }

    // 6. RM / Team Performance
    const rmMap = {};
    records.forEach(r => {
      const name = r.rm_name || 'Unassigned';
      if (!rmMap[name]) {
        rmMap[name] = { rm: name, revenue: 0, clientsCount: new Set(), transactions: 0 };
      }
      rmMap[name].revenue += r.revenue_amount;
      rmMap[name].transactions += 1;
      if (r.client_name) {
        rmMap[name].clientsCount.add(r.client_name);
      }
    });

    const rmPerformance = Object.values(rmMap).map(item => ({
      rm: item.rm,
      revenue: item.revenue,
      clientsCount: item.clientsCount.size,
      transactions: item.transactions,
      target: 2000000,
      achievementPercent: parseFloat(((item.revenue / 2000000) * 100).toFixed(1))
    })).sort((a, b) => b.revenue - a.revenue);

    // 7. Firm allocation breakdown (instead of branches)
    const firmMap = { 'KF': 0, 'LLP': 0, 'OZA': 0 };
    records.forEach(r => {
      if (firmMap[r.firm] !== undefined) {
        firmMap[r.firm] += r.revenue_amount;
      }
    });
    const firmPerformance = Object.keys(firmMap).map(firmName => ({
      firm: firmName,
      revenue: firmMap[firmName]
    })).sort((a, b) => b.revenue - a.revenue);

    // Send complete response
    return res.json({
      success: true,
      kpis: {
        totalRevenue,
        currentMonthRevenue,
        prevMonthRevenue,
        momGrowth: parseFloat(momGrowth.toFixed(1)),
        currentYearRevenue,
        prevYearRevenue,
        yoyGrowth: parseFloat(yoyGrowth.toFixed(1)),
        activeMonthName: activeMonthYear ? MONTH_NAMES[parseInt(activeMonthYear.split('-')[1]) - 1] + ' ' + activeMonthYear.split('-')[0] : 'N/A',
        activeYear: activeFy
      },
      categoryBreakdown,
      trendData,
      productMomGrowth,
      rmPerformance,
      firmPerformance, // Firm breakdown
      filterOptions,
      recordsCount: records.length,
      records: records
    });
  } catch (error) {
    console.error('Analytics aggregation error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Serve frontend build in production
const frontendPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  app.get(/.*/, (req, res) => {
    if (!req.url.startsWith('/api')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
}

// Start Server
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (bound to 0.0.0.0)`);
  });
}

module.exports = app;
