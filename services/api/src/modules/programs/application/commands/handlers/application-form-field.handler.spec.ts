import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import {
  CreateApplicationFormFieldHandler,
  UpdateApplicationFormFieldHandler,
} from './application-form-field.handler';
import {
  CreateApplicationFormFieldCommand,
  UpdateApplicationFormFieldCommand,
} from '../application-form-field.commands';
import {
  FormFieldKeyValidator,
  FieldKeyValidationError,
} from '../../validators/form-field-key.validator';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FormFieldType } from '../../dto/application-form-field/create-application-form-field.dto';

describe('CreateApplicationFormFieldHandler', () => {
  const mockRepo = { createFormField: jest.fn(), updateFormField: jest.fn() };
  const mockValidator = { validateCustomKey: jest.fn() };
  const mockPrisma = {
    systemFormFieldDefinition: { findUnique: jest.fn() },
  };

  let handler: CreateApplicationFormFieldHandler;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateApplicationFormFieldHandler,
        { provide: 'IProgramContentRepository', useValue: mockRepo },
        { provide: FormFieldKeyValidator, useValue: mockValidator },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    handler = moduleRef.get(CreateApplicationFormFieldHandler);
  });

  it('accepts a valid custom field', async () => {
    mockValidator.validateCustomKey.mockResolvedValue(undefined);
    mockRepo.createFormField.mockResolvedValue({ id: 'f1' });

    await handler.execute(
      new CreateApplicationFormFieldCommand(
        'p1',
        {
          fieldName: 'volunteer_experience',
          label: 'Volunteer Experience',
          fieldType: FormFieldType.TEXTAREA,
        },
        'u1',
      ),
    );

    expect(mockValidator.validateCustomKey).toHaveBeenCalledWith('volunteer_experience');
    expect(mockRepo.createFormField).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'custom', name: 'volunteer_experience' }),
    );
  });

  it('rejects a custom field with a reserved key', async () => {
    mockValidator.validateCustomKey.mockRejectedValue(
      new FieldKeyValidationError('reserved_magic', 'nope'),
    );

    await expect(
      handler.execute(
        new CreateApplicationFormFieldCommand(
          'p1',
          {
            fieldName: 'category',
            label: 'Category',
            fieldType: FormFieldType.RADIO,
          },
          'u1',
        ),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects custom field with missing fieldName', async () => {
    await expect(
      handler.execute(
        new CreateApplicationFormFieldCommand(
          'p1',
          {
            label: 'X',
            fieldType: FormFieldType.TEXT,
          },
          'u1',
        ),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('accepts a system field and backfills name from systemFieldKey', async () => {
    mockPrisma.systemFormFieldDefinition.findUnique.mockResolvedValue({
      key: 'tshirt_size',
      type: 'radio',
      isActive: true,
      deletedAt: null,
    });
    mockRepo.createFormField.mockResolvedValue({ id: 'f2' });

    await handler.execute(
      new CreateApplicationFormFieldCommand(
        'p1',
        {
          source: 'system',
          systemFieldKey: 'tshirt_size',
          label: 'T-Shirt Size',
          fieldType: FormFieldType.RADIO,
        },
        'u1',
      ),
    );

    expect(mockValidator.validateCustomKey).not.toHaveBeenCalled();
    expect(mockRepo.createFormField).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'system',
        systemFieldKey: 'tshirt_size',
        name: 'tshirt_size',
      }),
    );
  });

  it('uses the catalog type for a system field, ignoring a conflicting client fieldType', async () => {
    mockPrisma.systemFormFieldDefinition.findUnique.mockResolvedValue({
      key: 'phone',
      type: 'phone',
      placeholder: null,
      helpText: null,
      defaultOptions: [],
      isActive: true,
      deletedAt: null,
    });
    mockRepo.createFormField.mockResolvedValue({ id: 'f3' });

    await handler.execute(
      new CreateApplicationFormFieldCommand(
        'p1',
        {
          source: 'system',
          systemFieldKey: 'phone',
          label: 'Phone Number',
          fieldType: FormFieldType.TEXT, // client sends the wrong type
        },
        'u1',
      ),
    );

    expect(mockRepo.createFormField).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'system',
        systemFieldKey: 'phone',
        name: 'phone',
        type: 'phone', // catalog wins
      }),
    );
  });

  it('rejects a system field with unknown systemFieldKey', async () => {
    mockPrisma.systemFormFieldDefinition.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute(
        new CreateApplicationFormFieldCommand(
          'p1',
          {
            source: 'system',
            systemFieldKey: 'nonexistent_key',
            label: 'X',
            fieldType: FormFieldType.TEXT,
          },
          'u1',
        ),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a system field with inactive systemFieldKey', async () => {
    mockPrisma.systemFormFieldDefinition.findUnique.mockResolvedValue({
      key: 'legacy_field',
      type: 'text',
      isActive: false,
      deletedAt: null,
    });

    await expect(
      handler.execute(
        new CreateApplicationFormFieldCommand(
          'p1',
          {
            source: 'system',
            systemFieldKey: 'legacy_field',
            label: 'X',
            fieldType: FormFieldType.TEXT,
          },
          'u1',
        ),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a system field with missing systemFieldKey', async () => {
    await expect(
      handler.execute(
        new CreateApplicationFormFieldCommand(
          'p1',
          {
            source: 'system',
            label: 'X',
            fieldType: FormFieldType.TEXT,
          },
          'u1',
        ),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('UpdateApplicationFormFieldHandler', () => {
  const mockRepo = {
    updateFormField: jest.fn(),
    findFormFieldById: jest.fn(),
  };
  const mockValidator = { validateCustomKey: jest.fn() };

  let handler: UpdateApplicationFormFieldHandler;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UpdateApplicationFormFieldHandler,
        { provide: 'IProgramContentRepository', useValue: mockRepo },
        { provide: FormFieldKeyValidator, useValue: mockValidator },
      ],
    }).compile();
    handler = moduleRef.get(UpdateApplicationFormFieldHandler);
  });

  it('validates fieldName when changing it', async () => {
    mockRepo.findFormFieldById.mockResolvedValue({ id: 'f1', name: 'old_key' });
    mockValidator.validateCustomKey.mockResolvedValue(undefined);
    mockRepo.updateFormField.mockResolvedValue({ id: 'f1' });

    await handler.execute(
      new UpdateApplicationFormFieldCommand(
        'f1',
        {
          fieldName: 'new_key',
        },
        'u1',
      ),
    );

    expect(mockValidator.validateCustomKey).toHaveBeenCalledWith('new_key');
  });

  it('skips key validation when fieldName is absent', async () => {
    mockRepo.updateFormField.mockResolvedValue({ id: 'f1' });

    await handler.execute(
      new UpdateApplicationFormFieldCommand('f1', { label: 'Just a label change' }, 'u1'),
    );

    expect(mockValidator.validateCustomKey).not.toHaveBeenCalled();
  });

  it('grandfathers legacy key that collides with catalog when unchanged on update', async () => {
    // The custom field was created before `tshirt_size` became a catalog
    // entry; the form re-submits the same key on save. Validation must be
    // skipped so the user can still edit label/placeholder/etc.
    mockRepo.findFormFieldById.mockResolvedValue({ id: 'f1', name: 'tshirt_size' });
    mockRepo.updateFormField.mockResolvedValue({ id: 'f1' });

    await handler.execute(
      new UpdateApplicationFormFieldCommand(
        'f1',
        { fieldName: 'tshirt_size', label: 'T-Shirt Size (edited)' },
        'u1',
      ),
    );

    expect(mockValidator.validateCustomKey).not.toHaveBeenCalled();
    expect(mockRepo.updateFormField).toHaveBeenCalled();
  });
});
