import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, type QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ||
      'postgresql://ybb_user:ybb_password@localhost:5438/ybb_platform_db';
    this.pool = new Pool({ connectionString });
  }

  async query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query<T>(text, params);
    return result.rows;
  }

  async ping(): Promise<void> {
    await this.pool.query('select 1');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
