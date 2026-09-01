const ALLOWED_DOMAIN = "@strathmore.edu";

export function isStrathmoreEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(ALLOWED_DOMAIN);
}
