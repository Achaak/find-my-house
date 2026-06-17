import type {
  CompatibilityCard,
  CompatibilityDetail,
} from "@find-my-house/api-types";
import { CompatibilityBadge } from "@/components/listings/compatibility-badge";
import {
  compatibilityCriterionLabels,
  compatibilityImportanceLabels,
} from "@/lib/compatibility";

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
        <h2 className="text-lg font-semibold">Adéquation</h2>
        <CompatibilityBadge compatibility={compatibility} />
        {compatibility.summary ? (
          <p className="text-sm text-muted-foreground">
            {compatibility.summary}
          </p>
        ) : null}
      </div>

      {factors.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Facteurs principaux</h3>
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
            Détail par critère
          </summary>
          <ul className="mt-2 space-y-1">
            {breakdown.map((entry) => (
              <li
                key={entry.criterion}
                className="flex items-center justify-between gap-3"
              >
                <span>{compatibilityCriterionLabels[entry.criterion]}</span>
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
  profile: import("@find-my-house/api-types").CompatibilityProfile;
}) {
  if (profile.readiness === "none") {
    return (
      <section className="rounded-lg border p-4 text-sm text-muted-foreground">
        Likez des annonces pour entraîner l&apos;adéquation.
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="text-lg font-semibold">Tes goûts inférés</h2>
        <p className="text-sm text-muted-foreground">
          Dérivé de {profile.training.likes} like
          {profile.training.likes > 1 ? "s" : ""}
          {profile.training.dislikes > 0
            ? ` et ${String(profile.training.dislikes)} dislike${profile.training.dislikes > 1 ? "s" : ""}`
            : ""}
          . Lecture seule.
        </p>
      </div>

      {profile.preferences.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Profil appris</h3>
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
          <h3 className="text-sm font-medium">Ce qui compte pour toi</h3>
          <ul className="space-y-1 text-sm">
            {profile.weights.map((entry) => (
              <li key={entry.criterion}>
                {compatibilityCriterionLabels[entry.criterion]} —{" "}
                {compatibilityImportanceLabels[entry.importance]}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
