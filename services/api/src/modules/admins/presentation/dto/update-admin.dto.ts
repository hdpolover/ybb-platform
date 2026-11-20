
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsArray, IsBoolean, ArrayMaxSize } from 'class-validator';

export class UpdateAdminDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    fullName?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    roleId?: string;

    @ApiProperty({ required: false, isArray: true })
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    brandIds?: string[];

    @ApiProperty({ required: false, isArray: true })
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    programIds?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    // Extra permissions on top of the role. Keys are validated against the allow-list
    // in the handler (normalizeExtraPermissions); absent = leave the column unchanged.
    @ApiProperty({ required: false, isArray: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(64)
    @IsString({ each: true })
    customPermissions?: string[];
}
