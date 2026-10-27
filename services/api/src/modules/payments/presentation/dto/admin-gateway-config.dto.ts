import { IsString, IsBoolean, IsOptional, IsIn, IsUUID, ValidateBy, buildMessage } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const SUPPORTED_GATEWAY_PROVIDERS = ['midtrans', 'xendit', 'stripe', 'paypal'] as const;
export type SupportedGatewayProvider = typeof SUPPORTED_GATEWAY_PROVIDERS[number];

export const GATEWAY_MODES = ['sandbox', 'production'] as const;
export type GatewayMode = typeof GATEWAY_MODES[number];

// A config has exactly one scope: global, brand or program. The payment service
// enforces this too (400 + DB CHECK); failing here gives the admin a clean message.
const NotWithBrandId = () =>
    ValidateBy(
        {
            name: 'notWithBrandId',
            validator: {
                validate: (value: unknown, args) =>
                    value == null || (args?.object as { brand_id?: unknown }).brand_id == null,
                defaultMessage: buildMessage(
                    (eachPrefix) => `${eachPrefix}program_id and brand_id cannot both be set; a config has a single scope`,
                ),
            },
        },
    );

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

    @ApiProperty({ required: false, description: 'UUID of the program this config is scoped to. Mutually exclusive with brand_id.' })
    @IsOptional()
    @IsUUID()
    @NotWithBrandId()
    program_id?: string;
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

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    @NotWithBrandId()
    program_id?: string;
}

export class SetGatewayActiveDto {
    @ApiProperty()
    @IsBoolean()
    is_active: boolean;
}
