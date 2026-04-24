// Dashboard
export class GetPortalDashboardQuery {
  constructor(public readonly userId: string) { }
}

// Submissions
export class GetPortalSubmissionsQuery {
  constructor(
    public readonly userId: string,
    public readonly programId?: string,
  ) { }
}

// Submission Detail (full form data)
export class GetPortalSubmissionDetailQuery {
  constructor(
    public readonly userId: string,
    public readonly programId?: string,
  ) { }
}

// Payments
export class GetPortalPaymentsQuery {
  constructor(
    public readonly userId: string,
    public readonly programId?: string,
  ) { }
}

export class GetPortalPaymentDetailQuery {
  constructor(
    public readonly userId: string,
    public readonly invoiceId: string,
  ) { }
}

export class ConfirmPortalPaymentCommand {
  constructor(
    public readonly userId: string,
    public readonly invoiceId: string,
    public readonly paymentType: 'gateway' | 'manual',
    public readonly paymentMethodId: string,
    public readonly details?: {
      accountName?: string;
      sourceName?: string;
      paymentDate?: string;
      notes?: string;
      gatewayToken?: string;
    },
  ) { }
}

export class EnsurePortalPaymentInvoiceCommand {
  constructor(
    public readonly userId: string,
    public readonly pricingTierId: string,
    public readonly programId?: string,
  ) { }
}

// Documents
export class GetPortalDocumentsQuery {
  constructor(public readonly userId: string) { }
}

// Certificates
export class GetPortalCertificatesQuery {
  constructor(public readonly userId: string) { }
}

// Commands
export class SaveSubmissionSectionCommand {
  constructor(
    public readonly userId: string,
    public readonly section: string,
    public readonly data: Record<string, unknown>,
    public readonly programId?: string,
  ) { }
}

export class PortalSubmitApplicationCommand {
  constructor(public readonly userId: string) { }
}

export class DownloadCertificateCommand {
  constructor(
    public readonly userId: string,
    public readonly certificateId: string,
  ) { }
}

export class UploadSignedCopyCommand {
  constructor(
    public readonly templateId: string,
    public readonly userId: string,
    public readonly file: Express.Multer.File,
  ) { }
}
