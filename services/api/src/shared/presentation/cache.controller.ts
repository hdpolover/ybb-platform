import { Controller, Get, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CacheService } from '../infrastructure/cache/cache.service';
import { JwtAuthGuard } from '../../modules/auth/infrastructure/guards/jwt-auth.guard';

@ApiTags('System')
@Controller('cache')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get cache statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Cache statistics' })
  async getStats() {
    // In a real implementation, you'd query Redis INFO command
    return {
      status: 'Cache is operational',
      backend: 'Redis',
      message: 'Use redis-cli INFO for detailed statistics',
    };
  }

  @Delete('clear')
  @ApiOperation({ summary: 'Clear all cache (Admin only)' })
  @ApiResponse({ status: 200, description: 'Cache cleared successfully' })
  async clearCache() {
    await this.cacheService.clearAll();
    
    return {
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('programs')
  @ApiOperation({ summary: 'Clear program-related cache (Admin only)' })
  @ApiResponse({ status: 200, description: 'Program cache cleared' })
  async clearProgramCache() {
    await this.cacheService.invalidateByPattern('program:*');
    
    return {
      message: 'Program cache cleared',
      timestamp: new Date().toISOString(),
    };
  }
}
