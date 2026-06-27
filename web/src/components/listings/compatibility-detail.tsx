import type {
  CompatibilityCard,
  CompatibilityDetail,
  CompatibilityProfile,
} from "@find-my-house/api-types";
import { ChevronDown } from "lucide-react";
import { CompatibilityBadge } from "@/components/listings/compatibility-badge";
import {
  compatibilityCriterionLabel,
  compatibilityImportanceLabel,
  formatCompatibilityProfileTraining,
} from "@/lib/compatibility";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

export function CompatibilityDetailPanel({
  compatibility,
}: {
  compatibility: CompatibilityCard | CompatibilityDetail;
}) {
  if (compatibility.readiness === "none") return null;

  const factors = "factors" in compatibility ? compatibility.factors : [];
  const breakdown = "breakdown" in compatibility ? compatibility.breakdown : [];

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{m.compatibility_title()}</h2>
        <CompatibilityBadge compatibility={compatibility} />
        {compatibility.summary ? (
          <p className="text-sm text-muted-foreground">
            {compatibility.summary}
          </p>
        ) : null}
      </div>

      {factors.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">
            {m.compatibility_main_factors()}
          </h3>
          <ul className="space-y-1 text-sm">
            {factors.map((factor) => (
              <li key={factor.criterion}>{factor.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {breakdown.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">
            {m.compatibility_breakdown()}
          </summary>
          <ul className="mt-2 space-y-1">
            {breakdown.map((entry) => (
              <li
                key={entry.criterion}
                className="flex items-center justify-between gap-3"
              >
                <span>{compatibilityCriterionLabel(entry.criterion)}</span>
                <span className="text-muted-foreground">
                  {Math.round(entry.score)}%
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

export function CompatibilityProfilePanel({
  profile,
}: {
  profile: CompatibilityProfile;
}) {
  if (profile.readiness === "none") {
    return (
      <section className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
        {m.compatibility_train_prompt()}
      </section>
    );
  }

  const trainingLabel = formatCompatibilityProfileTraining(
    profile.training.likes,
    profile.training.dislikes
  );

  return (
    <details className="group rounded-lg border">
      <summary
        className={cn(
          "cursor-pointer list-none px-4 py-3",
          "[&::-webkit-details-marker]:hidden"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-base font-semibold leading-tight">
              {m.compatibility_profile_title()}
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {trainingLabel}
            </p>
          </div>
          <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="space-y-4 border-t px-4 pb-4 pt-3">
        {profile.preferences.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">
              {m.compatibility_profile_learned()}
            </h3>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {profile.preferences.map((entry) => (
                <div key={entry.label}>
                  <dt className="text-muted-foreground">{entry.label}</dt>
                  <dd className="font-medium">{entry.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {profile.weights.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">
              {m.compatibility_profile_weights()}
            </h3>
            <ul className="space-y-1 text-sm">
              {profile.weights.map((entry) => (
                <li key={entry.criterion}>
                  {compatibilityCriterionLabel(entry.criterion)} —{" "}
                  {compatibilityImportanceLabel(entry.importance)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}
