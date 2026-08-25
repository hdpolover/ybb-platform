// Generic Upload DTO (can be reused)
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class UploadEntityImageDto {
    @ApiProperty({ type: 'string', format: 'binary' })
    file: Express.Multer.File;
}

// Multipart form fields arrive as strings ("true"/"false"), never real
// booleans — `Boolean("false")` is `true`, so truthiness checks are a trap.
// Only the literal strings "true"/"false" (or an already-parsed boolean) are
// accepted; anything else is passed through so @IsBoolean rejects it with a
// clear 400 instead of silently coercing.
//
// The fields below are typed `boolean | string` rather than `boolean`: the
// global ValidationPipe runs with `enableImplicitConversion: true`, and
// class-transformer's implicit conversion reads the TS-emitted design:type
// metadata and runs `Boolean(value)` on the raw string BEFORE this
// @Transform executes when the property is declared as plain `boolean` —
// silently turning "false" into `true` upstream of our own guard. A union
// type makes TypeScript emit `Object` instead of `Boolean`, which skips
// that implicit step entirely and lets this transform see the raw string.
function parseMultipartBoolean({ value }: { value: unknown }): unknown {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
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

    @ApiProperty({ type: 'boolean', required: false, description: 'Clear the program logo (mutually exclusive with uploading a new logo)' })
    @IsOptional()
    @Transform(parseMultipartBoolean)
    @IsBoolean()
    clearLogo?: boolean | string;

    @ApiProperty({ type: 'boolean', required: false, description: 'Clear the program banner (mutually exclusive with uploading a new banner)' })
    @IsOptional()
    @Transform(parseMultipartBoolean)
    @IsBoolean()
    clearBanner?: boolean | string;

    @ApiProperty({ type: 'boolean', required: false, description: 'Clear the program thumbnail (mutually exclusive with uploading a new thumbnail)' })
    @IsOptional()
    @Transform(parseMultipartBoolean)
    @IsBoolean()
    clearThumbnail?: boolean | string;
}
