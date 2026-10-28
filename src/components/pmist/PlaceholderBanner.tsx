// Catalogue status banners — amber while unverified, green once the official
// PMIST working inventory is loaded into the database.
import { AlertTriangle, ShieldCheck } from "lucide-react";

export function PlaceholderBanner() {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        Course data is development placeholder — the official PMIST course list is
        pending verification. Do not treat these as final offerings.
      </p>
    </div>
  );
}

interface VerifiedBannerProps {
  count?: number;
  academicYear?: string;
  note?: string;
}

export function VerifiedBanner({ count, academicYear, note }: VerifiedBannerProps) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
    >
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        {typeof count === "number" ? (
          <>
            <span className="font-semibold">
              {count} verified PMIST programmes
            </span>
            {academicYear ? ` (${academicYear} inventory)` : ""} loaded from the
            official course-career document.{" "}
          </>
        ) : (
          "Course catalogue loaded from the official PMIST course-career document. "
        )}
        {note ??
          "Availability, eligibility and details can change — confirm with the current official brochure and the admissions office."}
      </p>
    </div>
  );
}
