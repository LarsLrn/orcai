import { isInstanceAdminRole } from "@/lib/authz/instance-role";

/** Who must use two-factor authentication: nobody, instance admins, or everyone. */
export const TWO_FACTOR_POLICIES = [
	"none",
	"admins",
	"all",
] as const;

export type TwoFactorPolicy = (typeof TWO_FACTOR_POLICIES)[number];

/** Whether the policy demands a second factor the user has not set up. */
export const requiresTwoFactor = (
	policy: TwoFactorPolicy,
	user: {
		role?: string | null;
		twoFactorEnabled?: boolean | null;
	},
) => {
	if (user.twoFactorEnabled) return false;

	switch (policy) {
		case "all":
			return true;
		case "admins":
			return isInstanceAdminRole(user.role);
		case "none":
			return false;
	}
};
