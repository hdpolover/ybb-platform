import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SubmitEnquiryDto } from './submit-enquiry.dto';

const basePayload = {
  partnershipType: 'sponsorship',
  fullName: 'Jane Doe',
  email: 'jane@example.com',
};

describe('SubmitEnquiryDto.whatsappNumber MaxLength(25)', () => {
  it('accepts a whatsappNumber exactly at the 25-char limit', async () => {
    const dto = plainToInstance(SubmitEnquiryDto, {
      ...basePayload,
      whatsappNumber: '1'.repeat(25),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a whatsappNumber over the 25-char limit (real overflowing input from the public form)', async () => {
    const dto = plainToInstance(SubmitEnquiryDto, {
      ...basePayload,
      whatsappNumber: '+62 812-3456-7890 (WhatsApp, call after 5pm)',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'whatsappNumber')).toBe(true);
  });
});

describe('SubmitEnquiryDto.partnershipType MaxLength(50)', () => {
  it('accepts a partnershipType exactly at the 50-char limit', async () => {
    const dto = plainToInstance(SubmitEnquiryDto, {
      ...basePayload,
      partnershipType: 'a'.repeat(50),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a partnershipType over the 50-char limit', async () => {
    const dto = plainToInstance(SubmitEnquiryDto, {
      ...basePayload,
      partnershipType: 'a'.repeat(51),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'partnershipType')).toBe(true);
  });
});

describe('SubmitEnquiryDto.subCategory MaxLength(50)', () => {
  it('accepts a subCategory exactly at the 50-char limit', async () => {
    const dto = plainToInstance(SubmitEnquiryDto, {
      ...basePayload,
      subCategory: 'b'.repeat(50),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a subCategory over the 50-char limit', async () => {
    const dto = plainToInstance(SubmitEnquiryDto, {
      ...basePayload,
      subCategory: 'b'.repeat(51),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'subCategory')).toBe(true);
  });
});

describe('SubmitEnquiryDto.fullName MaxLength(255)', () => {
  it('accepts a fullName exactly at the 255-char limit', async () => {
    const dto = plainToInstance(SubmitEnquiryDto, {
      ...basePayload,
      fullName: 'c'.repeat(255),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a fullName over the 255-char limit', async () => {
    const dto = plainToInstance(SubmitEnquiryDto, {
      ...basePayload,
      fullName: 'c'.repeat(256),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'fullName')).toBe(true);
  });
});

describe('SubmitEnquiryDto.email (no MaxLength needed — @IsEmail already caps at 254)', () => {
  // Longest possible RFC-valid local part is 64 chars; pad the domain with dot-separated
  // 60-char labels to land exactly on the total length under test.
  const domainOfLength = (len: number): string => {
    const labels: string[] = [];
    let remaining = len;
    while (remaining > 61) {
      labels.push('a'.repeat(60));
      remaining -= 61;
    }
    labels.push('a'.repeat(Math.max(remaining, 2)));
    return labels.join('.');
  };

  it('accepts a well-formed email up to the RFC 5321 254-char cap', async () => {
    const email = `${'d'.repeat(64)}@${domainOfLength(189)}`;
    expect(email).toHaveLength(254);
    const dto = plainToInstance(SubmitEnquiryDto, { ...basePayload, email });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(false);
  });

  it('rejects a 255-char address — @IsEmail itself refuses anything over the 254-char cap, so it can never reach the VARCHAR(255) column', async () => {
    const email = `${'d'.repeat(64)}@${domainOfLength(190)}`;
    expect(email).toHaveLength(255);
    const dto = plainToInstance(SubmitEnquiryDto, { ...basePayload, email });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });
});

describe('SubmitEnquiryDto.company MaxLength(255)', () => {
  it('accepts a company exactly at the 255-char limit', async () => {
    const dto = plainToInstance(SubmitEnquiryDto, {
      ...basePayload,
      company: 'e'.repeat(255),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a company over the 255-char limit', async () => {
    const dto = plainToInstance(SubmitEnquiryDto, {
      ...basePayload,
      company: 'e'.repeat(256),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'company')).toBe(true);
  });
});

describe('SubmitEnquiryDto.subject MaxLength(255)', () => {
  it('accepts a subject exactly at the 255-char limit', async () => {
    const dto = plainToInstance(SubmitEnquiryDto, {
      ...basePayload,
      subject: 'f'.repeat(255),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a subject over the 255-char limit', async () => {
    const dto = plainToInstance(SubmitEnquiryDto, {
      ...basePayload,
      subject: 'f'.repeat(256),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'subject')).toBe(true);
  });
});

describe('SubmitEnquiryDto.description (unbounded @db.Text)', () => {
  it('accepts a very long description with no MaxLength guard', async () => {
    const dto = plainToInstance(SubmitEnquiryDto, {
      ...basePayload,
      description: 'g'.repeat(5000),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'description')).toBe(false);
  });
});
