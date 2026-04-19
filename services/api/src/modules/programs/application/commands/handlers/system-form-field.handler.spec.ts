import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  CreateSystemFormFieldHandler,
  UpdateSystemFormFieldHandler,
  DeleteSystemFormFieldHandler,
} from './system-form-field.handler';
import {
  CreateSystemFormFieldCommand,
  UpdateSystemFormFieldCommand,
  DeleteSystemFormFieldCommand,
} from '../system-form-field.commands';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('system form field handlers', () => {
  const mkPrisma = (
    opts: Partial<{
      findUnique: unknown;
      create: unknown;
      update: unknown;
    }> = {},
  ) =>
    ({
      systemFormFieldDefinition: {
        findUnique: jest.fn().mockResolvedValue(opts.findUnique ?? null),
        create: jest.fn().mockResolvedValue(opts.create ?? { id: 'new' }),
        update: jest.fn().mockResolvedValue(opts.update ?? { id: 'upd' }),
      },
    }) as unknown as PrismaService;

  describe('Create', () => {
    it('creates when key is free', async () => {
      const prisma = mkPrisma();
      const h = new CreateSystemFormFieldHandler(prisma);
      await h.execute(
        new CreateSystemFormFieldCommand({
          key: 'new_key',
          label: 'New',
          category: 'misc',
          type: 'text',
        }),
      );
      expect(
        (prisma.systemFormFieldDefinition.create as jest.Mock),
      ).toHaveBeenCalled();
    });

    it('rejects when key is a magic key', async () => {
      const prisma = mkPrisma();
      const h = new CreateSystemFormFieldHandler(prisma);
      await expect(
        h.execute(
          new CreateSystemFormFieldCommand({
            key: 'category',
            label: 'X',
            category: 'program_structure',
            type: 'radio',
          }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects create when key already exists and is active', async () => {
      const prisma = mkPrisma({
        findUnique: { key: 'x', isActive: true, deletedAt: null },
      });
      const h = new CreateSystemFormFieldHandler(prisma);
      await expect(
        h.execute(
          new CreateSystemFormFieldCommand({
            key: 'x',
            label: 'X',
            category: 'misc',
            type: 'text',
          }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows create when key exists but is soft-deleted', async () => {
      const prisma = mkPrisma({
        findUnique: { key: 'x', isActive: false, deletedAt: new Date() },
      });
      const h = new CreateSystemFormFieldHandler(prisma);
      await expect(
        h.execute(
          new CreateSystemFormFieldCommand({
            key: 'x',
            label: 'X',
            category: 'misc',
            type: 'text',
          }),
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('Update', () => {
    it('updates an existing row', async () => {
      const prisma = mkPrisma({ findUnique: { id: '1' } });
      const h = new UpdateSystemFormFieldHandler(prisma);
      await h.execute(new UpdateSystemFormFieldCommand('1', { label: 'Y' }));
      expect(
        (prisma.systemFormFieldDefinition.update as jest.Mock),
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: { label: 'Y' },
        }),
      );
    });

    it('rejects update on nonexistent id', async () => {
      const prisma = mkPrisma({ findUnique: null });
      const h = new UpdateSystemFormFieldHandler(prisma);
      await expect(
        h.execute(new UpdateSystemFormFieldCommand('nope', { label: 'Y' })),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('Delete', () => {
    it('soft-deletes a non-magic row', async () => {
      const prisma = mkPrisma({ findUnique: { id: '1', isMagic: false } });
      const h = new DeleteSystemFormFieldHandler(prisma);
      await h.execute(new DeleteSystemFormFieldCommand('1'));
      expect(
        (prisma.systemFormFieldDefinition.update as jest.Mock),
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
            isActive: false,
          }),
        }),
      );
    });

    it('rejects deleting a magic entry', async () => {
      const prisma = mkPrisma({ findUnique: { id: '1', isMagic: true } });
      const h = new DeleteSystemFormFieldHandler(prisma);
      await expect(
        h.execute(new DeleteSystemFormFieldCommand('1')),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects delete on nonexistent id', async () => {
      const prisma = mkPrisma({ findUnique: null });
      const h = new DeleteSystemFormFieldHandler(prisma);
      await expect(
        h.execute(new DeleteSystemFormFieldCommand('nope')),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
