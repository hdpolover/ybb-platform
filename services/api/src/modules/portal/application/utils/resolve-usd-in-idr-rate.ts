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

    if (value && typeof value === 'object') {
        const decimalLike = value as {
            toNumber?: () => number;
            valueOf?: () => unknown;
            toString?: () => string;
        };

        if (typeof decimalLike.toNumber === 'function') {
            const parsed = decimalLike.toNumber();
            if (Number.isFinite(parsed) && parsed > 0) {
                return parsed;
            }
        }

        if (typeof decimalLike.valueOf === 'function') {
            const primitive = decimalLike.valueOf();
            if (primitive !== value) {
                const parsed = toPositiveNumber(primitive);
                if (parsed !== undefined) {
                    return parsed;
                }
            }
        }

        if (typeof decimalLike.toString === 'function') {
            const rendered = decimalLike.toString();
            if (rendered && rendered !== '[object Object]') {
                const parsed = Number(rendered);
                if (Number.isFinite(parsed) && parsed > 0) {
                    return parsed;
                }
            }
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
