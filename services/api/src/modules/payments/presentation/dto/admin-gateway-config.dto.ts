import { IsString, IsBoolean, IsOptional, IsIn, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const SUPPORTED_GATEWAY_PROVIDERS = ['midtrans', 'xendit', 'stripe', 'paypal'] as const;
export type SupportedGatewayProvider = typeof SUPPORTED_GATEWAY_PROVIDERS[number];

export const GATEWAY_MODES = ['sandbox', 'production'] as const;
export type GatewayMode = typeof GATEWAY_MODES[number];

export class CreateGatewayConfigDto {
    @ApiProperty({ enum: SUPPORTED_GATEWAY_PROVIDERS })
    @IsString()
    @IsIn([...SUPPORTED_GATEWAY_PROVIDERS])
    provider: SupportedGatewayProvider;

    @ApiProperty({ enum: GATEWAY_MODES, required: false, default: 'sandbox' })
    @IsOptional()
    @IsString()
    @IsIn([...GATEWAY_MODES])
    mode?: GatewayMode;

    @ApiProperty({ description: 'Plaintext server key; encrypted at rest by the payment service' })
    @IsString()
    server_key: string;

    @ApiProperty({ description: 'Plaintext client key; encrypted at rest by the payment service' })
    @IsString()
    client_key: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    webhook_secret?: string;

    @ApiProperty({ required: false, default: true })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @ApiProperty({ required: false, description: 'UUID of the brand this config is scoped to. Omit for platform-wide.' })
    @IsOptional()
    @IsUUID()
    brand_id?: string;
}

export class UpdateGatewayConfigDto {
    @ApiProperty({ enum: SUPPORTED_GATEWAY_PROVIDERS, required: false })
    @IsOptional()
    @IsString()
    @IsIn([...SUPPORTED_GATEWAY_PROVIDERS])
    provider?: SupportedGatewayProvider;

    @ApiProperty({ enum: GATEWAY_MODES, required: false })
    @IsOptional()
    @IsString()
    @IsIn([...GATEWAY_MODES])
    mode?: GatewayMode;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    server_key?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    client_key?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    webhook_secret?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    brand_id?: string;
}

export class SetGatewayActiveDto {
    @ApiProperty()
    @IsBoolean()
    is_active: boolean;
}
