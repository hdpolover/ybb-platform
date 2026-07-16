import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

export const mysqlConfig = {
    host: process.env.REMOTE_MYSQL_HOST || '194.163.42.101',
    user: process.env.REMOTE_MYSQL_USER || 'u1437096_ybb_master_app_admin_user',
    password: process.env.REMOTE_MYSQL_PASSWORD || '7J8*^dFEa&lN',
    database: process.env.REMOTE_MYSQL_DATABASE || 'u1437096_ybb_master_app_db',
    port: parseInt(process.env.REMOTE_MYSQL_PORT || '3306'),
};

export async function createMysqlConnection() {
    return await mysql.createConnection(mysqlConfig);
}
