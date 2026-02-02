// Dashboard
export class GetPortalDashboardQuery {
    constructor(public readonly userId: string) {}
}

// Submissions
export class GetPortalSubmissionsQuery {
  constructor(public readonly userId: string) {}
}

// Payments
export class GetPortalPaymentsQuery {
  constructor(public readonly userId: string) {}
}

// Documents
export class GetPortalDocumentsQuery {
  constructor(public readonly userId: string) {}
}
