// PlaceholderBanner — shown while the course catalogue is unverified.
import { AlertTriangle } from "lucide-react";

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
