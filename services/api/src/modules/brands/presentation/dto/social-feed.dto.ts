import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateSocialFeedDto {
    @ApiProperty({ required: false, example: 'instagram' })
    @IsOptional()
    @IsString()
    platform?: string;

    @ApiProperty({ required: false, example: 'DI0abcd1234' })
    @IsOptional()
    @IsString()
    postId?: string;

    @ApiProperty({ example: 'https://instagram.com/p/DI0abcd1234/' })
    @IsUrl()
    permalink: string;

    @ApiProperty({ required: false, example: 'https://cdn.example.com/social/feed-1.jpg' })
    @IsOptional()
    @IsUrl()
    imageUrl?: string;

    @ApiProperty({ required: false, nullable: true, example: 'Registration is now OPEN! #IYS2026' })
    @IsOptional()
    @IsString()
    caption?: string;

    @ApiProperty({ required: false, example: '2026-04-26T11:45:00.000Z' })
    @IsOptional()
    @IsDateString()
    postedAt?: string;

    @ApiProperty({ required: false, default: true })
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateSocialFeedDto {
    @ApiProperty({ required: false, example: 'instagram' })
    @IsOptional()
    @IsString()
    platform?: string;

    @ApiProperty({ required: false, example: 'DI0abcd1234' })
    @IsOptional()
    @IsString()
    postId?: string;

    @ApiProperty({ required: false, example: 'https://instagram.com/p/DI0abcd1234/' })
    @IsOptional()
    @IsUrl()
    permalink?: string;

    @ApiProperty({ required: false, example: 'https://cdn.example.com/social/feed-1.jpg' })
    @IsOptional()
    @IsUrl()
    imageUrl?: string;

    @ApiProperty({ required: false, nullable: true, example: 'Registration is now OPEN! #IYS2026' })
    @IsOptional()
    @IsString()
    caption?: string;

    @ApiProperty({ required: false, example: '2026-04-26T11:45:00.000Z' })
    @IsOptional()
    @IsDateString()
    postedAt?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    isActive?: boolean;
}
