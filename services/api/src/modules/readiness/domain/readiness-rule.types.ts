export type ReadinessSeverity = 'BLOCKER' | 'WARNING' | 'INFO';

// 'unknown' exists because some rules depend on a service that can be down
// (see the payment-method rule). A rule whose evaluation failed must never be
// reported as passing — that is the exact failure class this module exists to
// catch.
export type RuleStatus = 'pass' | 'fail' | 'overridden' | 'unknown';

export type ReadinessScope = 'brand' | 'program';

export interface ReadinessRule {
  id: string;
  scope: ReadinessScope;
  severity: ReadinessSeverity;
  title: string;
  /** What a visitor or admin actually sees today when this rule fails. */
  symptom: string;
  fix: { label: string; href: string };
  evaluate: (ctx: ReadinessContext) => boolean;
}

export interface ActiveOverride {
  ruleId: string;
  reason: string;
  adminId: string;
  expiresAt: Date | null;
}

export interface RuleResult {
  ruleId: string;
  severity: ReadinessSeverity;
  status: RuleStatus;
  title: string;
  symptom: string;
  fix: { label: string; href: string };
  overrideReason?: string;
  overrideExpired?: boolean;
}

export interface ReadinessReport {
  results: RuleResult[];
  blockerCount: number;
  warningCount: number;
  unknownCount: number;
  isReady: boolean;
  evaluatedAt: Date;
}

export interface ReadinessContext {
  brand: {
    id: string;
    name: string;
    primaryColor: string | null;
    logoUrl: string | null;
    logoIconUrl: string | null;
    landingUrl: string | null;
    tagline: string | null;
    defaultCurrency: string;
    isMaintenanceMode: boolean;
    activeSignatureCount: number;
    legalDocumentCount: number;
    publishedProgramCount: number;
    supportEmail: string | null;
  };
  program?: {
    id: string;
    name: string;
    bannerUrl: string | null;
    description: string | null;
    registrationOpenDate: Date | null;
    registrationCloseDate: Date | null;
    applicationDeadline: Date | null;
    pricingTierCount: number;
    objectiveCount: number;
    faqCount: number;
    galleryCount: number;
    testimonialCount: number;
    /** Null when the payment service could not be reached. */
    paymentMethods: { enabledCount: number; isConfigured: boolean } | null;
  };
}
