import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CacheCoreModule } from './cache-core.module';
import { CacheWarmingService } from './cache-warming.service';
import { RedisPubSubService } from '../redis/redis-pubsub.service';
import { CacheInvalidationInterceptor } from '../../interceptors/cache-invalidation.interceptor';

// Full cache surface: cache manager + CacheService/CacheMetricsService (via
// CacheCoreModule, re-exported wholesale -- both this module and CacheCoreModule
// are @Global, so this doesn't change ambient availability, but Nest requires
// an imported module to be listed as a MODULE, not as its individual provider
// tokens, to re-export it) plus cache warming, cross-instance invalidation
// pub/sub, and the @CacheInvalidate interceptor. For a process that genuinely
// needs all of that (the HTTP app; the payment-events RMQ consumer via
// PaymentsModule, which publishes cache invalidations other instances must
// receive). A consumer with no use for the three extras should import
// CacheCoreModule directly instead -- see bootstrap/consumer-infra.module.ts.
@Global()
@Module({
  imports: [CacheCoreModule],
  providers: [
    CacheWarmingService,
    RedisPubSubService,
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInvalidationInterceptor,
    },
  ],
  exports: [CacheCoreModule, CacheWarmingService, RedisPubSubService],
})
export class CacheModule { }

