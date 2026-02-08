import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

function inspect(fileName: string) {
    const filePath = path.join(__dirname, '../../../../migration_data', fileName);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const rows = parse(fileContent, {
        columns: false,
        skip_empty_lines: true,
        relax_column_count: true,
        delimiter: '\t',
        relax_quotes: true
    });

    console.log(`--- ${fileName} ---`);
    rows.forEach((row: any, idx: number) => {
        console.log(`Row ${idx}: ID=${row[0]}, Name=${row[2]}`);
    });
}

inspect('programs.csv');
