import { ApiProperty } from '@nestjs/swagger';

export class MaintenanceSettingsDto {
  @ApiProperty({ example: false })
  is_maintenance_mode: boolean;

  @ApiProperty({ example: 'We are upgrading our servers.', required: false })
  message?: string;

  @ApiProperty({ example: '2024-12-31T23:59:59Z', required: false })
  scheduled_end?: Date;
}

export class BrandSettingsDto {
  @ApiProperty({ example: 'Youth Break the Boundaries' })
  name: string;

  @ApiProperty({ example: 'https://example.com/logo.png' })
  logo_url: string;

  @ApiProperty({ example: '#123456', required: false })
  primary_color?: string;

  @ApiProperty({ example: 'help@ybb.com', required: false })
  support_email?: string;

  @ApiProperty({ example: 'UA-123456-1', required: false })
  google_analytics_id?: string;

  @ApiProperty({ example: '123456789', required: false })
  pixel_id?: string;
}

export class NavigationItemDto {
  @ApiProperty({ example: 'Label' })
  label: string;

  @ApiProperty({ example: '/url' })
  url: string;
}

export class FooterColumnDto {
  @ApiProperty({ example: 'Column Title' })
  title: string;

  @ApiProperty({ type: [NavigationItemDto] })
  items: NavigationItemDto[];
}

export class CurrencySettingsDto {
  @ApiProperty({ example: 'USD' })
  code: string;

  @ApiProperty({ example: 16000 })
  rate_to_idr: number;
}

export class LandingSettingsResponseDto {
  @ApiProperty({ type: MaintenanceSettingsDto })
  maintenance: MaintenanceSettingsDto;

  @ApiProperty({ type: BrandSettingsDto })
  brand: BrandSettingsDto;

  @ApiProperty({ type: [FooterColumnDto] })
  footer_navigation: FooterColumnDto[];

  @ApiProperty({ type: CurrencySettingsDto })
  currency: CurrencySettingsDto;
}
