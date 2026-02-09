
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsArray, IsBoolean } from 'class-validator';

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

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
