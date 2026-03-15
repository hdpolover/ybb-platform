import { ApiProperty } from '@nestjs/swagger';

export class MaintenanceSettingsDto {
  @ApiProperty({ example: false, description: 'Whether the brand/platform is in maintenance mode' })
  is_maintenance_mode: boolean;

  @ApiProperty({ example: 'We are upgrading our servers.', required: false, description: 'Message to display during maintenance' })
  message?: string;

  @ApiProperty({ example: '2024-12-31T23:59:59Z', required: false, description: 'Scheduled end time for maintenance' })
  scheduled_end?: Date;
}

export class BrandSettingsDto {
  @ApiProperty({ example: 'Youth Break the Boundaries', description: 'Name of the brand' })
  name: string;

  @ApiProperty({ example: 'https://example.com/logo.png', description: 'URL to the brand logo' })
  logo_url: string;

  @ApiProperty({ example: 'https://example.com/logo-white.png', required: false, description: 'White logo variant for dark backgrounds' })
  logo_white_url?: string;

  @ApiProperty({ example: 'https://example.com/logo-color.png', required: false, description: 'Alternative colored logo variant' })
  logo_color_url?: string;

  @ApiProperty({ example: 'https://example.com/icon.png', required: false, description: 'Icon logo variant' })
  logo_icon_url?: string;

  @ApiProperty({ example: '#123456', required: false, description: 'Primary brand color code (hex)' })
  primary_color?: string;

  @ApiProperty({ example: 'help@ybb.com', required: false, description: 'Support email address' })
  support_email?: string;

  @ApiProperty({ example: 'Empowering youth to break boundaries and shape a sustainable future.', required: false, description: 'Short brand description for footer and about sections' })
  description?: string;

  @ApiProperty({ example: 'UA-123456-1', required: false, description: 'Google Analytics Tracking ID' })
  google_analytics_id?: string;

  @ApiProperty({ example: '123456789', required: false, description: 'Meta/Facebook Pixel ID' })
  pixel_id?: string;

  @ApiProperty({ example: '+628123456789', required: false, description: 'Contact phone number' })
  contact_phone?: string;

  @ApiProperty({ example: '+628123456789', required: false, description: 'WhatsApp number' })
  contact_whatsapp?: string;

  @ApiProperty({ example: 'Jl. Malioboro No. 1, Yogyakarta', required: false, description: 'Physical address' })
  address?: string;

  @ApiProperty({ example: { instagram: '@username' }, required: false, description: 'Social media links object' })
  social_media?: any;
}

export class NavigationItemDto {
  @ApiProperty({ example: 'Label', description: 'Display label for the navigation link' })
  label: string;

  @ApiProperty({ example: '/url', description: 'Destination URL or path' })
  url: string;
}

export class FooterColumnDto {
  @ApiProperty({ example: 'Column Title', description: 'Title of the footer column' })
  title: string;

  @ApiProperty({ type: [NavigationItemDto], description: 'List of navigation items in this column' })
  items: NavigationItemDto[];
}

export class CurrencySettingsDto {
  @ApiProperty({ example: 'USD', description: 'Base currency code for the brand' })
  code: string;

  @ApiProperty({ example: 16000, description: 'Exchange rate to IDR' })
  rate_to_idr: number;
}

export class ActiveProgramDto {
  @ApiProperty({ example: 'id' }) id: string;
  @ApiProperty({ example: 'name' }) name: string;
  @ApiProperty({ example: 'slug' }) slug: string;
  @ApiProperty({ required: false }) year?: number;
  @ApiProperty({ required: false }) logo_url?: string;
  @ApiProperty({ required: false }) logo_white_url?: string;
  @ApiProperty({ required: false }) logo_color_url?: string;
  @ApiProperty({ required: false }) logo_icon_url?: string;
}

export class LandingSettingsResponseDto {
  @ApiProperty({ type: MaintenanceSettingsDto, description: 'Maintenance configuration' })
  maintenance: MaintenanceSettingsDto;

  @ApiProperty({ type: BrandSettingsDto, description: 'Branding information' })
  brand: BrandSettingsDto;

  @ApiProperty({ type: [FooterColumnDto], description: 'Footer navigation structure' })
  footer_navigation: FooterColumnDto[];

  @ApiProperty({ type: CurrencySettingsDto, description: 'Currency configuration' })
  currency: CurrencySettingsDto; @ApiProperty({ type: ActiveProgramDto, required: false }) active_program?: ActiveProgramDto;
}
