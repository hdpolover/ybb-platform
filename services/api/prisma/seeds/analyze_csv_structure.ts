import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const filePath = path.join(__dirname, '../../../../migration_data/payments.csv');
const fileContent = fs.readFileSync(filePath, 'utf-8');
const rows = parse(fileContent, {
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
    delimiter: '\t',
    relax_quotes: true,
    to: 100
});

rows.forEach((row: any[], i: number) => {
    const emailIdx = row.findIndex(c => c && typeof c === 'string' && c.includes('@'));
    const urlIdx = row.findIndex(c => c && typeof c === 'string' && c.startsWith('http'));
    const amountIdx = row.findIndex(c => !isNaN(parseFloat(c)) && parseFloat(c) > 1000); // Usually large amount

    console.log(`Row ${i}: size=${row.length}, emailIdx=${emailIdx}, urlIdx=${urlIdx}, amountIdx=${amountIdx}`);
    if (i < 5) console.log(row.slice(0, 20));
});
