export class DocumentTemplate {
    constructor(
        public readonly id: string,
        public readonly programId: string,
        public readonly name: string,
        public readonly type: string,
        public readonly templateUrl: string | null,
        public readonly isActive: boolean,
        public readonly htmlContent?: string | null,
        public readonly placeholders?: Array<{ key: string; label: string; source: string }> | null,
        public readonly layoutConfig?: Record<string, unknown> | null,
    ) { }
}

export class ParticipantDocument {
    constructor(
        public readonly id: string,
        public readonly applicationId: string,
        public readonly templateId: string,
        public readonly documentNumber: string | null,
        public readonly documentUrl: string,
        public readonly generatedAt: Date,
        public readonly downloadCount: number,
        // Relations
        public readonly templateName?: string,
    ) { }
}
