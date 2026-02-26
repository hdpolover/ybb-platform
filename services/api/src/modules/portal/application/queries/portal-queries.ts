// Dashboard
export class GetPortalDashboardQuery {
  constructor(public readonly userId: string) { }
}

// Submissions
export class GetPortalSubmissionsQuery {
  constructor(public readonly userId: string) { }
}

// Submission Detail (full form data)
export class GetPortalSubmissionDetailQuery {
  constructor(public readonly userId: string) { }
}

// Payments
export class GetPortalPaymentsQuery {
  constructor(public readonly userId: string) { }
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
    public readonly data: Record<string, any>,
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
