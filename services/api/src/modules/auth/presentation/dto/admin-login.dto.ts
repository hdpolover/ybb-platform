
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';

export class AdminLoginDto {
    @ApiProperty({ example: 'admin@ybb.co.id', description: 'Admin email address' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'password123', description: 'Admin password' })
    @IsString()
    @IsNotEmpty()
    password: string;
}
