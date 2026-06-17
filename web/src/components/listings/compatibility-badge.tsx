import type { CompatibilityCard } from "@find-my-house/api-types";
import { Badge } from "@/components/ui/badge";
import {
  formatCompatibilityBadge,
  formatCompatibilityRank,
} from "@/lib/compatibility";

export function CompatibilityBadge({
  compatibility,
}: {
  compatibility: CompatibilityCard;
}) {
  const label = formatCompatibilityBadge(compatibility);
  const rank = formatCompatibilityRank(compatibility);

  if (!label && compatibility.readiness === "scoring") {
    return <Badge variant="outline">Calibration…</Badge>;
  }

  if (!label) return null;

  return (
    <Badge title={compatibility.summary}>
      {label}
      {rank ? ` · ${rank}` : ""}
    </Badge>
  );
}
