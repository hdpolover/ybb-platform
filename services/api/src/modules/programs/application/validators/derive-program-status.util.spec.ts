// file: services/api/src/modules/programs/application/validators/derive-program-status.util.spec.ts
import { deriveProgramStatus } from './derive-program-status.util';

describe('deriveProgramStatus', () => {
    it('advances draft to published when isPublished is set true and status is untouched', () => {
        expect(deriveProgramStatus('draft', { isPublished: true })).toBe('published');
    });

    it('advances draft to published when isActive is set true and status is untouched', () => {
        expect(deriveProgramStatus('draft', { isActive: true })).toBe('published');
    });

    it('advances draft to published when both isPublished and isActive are set true', () => {
        expect(deriveProgramStatus('draft', { isPublished: true, isActive: true })).toBe('published');
    });

    it('does nothing when isPublished/isActive are absent from the payload', () => {
        expect(deriveProgramStatus('draft', {})).toBeUndefined();
    });

    it('does nothing when isPublished/isActive are explicitly set false', () => {
        expect(deriveProgramStatus('draft', { isPublished: false, isActive: false })).toBeUndefined();
    });

    it('never overrides an explicit status in the same request, even if it disagrees with isPublished', () => {
        expect(deriveProgramStatus('draft', { status: 'draft', isPublished: true })).toBeUndefined();
        expect(deriveProgramStatus('draft', { status: 'cancelled', isPublished: true })).toBeUndefined();
    });

    it('does not advance a program that is already past draft', () => {
        expect(deriveProgramStatus('ongoing', { isPublished: true })).toBeUndefined();
        expect(deriveProgramStatus('completed', { isPublished: true, isActive: true })).toBeUndefined();
        expect(deriveProgramStatus('cancelled', { isActive: true })).toBeUndefined();
        expect(deriveProgramStatus('published', { isPublished: true })).toBeUndefined();
    });
});
