function toPositiveNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return value;
    }

    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
    }

    return undefined;
}

export function resolveUsdInIdrRate(input: {
    snapshot?: unknown;
    programRate?: unknown;
}): number | undefined {
    const snapshot = toPositiveNumber(input.snapshot);
    if (snapshot !== undefined) {
        return snapshot;
    }

    const programRate = toPositiveNumber(input.programRate);
    if (programRate !== undefined) {
        return programRate;
    }
    
    return undefined;
}
