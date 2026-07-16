import { createMysqlConnection } from './mysql-config';

async function exploreSchema() {
    console.log('--- Exploring Remote MySQL Schema ---');
    const mysql = await createMysqlConnection();

    try {
        const potentialTables = [
            { table: 'competition_categories', cols: ['program_category_id'] },
            { table: 'program_photos', cols: ['program_category_id'] },
            { table: 'program_testimonies', cols: ['program_category_id'] },
            { table: 'programs', cols: ['program_category_id'] },
            { table: 'users', cols: ['program_category_id'] },
            { table: 'web_settings', cols: ['program_category_id'] },
            { table: 'participants', cols: ['category'] },
            { table: 'help_tickets', cols: ['category'] },
        ];

        for (const pt of potentialTables) {
            console.log(`\n--- Sampling table: ${pt.table} ---`);
            const [rows] = await mysql.execute(`SELECT ${pt.cols.join(', ')} FROM ${pt.table} LIMIT 5`);
            console.log(rows);
        }

        // Also check if any other tables have 'program_category_id' exactly
        const [allCols] = await mysql.execute(`
            SELECT TABLE_NAME, COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE COLUMN_NAME = 'program_category_id' 
            AND TABLE_SCHEMA = 'u1437096_ybb_master_app_db'
        `);
        console.log('\n--- Exact matches for program_category_id ---');
        console.log(allCols);

    } catch (e) {
        console.error('Error exploring schema:', e);
    } finally {
        await mysql.end();
    }
}

exploreSchema().catch(console.error);
