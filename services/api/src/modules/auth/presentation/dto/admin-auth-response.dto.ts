
import { ApiProperty } from '@nestjs/swagger';
import { AuthResponseDto } from './auth-response.dto';

class AdminBrandSummaryDto {
    @ApiProperty()
    brandId: string;

    @ApiProperty()
    brandName: string;

    @ApiProperty()
    brandSlug: string;

    @ApiProperty()
    isActive: boolean;

    @ApiProperty({ required: false, nullable: true })
    logoUrl?: string | null;

    @ApiProperty()
    role: string;

    @ApiProperty({ type: [String] })
    permissions: string[];
}

class AdminProgramSummaryDto {
    @ApiProperty()
    programId: string;

    @ApiProperty()
    brandId: string;

    @ApiProperty()
    brandName: string;

    @ApiProperty()
    brandSlug: string;

    @ApiProperty()
    programName: string;

    @ApiProperty()
    programSlug: string;

    @ApiProperty()
    programYear: number;

    @ApiProperty()
    programStatus: string;

    @ApiProperty()
    isActive: boolean;

    @ApiProperty()
    startDate: Date;

    @ApiProperty()
    endDate: Date;

    @ApiProperty({ required: false, nullable: true })
    logoUrl?: string | null;

    @ApiProperty({ required: false, nullable: true })
    role: string | null;

    @ApiProperty({ type: [String] })
    permissions: string[];

    @ApiProperty({ enum: ['assigned', 'brand_scope', 'platform'] })
    accessType: 'assigned' | 'brand_scope' | 'platform';
}

export class AdminAuthResponseDto extends AuthResponseDto {
    @ApiProperty({
        description: 'Admin specific details',
        example: {
            id: 'uuid',
            fullName: 'Admin User',
            role: 'Super Admin',
            accessLevel: 1
        }
    })
    admin: {
        id: string;
        fullName: string;
        avatarUrl?: string;
        roleId: string;
        role: string;
        accessLevel: number;
        permissions: string[];
        customPermissions: string[];
        canManageAdmins: boolean;
        canAssignRoles: boolean;
        programs: AdminProgramSummaryDto[];
        accessiblePrograms: AdminProgramSummaryDto[];
        brands: AdminBrandSummaryDto[];
    };
}
