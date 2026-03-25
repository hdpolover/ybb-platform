// Generic Upload DTO (can be reused)
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class UploadEntityImageDto {
    @ApiProperty({ type: 'string', format: 'binary' })
    file: Express.Multer.File;
}

export class UploadProgramBrandingDto {
    @ApiProperty({ type: 'string', format: 'binary', description: 'Program Logo' })
    @IsOptional()
    logo?: Express.Multer.File;

    @ApiProperty({ type: 'string', format: 'binary', description: 'Program Banner' })
    @IsOptional()
    banner?: Express.Multer.File;
    
    @ApiProperty({ type: 'string', format: 'binary', description: 'Program Thumbnail' })
    @IsOptional()
    thumbnail?: Express.Multer.File;
}
