
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';

export class AdminLoginDto {
    @ApiProperty({ example: 'admin@ybb.co.id', description: 'Admin email address' })
    @NormalizeEmail()
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'password123', description: 'Admin password' })
    @IsString()
    @IsNotEmpty()
    password: string;
}
