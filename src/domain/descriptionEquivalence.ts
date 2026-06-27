export function normalizeDescriptionText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function stripTruncationSuffix(text: string): string {
  return text.replace(/(?:\.\.\.|…)$/u, "").trimEnd();
}

export function descriptionsAreEquivalent(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;

  const normalizedLeft = normalizeDescriptionText(left);
  const normalizedRight = normalizeDescriptionText(right);
  if (normalizedLeft === normalizedRight) return true;

  if (
    normalizedLeft.startsWith(normalizedRight) ||
    normalizedRight.startsWith(normalizedLeft)
  ) {
    return true;
  }

  const leftCore = stripTruncationSuffix(normalizedLeft);
  const rightCore = stripTruncationSuffix(normalizedRight);
  if (leftCore === rightCore) return true;

  const [shorter, longer] =
    leftCore.length <= rightCore.length
      ? [leftCore, rightCore]
      : [rightCore, leftCore];

  if (shorter.length >= 40 && longer.includes(shorter)) {
    return true;
  }

  return false;
}

export function pickLongestDescription(
  descriptions: readonly (string | null | undefined)[]
): string | null {
  let longest: string | null = null;

  for (const description of descriptions) {
    if (!description?.trim()) continue;
    if (!longest || description.length > longest.length) {
      longest = description;
    }
  }

  return longest;
}
