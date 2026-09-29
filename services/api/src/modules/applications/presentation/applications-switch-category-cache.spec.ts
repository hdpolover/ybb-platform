// src/modules/applications/presentation/applications-switch-category-cache.spec.ts
import 'reflect-metadata';
import { ApplicationsController } from './applications.controller';
import { CACHE_INVALIDATE_KEY } from '@shared/decorators/cache-invalidate.decorator';

// The admin list (FF/SF tabs) is cached for 5 minutes under application:list:*.
// A category switch changes which tab a row belongs to, so the route MUST bust
// that cache or the moved participant lingers in the old tab.
describe('ApplicationsController.switchCategory cache invalidation', () => {
  it('invalidates the cached admin application list', () => {
    const patterns = Reflect.getMetadata(
      CACHE_INVALIDATE_KEY,
      ApplicationsController.prototype.switchCategory,
    ) as string[] | undefined;

    expect(patterns).toContain('application:list:*');
  });
});
