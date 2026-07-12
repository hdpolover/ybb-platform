import { IsString, IsBoolean, IsInt, IsOptional, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// Field names are snake_case to match the Go payment service's JSON contract
// exactly (see program_payment_method_handler.go: upsertProgramMethodRequest).
// This body is forwarded to Go as-is — a camelCase mismatch would silently
// fail to bind (Go's json tags are snake_case), leaving every override field
// nil and clearing data the caller intended to keep.
export class UpsertProgramMethodDto {
    @ApiProperty({ required: false, description: 'Resolved enabled state for this method on the program. Omitted/null clears the override.' })
    @IsOptional()
    @IsBoolean()
    is_enabled?: boolean;

    @ApiProperty({ required: false, description: 'Program-specific description override. Omitted/null clears the override (master value applies).' })
    @IsOptional()
    @IsString()
    description_override?: string;

    @ApiProperty({ required: false, description: 'Program-specific instructions override. Omitted/null clears the override.' })
    @IsOptional()
    @IsString()
    instructions_override?: string;

    @ApiProperty({ required: false, description: 'Program-specific admin instructions override. Omitted/null clears the override.' })
    @IsOptional()
    @IsString()
    admin_instructions_override?: string;

    @ApiProperty({ required: false, description: 'Program-specific sort order override. Omitted/null clears the override.' })
    @IsOptional()
    @IsInt()
    sort_order?: number;
}

// One row of the bulk full-set upsert. PUT is full-replace: the caller must
// send the complete set of visible methods for the program on every call.
export class BulkProgramMethodEntryDto extends UpsertProgramMethodDto {
    @ApiProperty({ description: 'Master payment method ID (UUID) this override row applies to' })
    @IsString()
    payment_method_id: string;
}

export class BulkUpsertProgramMethodsDto {
    @ApiProperty({ type: [BulkProgramMethodEntryDto] })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => BulkProgramMethodEntryDto)
    methods: BulkProgramMethodEntryDto[];
}
