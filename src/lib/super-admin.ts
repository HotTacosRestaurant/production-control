export const SUPER_ADMIN_EMAILS = [
  'hottacosmanagement@hotmail.com',
  'admin@nixinx.com',
  'admin@nixinex.com',
  'admin@hottacosrestaurant.com',
] as const;

export function isSuperAdminEmail(value: string | null | undefined): boolean {
  const email = value?.trim().toLowerCase();
  return Boolean(email && SUPER_ADMIN_EMAILS.includes(email as (typeof SUPER_ADMIN_EMAILS)[number]));
}
