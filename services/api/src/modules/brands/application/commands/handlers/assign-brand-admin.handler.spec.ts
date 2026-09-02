import { AssignBrandAdminHandler } from './assign-brand-admin.handler';
import { AssignBrandAdminCommand } from '../assign-brand-admin.command';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('AssignBrandAdminHandler', () => {
    const mockPrisma = {
        brand: { findUnique: jest.fn().mockResolvedValue({ id: 'brand-1' }) },
        admin: { findUnique: jest.fn().mockResolvedValue({ id: 'admin-1' }) },
        adminBrand: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'assignment-1' }),
        },
    };

    const handler = new AssignBrandAdminHandler(mockPrisma as unknown as PrismaService);

    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma.brand.findUnique.mockResolvedValue({ id: 'brand-1' });
        mockPrisma.admin.findUnique.mockResolvedValue({ id: 'admin-1' });
        mockPrisma.adminBrand.findUnique.mockResolvedValue(null);
    });

    it('always writes an empty permission list on a new assignment', async () => {
        await handler.execute(new AssignBrandAdminCommand('brand-1', 'admin-1', 'admin', 'assigner-1'));

        expect(mockPrisma.adminBrand.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ permissions: [] }),
            }),
        );
    });
});
