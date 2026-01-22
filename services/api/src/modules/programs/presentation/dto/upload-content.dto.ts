// Generic Upload DTO (can be reused)
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class UploadEntityImageDto {
    @ApiProperty({ type: 'string', format: 'binary' })
    file: any;
}

export class UploadProgramBrandingDto {
    @ApiProperty({ type: 'string', format: 'binary', description: 'Program Logo' })
    @IsOptional()
    logo?: any;

    @ApiProperty({ type: 'string', format: 'binary', description: 'Program Banner' })
    @IsOptional()
    banner?: any;
    
    @ApiProperty({ type: 'string', format: 'binary', description: 'Program Thumbnail' })
    @IsOptional()
    thumbnail?: any;
}
