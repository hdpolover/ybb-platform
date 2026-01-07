import { IsEmail, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({
        example: '123e4567-e89b-12d3-a456-426614174000',
        description: 'Program Category ID (brand scope) - Optional if domain is provided in request header',
        required: false
    })
    @IsUUID()
    @IsOptional()
    programCategoryId?: string;
}
