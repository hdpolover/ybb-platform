import { plainToInstance } from 'class-transformer';
import {
    CreateDocumentTemplateDto,
    UpdateDocumentTemplateDto,
    PreviewDocumentTemplateDto,
} from './create-update-program-content.dto';

/**
 * Reproduces a prod bug: without an element type on the `placeholders` array,
 * class-transformer's implicit conversion (main.ts ValidationPipe transformOptions)
 * rebuilds every element as `new Array()`, silently turning
 * [{key,label,source}, ...] into [[], [], ...] on write.
 */
const TRANSFORM_OPTIONS = { enableImplicitConversion: true };

const samplePlaceholders = [
    { key: '{{participant_name}}', label: 'Participant Full Name', source: 'participant.fullName' },
    { key: '{{program_name}}', label: 'Program Name', source: 'program.name' },
    { key: '{{acceptance_date}}', label: 'Acceptance Date', source: 'generated_at' },
];

describe('placeholders array survives class-transformer with enableImplicitConversion', () => {
    it('CreateDocumentTemplateDto keeps placeholder objects intact', () => {
        const dto = plainToInstance(
            CreateDocumentTemplateDto,
            {
                programId: '11111111-1111-1111-1111-111111111111',
                name: 'LOA Template',
                type: 'letter_of_acceptance',
                placeholders: samplePlaceholders,
            },
            TRANSFORM_OPTIONS,
        );

        expect(dto.placeholders).toHaveLength(3);
        dto.placeholders?.forEach((p, i) => {
            expect(p).toEqual(samplePlaceholders[i]);
        });
    });

    it('UpdateDocumentTemplateDto keeps placeholder objects intact', () => {
        const dto = plainToInstance(
            UpdateDocumentTemplateDto,
            { placeholders: samplePlaceholders },
            TRANSFORM_OPTIONS,
        );

        expect(dto.placeholders).toHaveLength(3);
        dto.placeholders?.forEach((p, i) => {
            expect(p).toEqual(samplePlaceholders[i]);
        });
    });

    it('PreviewDocumentTemplateDto keeps placeholder objects intact', () => {
        const dto = plainToInstance(
            PreviewDocumentTemplateDto,
            { htmlContent: '<p>{{participant_name}}</p>', placeholders: samplePlaceholders },
            TRANSFORM_OPTIONS,
        );

        expect(dto.placeholders).toHaveLength(3);
        dto.placeholders?.forEach((p, i) => {
            expect(p).toEqual(samplePlaceholders[i]);
        });
    });
});
