const { parseAndValidateExcel, generateExcelTemplate } = require('./excelParser.cjs');

function runTests() {
  console.log('--- Starting Excel Parser Phase 2 Automated Tests ---');
  
  // 1. Generate the template
  console.log('Generating 3-sheet Excel template in memory...');
  const templateBuffer = generateExcelTemplate();
  if (!templateBuffer || templateBuffer.length === 0) {
    console.error('FAIL: Template generation returned empty buffer.');
    process.exit(1);
  }
  console.log('SUCCESS: Template buffer generated successfully. Size:', templateBuffer.length, 'bytes');

  // 2. Parse the generated template
  console.log('Parsing the generated multi-firm template buffer...');
  const parseResult = parseAndValidateExcel(templateBuffer);
  
  if (!parseResult.success) {
    console.error('FAIL: Parser rejected the official 3-sheet template. Errors:');
    console.error(parseResult.errors);
    process.exit(1);
  }
  
  console.log('SUCCESS: Multi-firm template parsed successfully.');
  console.log('Total records extracted:', parseResult.data.length);

  // 3. Validate parsed records count (3 in KF + 3 in LLP + 3 in OZA = 9 rows total)
  const expectedRows = 9;
  if (parseResult.data.length !== expectedRows) {
    console.error(`FAIL: Expected ${expectedRows} parsed rows, got ${parseResult.data.length}.`);
    process.exit(1);
  }
  console.log(`SUCCESS: Found exactly ${expectedRows} data records across all sheets.`);

  // 4. Validate record fields and firm attributes
  const firstRecord = parseResult.data[0];
  console.log('Inspecting first record format:', firstRecord);
  
  const expectedFields = [
    'date', 'month_year', 'year', 'quarter', 'fy', 'month_name', 
    'client_name', 'category', 'revenue_amount', 'rm_name', 'firm',
    'calendar_year', 'calendar_quarter', 'indian_fy', 'indian_quarter'
  ];
  for (const field of expectedFields) {
    if (firstRecord[field] === undefined) {
      console.error(`FAIL: Missing field "${field}" in parsed record.`);
      process.exit(1);
    }
  }
  console.log('SUCCESS: All expected fields are present and mapped.');

  // Validate sheet to firm binding
  const kfRecords = parseResult.data.filter(r => r.firm === 'KF');
  const llpRecords = parseResult.data.filter(r => r.firm === 'LLP');
  const ozaRecords = parseResult.data.filter(r => r.firm === 'OZA');

  if (kfRecords.length !== 3 || llpRecords.length !== 3 || ozaRecords.length !== 3) {
    console.error(`FAIL: Firm data separation error. KF: ${kfRecords.length}, LLP: ${llpRecords.length}, OZA: ${ozaRecords.length}`);
    process.exit(1);
  }
  console.log('SUCCESS: Firm data separated exactly matching sheet names (KF, LLP, OZA).');

  // 5. Check Indian Financial Year and Quarter mapping correctness
  // Record 0 (KF Sheet): Date 2025-04-15 -> Should map to FY 2025-26, Q1
  const recApril = parseResult.data.find(r => r.date === '2025-04-15');
  if (!recApril) {
    console.error('FAIL: Could not locate test record for 2025-04-15.');
    process.exit(1);
  }
  if (recApril.fy !== 'FY 2025-26' || recApril.quarter !== 'Q1' || recApril.calendar_year !== 2025 || recApril.calendar_quarter !== 'Q2') {
    console.error(`FAIL: Calendar/Fiscal mapping failed for April record. Got FY=${recApril.fy}, Q=${recApril.quarter}, CalYear=${recApril.calendar_year}, CalQ=${recApril.calendar_quarter}`);
    process.exit(1);
  }
  console.log('SUCCESS: Date "2025-04-15" mapped correctly to Indian "FY 2025-26" (Q1) and Calendar "2025" (Q2).');

  // Record 6 (LLP Sheet): Date 2025-08-10 -> Should map to FY 2025-26, Q2
  const recAugust = parseResult.data.find(r => r.date === '2025-08-10');
  if (!recAugust) {
    console.error('FAIL: Could not locate test record for 2025-08-10.');
    process.exit(1);
  }
  if (recAugust.fy !== 'FY 2025-26' || recAugust.quarter !== 'Q2' || recAugust.calendar_year !== 2025 || recAugust.calendar_quarter !== 'Q3') {
    console.error(`FAIL: Calendar/Fiscal mapping failed for August record. Got FY=${recAugust.fy}, Q=${recAugust.quarter}, CalYear=${recAugust.calendar_year}, CalQ=${recAugust.calendar_quarter}`);
    process.exit(1);
  }
  console.log('SUCCESS: Date "2025-08-10" mapped correctly to Indian "FY 2025-26" and "Q2" (Jul-Sep).');

  // 6. Check AIF Category normalization
  const aifRecord = parseResult.data.find(r => r.category === 'AIF');
  if (!aifRecord) {
    console.error('FAIL: Missing AIF category mapping record.');
    process.exit(1);
  }
  if (aifRecord.revenue_amount !== 450000 && aifRecord.revenue_amount !== 400000) {
    console.error('FAIL: Category value mapping failed for AIF.');
    process.exit(1);
  }
  console.log('SUCCESS: AIF category normalization and numerical value parsed correctly.');

  console.log('--- All Phase 2 automated backend validation tests passed successfully! ---');
}

runTests();
