import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthProviderDto } from './auth-provider.dto';

export class AuthContextResponseDto {
    @ApiProperty({ description: 'Resolved brand domain (input echo, normalized)' })
    brandDomain!: string;

    @ApiPropertyOptional({ description: 'Brand UUID for the resolved domain', nullable: true })
    brandId!: string | null;

    @ApiProperty({ description: 'Whether the brand requires email verification before onboarding' })
    requireEmailVerification!: boolean;

    @ApiPropertyOptional({ description: 'Active program UUID for the brand', nullable: true })
    programId!: string | null;

    @ApiPropertyOptional({ description: 'Active program slug', nullable: true })
    programSlug!: string | null;

    @ApiPropertyOptional({ description: 'Local AuthProvider UUID (password login)', nullable: true })
    localProviderId!: string | null;

    @ApiProperty({ type: [AuthProviderDto], description: 'All active auth providers' })
    providers!: AuthProviderDto[];
}
