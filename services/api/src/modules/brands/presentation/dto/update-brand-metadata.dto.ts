import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdateBrandMetadataDto {
    @ApiProperty({
        description: 'Partial metadata object. Top-level keys are merged into existing metadata.',
        example: { benefits: { eyebrow: 'Program Benefits', title: 'Built for Students', groups: [] } },
    })
    @IsObject()
    patch!: Record<string, unknown>;
}
