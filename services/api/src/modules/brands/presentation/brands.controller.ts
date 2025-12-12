import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { QueryBus } from '@nestjs/cqrs';
import { ListBrandsQuery } from '../application/queries/list-brands.query';
import { GetBrandDetailQuery } from '../application/queries/get-brand-detail.query';
import { ListBrandSponsorsQuery } from '../application/queries/list-brand-sponsors.query';
import { BrandResponseDto, SponsorResponseDto } from './dto/brand.dto';

@ApiTags('Brands')
@Controller('brands')
export class BrandsController {
    constructor(private readonly queryBus: QueryBus) { }

    @Get()
    @ApiOperation({ summary: 'List all brands' })
    @ApiResponse({ status: 200, description: 'Return list of brands', type: [BrandResponseDto] })
    async listBrands(): Promise<BrandResponseDto[]> {
        return this.queryBus.execute(new ListBrandsQuery());
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get brand detail' })
    @ApiResponse({ status: 200, description: 'Return brand detail', type: BrandResponseDto })
    @ApiResponse({ status: 404, description: 'Brand not found' })
    async getBrand(@Param('id') id: string): Promise<BrandResponseDto> {
        return this.queryBus.execute(new GetBrandDetailQuery(id));
    }

    @Get(':id/sponsors')
    @ApiOperation({ summary: 'List brand sponsors' })
    @ApiResponse({ status: 200, description: 'Return list of sponsors', type: [SponsorResponseDto] })
    async listSponsors(@Param('id') id: string): Promise<SponsorResponseDto[]> {
        return this.queryBus.execute(new ListBrandSponsorsQuery(id));
    }
}
