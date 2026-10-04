/** Fail hard when a required server secret is missing. Never fall back to hardcoded credentials. */
export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function firstRequiredEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`${names.join(" or ")} is required`);
}

export function optionalEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function hasAllEnv(...names: string[]): boolean {
  return names.every((name) => Boolean(process.env[name]?.trim()));
}

export function hasAnyEnv(...names: string[]): boolean {
  return names.some((name) => Boolean(process.env[name]?.trim()));
}
