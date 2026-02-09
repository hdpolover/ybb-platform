
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsUUID, MinLength, IsOptional, IsArray } from 'class-validator';

export class CreateAdminDto {
    @ApiProperty()
    @IsEmail()
    email: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @ApiProperty({ minLength: 8 })
    @IsString()
    @MinLength(8)
    password: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsUUID()
    roleId?: string; // Admin Role ID

    @ApiProperty({ required: false, isArray: true })
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    brandIds?: string[]; // Brands this admin has access to
}
