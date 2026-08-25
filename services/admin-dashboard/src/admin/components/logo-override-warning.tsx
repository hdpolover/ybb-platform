// src/admin/components/logo-override-warning.tsx
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { PlatformBrandDetail } from "@/app/platform/api";

// Public logo resolution (services/api/src/modules/landing/strategies/settings.strategy.ts)
// always prefers the brand's active program's own logoUrl over the brand's
// logoUrl. That's intentional for programs with a real program-specific
// logo, but it's invisible in the admin UI: an admin can save a new brand
// logo and see nothing change on the public site because a program row is
// shadowing it. Shown on both brand logo editors (BrandDetailPage's Identity
// sheet, and the orphaned BrandEditPage) — keep this the single definition.
export function LogoOverrideWarning({
  activeProgram,
  brandLogoUrl,
}: {
  activeProgram: PlatformBrandDetail["activeProgram"];
  brandLogoUrl: string | null;
}) {
  if (!activeProgram?.logoUrl) return null;
  const isRedundantCopy = brandLogoUrl != null && activeProgram.logoUrl === brandLogoUrl;
  const programBrandingHref = `/programs/${activeProgram.slug}/master-data/program-details`;

  return (
    <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
      <p className="text-xs text-amber-700">
        {isRedundantCopy ? (
          <>
            This brand&rsquo;s active program has its own logo set, and it&rsquo;s currently just a copy of this brand
            logo. It serves no purpose other than blocking edits here (the program logo always wins on the
            public site). The program logo upload only replaces, it cannot be cleared from this UI, so ask an
            administrator or engineer to clear it, or replace it on the{" "}
            <Link href={programBrandingHref} className="font-medium underline hover:text-amber-900">
              program&rsquo;s branding page
            </Link>{" "}
            with the logo you actually want shown.
          </>
        ) : (
          <>
            This brand&rsquo;s active program has its own logo set, and it overrides this brand logo on the public
            site (program logo always wins). Saving a new logo here will not change what visitors see until
            you also update it on the{" "}
            <Link href={programBrandingHref} className="font-medium underline hover:text-amber-900">
              program&rsquo;s branding page
            </Link>
            .
          </>
        )}
      </p>
    </div>
  );
}
