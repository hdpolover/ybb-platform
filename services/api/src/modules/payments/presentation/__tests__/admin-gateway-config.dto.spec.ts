// src/modules/payments/presentation/__tests__/admin-gateway-config.dto.spec.ts

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateGatewayConfigDto, UpdateGatewayConfigDto } from '../dto/admin-gateway-config.dto';

const UUID_A = '6c9627c6-1f2e-4a3b-8c4d-5e6f7a8b9c0d';
const UUID_B = '0b8e2c1a-9d3f-4e5a-a1b2-c3d4e5f60718';
const base = { provider: 'xendit', server_key: 'sk', client_key: 'ck' };

const errorsFor = async <T extends object>(cls: new () => T, body: object) =>
    (await validate(plainToInstance(cls, body))).map((e) => e.property);

describe('gateway config DTO scope', () => {
    it.each([
        ['create', CreateGatewayConfigDto, base],
        ['update', UpdateGatewayConfigDto, {}],
    ] as const)('%s accepts a program_id alone', async (_n, cls, extra) => {
        expect(await errorsFor(cls as new () => object, { ...extra, program_id: UUID_A })).toEqual([]);
    });

    it.each([
        ['create', CreateGatewayConfigDto, base],
        ['update', UpdateGatewayConfigDto, {}],
    ] as const)('%s accepts a brand_id alone', async (_n, cls, extra) => {
        expect(await errorsFor(cls as new () => object, { ...extra, brand_id: UUID_A })).toEqual([]);
    });

    it.each([
        ['create', CreateGatewayConfigDto, base],
        ['update', UpdateGatewayConfigDto, {}],
    ] as const)('%s rejects brand_id and program_id both set', async (_n, cls, extra) => {
        const errors = await errorsFor(cls as new () => object, { ...extra, brand_id: UUID_A, program_id: UUID_B });
        expect(errors).toContain('program_id');
    });

    it('rejects a non-UUID program_id', async () => {
        expect(await errorsFor(CreateGatewayConfigDto, { ...base, program_id: 'nope' })).toContain('program_id');
    });
});
