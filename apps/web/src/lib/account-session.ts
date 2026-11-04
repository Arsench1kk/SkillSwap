import { auth } from "./auth";
import {
  AccountAccessError,
  accountRoleSchema,
  type AccountRole,
} from "@/domain/account-participants";

export type AccountSessionContext = Readonly<{
  authUserId: string;
  activeRole: AccountRole;
}>;

/** Identity comes exclusively from Better Auth's verified session. */
export async function requireAccountSession(
  headers: Headers,
  requiredRole?: AccountRole,
): Promise<AccountSessionContext> {
  if (
    requiredRole !== undefined &&
    !accountRoleSchema.safeParse(requiredRole).success
  ) {
    throw new AccountAccessError("invalid_account_role");
  }
  const session = await auth.api.getSession({ headers });
  if (!session) throw new AccountAccessError("unauthorized");

  const role = accountRoleSchema.safeParse(session.user.activeRole);
  if (!role.success) throw new AccountAccessError("invalid_account_role");
  if (requiredRole !== undefined && role.data !== requiredRole) {
    throw new AccountAccessError("active_role_required");
  }
  return { authUserId: session.user.id, activeRole: role.data };
}
