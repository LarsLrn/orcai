import { describe, expect, test } from "bun:test";
import { membershipControl } from "./organization-role";

const self = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";

const manager = membershipControl({
	userId: self,
	capabilities: {
		manage_members: true,
		manage_organization: false,
	},
});
const admin = membershipControl({
	userId: self,
	capabilities: {
		manage_members: true,
		manage_organization: true,
	},
});

describe("membershipControl", () => {
	test("a manager leaves admin memberships and invitations alone", () => {
		expect(manager.assignableRoles).not.toContain("admin");
		expect(manager.canManageRole("admin")).toBe(false);
		expect(
			manager.canManageMember({
				id: other,
				organizationRole: "admin",
			}),
		).toBe(false);
		expect(
			manager.canManageMember({
				id: other,
				organizationRole: "member",
			}),
		).toBe(true);
	});

	test("an admin manages every role", () => {
		expect(admin.assignableRoles).toContain("admin");
		expect(
			admin.canManageMember({
				id: other,
				organizationRole: "admin",
			}),
		).toBe(true);
	});

	test("nobody manages their own membership", () => {
		expect(
			admin.canManageMember({
				id: self,
				organizationRole: "member",
			}),
		).toBe(false);
	});
});
