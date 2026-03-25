type ProgressStatus = 'pending' | 'in_progress' | 'completed';

interface ApplicationForProgress {
    status?: string | null;
    applicationCategory?: string | null;
    personalData?: unknown;
    essayAnswers?: unknown;
    uploadedFiles?: unknown;
    program?: {
        id?: string;
        formFields?: { section?: string | null; name: string; isRequired: boolean }[];
        essays?: { id: string; isRequired: boolean }[];
        requirements?: { id: string; isRequired: boolean }[];
        subthemes?: unknown[];
    };
}

type ProgressField = {
    name: string;
    isRequired: boolean;
};

type ProgressSection = {
    id: string;
    title: string;
    description: string;
    status: ProgressStatus;
    isRequired: boolean;
};

const SECTION_TITLES: Record<string, string> = {
    personal_info: 'Personal Information',
    personal_details: 'Personal Details',
    contact_information: 'Contact Information',
    professional_profile: 'Professional Profile',
    entry_information: 'Entry Information',
    miscellaneous: 'Miscellaneous',
    additional_info: 'Additional Information',
    essays: 'Essays',
    documents: 'Documents',
};

const SECTION_DESCRIPTIONS: Record<string, string> = {
    personal_info: 'Basic participant information.',
    personal_details: 'Basic personal and background information about the participant.',
    contact_information: 'Participant and emergency contact details.',
    professional_profile: 'Education, experience, and supporting profile information.',
    entry_information: 'Application category, subtheme selection, and essay context.',
    miscellaneous: 'Referral, campaign, and social proof details.',
    additional_info: 'Additional participant information.',
    essays: 'Program-specific essay responses.',
    documents: 'Required uploads and supporting documents.',
};

const SECTION_ORDER: Record<string, number> = {
    personal_details: 1,
    contact_information: 2,
    professional_profile: 3,
    entry_information: 4,
    miscellaneous: 5,
    personal_info: 6,
    additional_info: 7,
    essays: 8,
    documents: 9,
};

function hasValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
    return true;
}

function normalizeStatus(fields: ProgressField[], values: Record<string, unknown>): ProgressStatus {
    const requiredFields = fields.filter((field) => field.isRequired);
    const filledRequiredCount = requiredFields.filter((field) => hasValue(values[field.name])).length;
    const filledCount = fields.filter((field) => hasValue(values[field.name])).length;

    if (requiredFields.length > 0) {
        if (filledRequiredCount >= requiredFields.length) return 'completed';
        if (filledCount > 0) return 'in_progress';
        return 'pending';
    }

    if (fields.length === 0) {
        return Object.keys(values).length > 0 ? 'completed' : 'pending';
    }

    if (filledCount === fields.length) return 'completed';
    if (filledCount > 0) return 'in_progress';
    return 'pending';
}

function getFieldValue(
    fieldName: string,
    personalData: Record<string, unknown>,
    application: ApplicationForProgress,
): unknown {
    if (fieldName === 'category') {
        return personalData[fieldName] ?? application.applicationCategory ?? undefined;
    }

    if (fieldName === 'program_id') {
        return application.program?.id;
    }

    return personalData[fieldName] ?? undefined;
}

function calculateAggregateStatus(items: { isRequired: boolean; completed: boolean; started: boolean }[]): ProgressStatus {
    const requiredItems = items.filter((item) => item.isRequired);

    if (requiredItems.length > 0) {
        if (requiredItems.every((item) => item.completed)) return 'completed';
        if (items.some((item) => item.started)) return 'in_progress';
        return 'pending';
    }

    if (items.length === 0) return 'pending';
    if (items.every((item) => item.completed)) return 'completed';
    if (items.some((item) => item.started)) return 'in_progress';
    return 'pending';
}

export function buildSubmissionProgressSections(application: ApplicationForProgress): ProgressSection[] {
    const personalData = (application.personalData as Record<string, unknown>) || {};
    const formFields = application.program?.formFields || [];
    const groupedFields = new Map<string, ProgressField[]>();

    for (const field of formFields) {
        const sectionId = field.section || 'personal_info';
        if (!groupedFields.has(sectionId)) {
            groupedFields.set(sectionId, []);
        }

        groupedFields.get(sectionId)!.push({
            name: field.name,
            isRequired: field.isRequired,
        });
    }

    const sections: ProgressSection[] = [];

    for (const [sectionId, fields] of groupedFields.entries()) {
        const values = Object.fromEntries(fields.map((field) => [field.name, getFieldValue(field.name, personalData, application)]));
        const requiredCount = fields.filter((field) => field.isRequired).length;

        sections.push({
            id: sectionId,
            title: SECTION_TITLES[sectionId] || sectionId,
            description: SECTION_DESCRIPTIONS[sectionId] || 'Submission section progress.',
            status: normalizeStatus(fields, values),
            isRequired: requiredCount > 0,
        });
    }

    if (!groupedFields.has('personal_info')) {
        sections.push({
            id: 'personal_info',
            title: SECTION_TITLES.personal_info,
            description: SECTION_DESCRIPTIONS.personal_info,
            status: normalizeStatus([], personalData),
            isRequired: Object.keys(personalData).length > 0,
        });
    }

    const essays = application.program?.essays || [];
    if (essays.length > 0) {
        const essayAnswers = (application.essayAnswers as Record<string, unknown>) || {};
        sections.push({
            id: 'essays',
            title: SECTION_TITLES.essays,
            description: SECTION_DESCRIPTIONS.essays,
            status: calculateAggregateStatus(
                essays.map((essay: { id: string; isRequired: boolean }) => ({
                    isRequired: essay.isRequired,
                    completed: hasValue(essayAnswers[essay.id]),
                    started: hasValue(essayAnswers[essay.id]),
                })),
            ),
            isRequired: essays.some((essay: { isRequired: boolean }) => essay.isRequired),
        });
    }

    const requirements = application.program?.requirements || [];
    if (requirements.length > 0) {
        const uploadedFiles = (application.uploadedFiles as Record<string, unknown>) || {};
        sections.push({
            id: 'documents',
            title: SECTION_TITLES.documents,
            description: SECTION_DESCRIPTIONS.documents,
            status: calculateAggregateStatus(
                requirements.map((requirement: { id: string; isRequired: boolean }) => ({
                    isRequired: requirement.isRequired,
                    completed: hasValue(uploadedFiles[requirement.id]),
                    started: hasValue(uploadedFiles[requirement.id]),
                })),
            ),
            isRequired: requirements.some((requirement: { isRequired: boolean }) => requirement.isRequired),
        });
    }

    return sections.sort(
        (left, right) => (SECTION_ORDER[left.id] || Number.MAX_SAFE_INTEGER) - (SECTION_ORDER[right.id] || Number.MAX_SAFE_INTEGER),
    );
}

export function calculateSubmissionProgress(application: ApplicationForProgress): number {
    if (application.status && application.status !== 'draft') {
        return 100;
    }

    const sections = buildSubmissionProgressSections(application);
    if (sections.length === 0) return 0;

    const completedCount = sections.filter((section) => section.status === 'completed').length;
    return Math.round((completedCount / sections.length) * 100);
}

export function determineSubmissionCurrentStep(application: ApplicationForProgress): string {
    const progress = calculateSubmissionProgress(application);

    switch (application.status) {
        case 'draft':
            if (progress >= 100) return 'Ready to Submit';
            if (progress > 0) return 'Application Drafting';
            return 'Start Application';
        case 'submitted':
            return 'Application Submitted';
        case 'under_review':
            return 'Documentation Check';
        case 'interview_scheduled':
            return 'Interview Stage';
        case 'accepted':
            return 'Program Preparation';
        case 'rejected':
        case 'withdrawn':
            return 'Closed';
        default:
            return 'Review';
    }
}