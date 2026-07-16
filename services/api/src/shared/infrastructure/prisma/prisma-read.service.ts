import { Injectable } from '@nestjs/common';
import { MetricsService } from '../monitoring/metrics.service';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaReadService extends PrismaService {
  private readonly replicaEnabled: boolean;

  constructor(metricsService: MetricsService) {
    const readReplicaUrl = process.env.READ_REPLICA_URL?.trim();
    const primaryUrl = process.env.DATABASE_URL?.trim();
    const replicaEnabled = Boolean(readReplicaUrl && readReplicaUrl !== primaryUrl);

    super(metricsService, {
      connectionString: replicaEnabled ? readReplicaUrl : primaryUrl,
      poolEnvPrefix: replicaEnabled ? 'DATABASE_READ' : 'DATABASE',
      enablePoolMetrics: false,
      clientRole: replicaEnabled ? 'replica' : 'primary_fallback',
    });

    this.replicaEnabled = replicaEnabled;
  }

  isReplicaEnabled(): boolean {
    return this.replicaEnabled;
  }
}
