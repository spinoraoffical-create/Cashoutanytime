/** Rules for a new password. Existing passwords are not checked on login. */

export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 8) problems.push("Use at least 8 characters.");
  if (!/[A-Za-z]/.test(password)) problems.push("Include a letter.");
  if (!/\d/.test(password)) problems.push("Include a number.");
  return problems;
}

export function passwordIsAcceptable(password: string): boolean {
  return passwordProblems(password).length === 0;
}
