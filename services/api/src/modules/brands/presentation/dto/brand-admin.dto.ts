import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional } from 'class-validator';

export class AssignBrandAdminDto {
    @ApiProperty({ example: 'uuid-of-admin', description: 'Admin ID to assign to this brand' })
    @IsUUID()
    adminId: string;

    @ApiProperty({ example: 'admin', description: 'Role in this brand', required: false })
    @IsOptional()
    @IsString()
    roleInBrand?: string;
}

export class BrandAdminResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    adminId: string;

    @ApiProperty()
    brandId: string;

    @ApiProperty({ required: false, nullable: true })
    roleInBrand?: string | null;

    @ApiProperty({ type: Object })
    permissions: unknown;

    @ApiProperty()
    assignedAt: Date;

    @ApiProperty({ required: false })
    admin?: {
        id: string;
        fullName: string;
        user?: { email: string } | null;
    };
}
