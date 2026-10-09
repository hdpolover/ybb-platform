// src/modules/portal/presentation/dto/join-portal-program.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class JoinPortalProgramDto {
    @ApiProperty({ description: 'Program (edition) to open an application for' })
    @IsUUID()
    programId: string;
}

export class JoinPortalProgramResponseDto {
    @ApiProperty({ enum: ['created', 'existing', 'closed'] })
    status: 'created' | 'existing' | 'closed';

    @ApiProperty()
    programId: string;

    @ApiProperty()
    programName: string;

    @ApiPropertyOptional({
        description: 'Set when the requested category was closed and the application was created under another',
    })
    categoryFallback?: { requested: string; assigned: string };
}
