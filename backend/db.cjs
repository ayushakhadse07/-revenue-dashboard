const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const DB_PATH = path.join(__dirname, 'data', 'db.json');
const BACKUP_PATH = path.join(__dirname, 'data', 'db.json.bak');
const TEMP_PATH = path.join(__dirname, 'data', 'db.json.tmp');

const DEFAULT_CATEGORIES = [
  { id: '1', name: 'Mutual Fund', target: 2000000 },
  { id: '2', name: 'PMS', target: 1500000 },
  { id: '3', name: 'AIF', target: 1500000 },
  { id: '4', name: 'Bonds', target: 1000000 },
  { id: '5', name: 'GIFT City', target: 800000 },
  { id: '6', name: 'Insurance', target: 1200000 },
  { id: '7', name: 'FD', target: 500000 }
];

let client = null;
let dbInstance = null;

async function connectToMongo() {
  if (dbInstance) return dbInstance;
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!uri) return null;
  try {
    client = new MongoClient(uri);
    await client.connect();
    dbInstance = client.db();
    console.log('Connected securely to MongoDB Atlas');
    return dbInstance;
  } catch (err) {
    console.error('Failed to connect to MongoDB Atlas:', err.message);
    dbInstance = null;
    return null;
  }
}

function getIndianFYAndQuarter(dateObj) {
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth(); // 0 = Jan, 11 = Dec
  
  let fyStart, fyEnd;
  if (month >= 3) { // April to December
    fyStart = year;
    fyEnd = (year + 1) % 100;
  } else { // January to March
    fyStart = year - 1;
    fyEnd = year % 100;
  }
  const fy = `FY ${fyStart}-${fyEnd < 10 ? '0' + fyEnd : fyEnd}`;

  let quarter = 'Q1';
  if (month >= 3 && month <= 5) quarter = 'Q1';       // April - June
  else if (month >= 6 && month <= 8) quarter = 'Q2';  // July - September
  else if (month >= 9 && month <= 11) quarter = 'Q3'; // October - December
  else if (month >= 0 && month <= 2) quarter = 'Q4';  // January - March

  return { fy, quarter };
}

function getCalendarQuarter(dateObj) {
  const month = dateObj.getMonth(); // 0 = Jan
  if (month >= 0 && month <= 2) return 'Q1';
  if (month >= 3 && month <= 5) return 'Q2';
  if (month >= 6 && month <= 8) return 'Q3';
  return 'Q4';
}


// Helper to generate seed data
function generateSeedRecords() {
  const records = [];
  const clients = ['Reliance Ind.', 'HDFC Bank', 'Tata Motors', 'Infosys Ltd.', 'Radhakishan Damani', 'Meera Nair', 'Aarav Mehta', 'Vikram Malhotra', 'Kiran Mazumdar', 'Aditya Birla Group'];
  const categories = ['Mutual Fund', 'PMS', 'AIF', 'Bonds', 'GIFT City', 'Insurance', 'FD'];
  const rms = ['Amit Sharma', 'Priya Patel', 'Rohan Sen'];
  const firms = ['KF', 'LLP', 'OZA'];

  const uploadId = 'seed_upload_01';

  // Seed data from Jan 2025 to June 2026 (18 months)
  const startDate = new Date(2025, 0, 1);
  const endDate = new Date(2026, 5, 30); // June 2026

  let current = new Date(startDate);
  
  // To create a realistic positive trend, we scale revenue slightly over time
  let growthFactor = 1.0;

  while (current <= endDate) {
    const year = current.getFullYear();
    const monthNum = current.getMonth() + 1;
    const monthFormatted = monthNum < 10 ? `0${monthNum}` : `${monthNum}`;
    const monthYearString = `${year}-${monthFormatted}`;
    const monthName = current.toLocaleString('default', { month: 'long' });

    // Indian Financial Year and Quarter mapping
    const { fy, quarter: indianQuarter } = getIndianFYAndQuarter(current);
    const calendarYear = current.getFullYear();
    const calendarQuarter = getCalendarQuarter(current);

    // Generate 6-8 transactions per month
    const numDeals = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numDeals; i++) {
      const client = clients[Math.floor(Math.random() * clients.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];
      const rm = rms[Math.floor(Math.random() * rms.length)];
      
      // Select Firm: distribute transactions among KF, LLP, OZA
      const firm = firms[(i + monthNum) % firms.length];

      // Revenue ranges based on category, scaled by growthFactor
      let baseRevenue = 50000;
      if (category === 'Mutual Fund') baseRevenue = 150000;
      else if (category === 'PMS') baseRevenue = 200000;
      else if (category === 'AIF') baseRevenue = 220000;
      else if (category === 'GIFT City') baseRevenue = 180000;
      else if (category === 'Bonds') baseRevenue = 100000;
      else if (category === 'Insurance') baseRevenue = 80000;
      else if (category === 'FD') baseRevenue = 40000;

      const randomVariation = 0.8 + Math.random() * 0.4; // 80% to 120%
      const revenue = Math.round(baseRevenue * growthFactor * randomVariation);

      const day = 5 + Math.floor(Math.random() * 23);
      const dayFormatted = day < 10 ? `0${day}` : `${day}`;
      const dateString = `${year}-${monthFormatted}-${dayFormatted}`;

      records.push({
        id: `seed_${monthYearString}_${i}`,
        upload_id: uploadId,
        date: dateString,
        month_year: monthYearString,
        year: calendarYear,
        quarter: indianQuarter,
        fy,
        calendar_year: calendarYear,
        calendar_quarter: calendarQuarter,
        indian_fy: fy,
        indian_quarter: indianQuarter,
        month_name: monthName,
        client_name: client,
        category,
        revenue_amount: revenue,
        rm_name: rm,
        firm
      });
    }

    // Increment growth factor by 2.5% each month to simulate corporate growth
    growthFactor += 0.025;
    
    // Move to next month
    current.setMonth(current.getMonth() + 1);
  }

  return {
    records,
    upload: {
      id: uploadId,
      filename: 'historical_revenue_seed.xlsx',
      upload_date: new Date().toISOString(),
      row_count: records.length,
      status: 'Success'
    }
  };
}

async function initializeDb() {
  const mongoDb = await connectToMongo();
  if (mongoDb) {
    try {
      const recordsCol = mongoDb.collection('revenue_records');
      const count = await recordsCol.countDocuments();
      if (count === 0) {
        console.log('MongoDB is empty. Seeding database with historical seed data...');
        const seed = generateSeedRecords();
        if (seed.records.length > 0) {
          await recordsCol.insertMany(seed.records);
        }
        await mongoDb.collection('upload_history').insertOne(seed.upload);
        await mongoDb.collection('categories').insertMany(DEFAULT_CATEGORIES);
        await mongoDb.collection('settings').insertOne({ security_pin: '1234' });
        console.log('MongoDB successfully seeded.');
      }
    } catch (err) {
      console.error('Error seeding MongoDB:', err);
    }
    return;
  }

  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    const seed = generateSeedRecords();
    const initialData = {
      revenue_records: seed.records,
      upload_history: [seed.upload],
      categories: DEFAULT_CATEGORIES,
      settings: {
        security_pin: '1234'
      }
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf8');
    
    // Create initial backup
    fs.copyFileSync(DB_PATH, BACKUP_PATH);
    console.log('Database initialized, seeded, and backed up.');
  }
}

async function getDb() {
  const mongoDb = await connectToMongo();
  if (mongoDb) {
    try {
      const revenue_records = await mongoDb.collection('revenue_records').find({}).toArray();
      const upload_history = await mongoDb.collection('upload_history').find({}).toArray();
      const categories = await mongoDb.collection('categories').find({}).toArray();
      const settingsList = await mongoDb.collection('settings').find({}).toArray();
      const settings = settingsList[0] || { security_pin: '1234' };
      return {
        revenue_records,
        upload_history,
        categories,
        settings
      };
    } catch (err) {
      console.error('Error reading from MongoDB, falling back to local database:', err);
    }
  }

  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Fallback 1: If database file is missing but backup exists, restore it
  if (!fs.existsSync(DB_PATH) && fs.existsSync(BACKUP_PATH)) {
    console.warn('Primary database file missing. Restoring from backup...');
    try {
      fs.copyFileSync(BACKUP_PATH, DB_PATH);
    } catch (err) {
      console.error('Failed to restore database from backup:', err);
    }
  }

  if (!fs.existsSync(DB_PATH)) {
    await initializeDb();
  }

  let rawData = '';
  try {
    rawData = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(rawData);
    if (!parsed.settings) {
      parsed.settings = { security_pin: '1234' };
      fs.writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2), 'utf8');
    }
    return parsed;
  } catch (error) {
    console.error('Error parsing JSON database. Attempting backup restore:', error);
    if (fs.existsSync(BACKUP_PATH)) {
      try {
        const backupRaw = fs.readFileSync(BACKUP_PATH, 'utf8');
        const parsed = JSON.parse(backupRaw);
        if (!parsed.settings) {
          parsed.settings = { security_pin: '1234' };
        }
        fs.copyFileSync(BACKUP_PATH, DB_PATH);
        console.warn('Corrupted database successfully restored from healthy backup.');
        return parsed;
      } catch (backupError) {
        console.error('Backup is also invalid or corrupted:', backupError);
      }
    }
    
    return {
      revenue_records: [],
      upload_history: [],
      categories: DEFAULT_CATEGORIES,
      settings: { security_pin: '1234' }
    };
  }
}

async function saveDb(data) {
  const mongoDb = await connectToMongo();
  if (mongoDb) {
    try {
      await mongoDb.collection('categories').deleteMany({});
      if (data.categories && data.categories.length > 0) {
        const cleanCategories = data.categories.map(({ _id, ...rest }) => rest);
        await mongoDb.collection('categories').insertMany(cleanCategories);
      }
      
      await mongoDb.collection('settings').deleteMany({});
      if (data.settings) {
        const { _id, ...cleanSettings } = data.settings;
        await mongoDb.collection('settings').insertOne(cleanSettings);
      }
      
      await mongoDb.collection('upload_history').deleteMany({});
      if (data.upload_history && data.upload_history.length > 0) {
        const cleanHistory = data.upload_history.map(({ _id, ...rest }) => rest);
        await mongoDb.collection('upload_history').insertMany(cleanHistory);
      }
      
      await mongoDb.collection('revenue_records').deleteMany({});
      if (data.revenue_records && data.revenue_records.length > 0) {
        const cleanRecords = data.revenue_records.map(({ _id, ...rest }) => rest);
        await mongoDb.collection('revenue_records').insertMany(cleanRecords);
      }
      
      console.log('MongoDB successfully updated.');
      return;
    } catch (err) {
      console.error('Failed to save to MongoDB:', err);
    }
  }

  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    try {
      fs.copyFileSync(DB_PATH, BACKUP_PATH);
    } catch (err) {
      console.error('Failed to create database backup:', err);
    }
  }

  try {
    const cleanData = {
      revenue_records: (data.revenue_records || []).map(({ _id, ...rest }) => rest),
      upload_history: (data.upload_history || []).map(({ _id, ...rest }) => rest),
      categories: (data.categories || []).map(({ _id, ...rest }) => rest),
      settings: data.settings ? (() => { const { _id, ...rest } = data.settings; return rest; })() : { security_pin: '1234' }
    };
    fs.writeFileSync(TEMP_PATH, JSON.stringify(cleanData, null, 2), 'utf8');
    fs.renameSync(TEMP_PATH, DB_PATH);
  } catch (err) {
    console.error('Failed to write database atomically, attempting standard fallback write:', err);
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (writeErr) {
      console.error('Critical database save failure:', writeErr);
    }
  }
}

module.exports = {
  initializeDb,
  getDb,
  saveDb,
  getIndianFYAndQuarter,
  getCalendarQuarter
};
