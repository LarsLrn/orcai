import type { OrganizationId, UserId } from "@orcai/core";
import { userIdSchema } from "@orcai/schema";
import type { ApiClient } from "../../fixtures/api";
import { signUpInvited } from "../../fixtures/auth";
import {
	expectDenied,
	expectForbidden,
	rejection,
	untilAllowed,
} from "../../fixtures/authorization";
import { EMAIL_DOMAIN, ROLES } from "../../fixtures/constants";
import { baseURL } from "../../fixtures/env";
import { expect, test } from "../../fixtures/index";
import { runId } from "../../fixtures/organisation";

/**
 * Assert a call answers as if the row were not there. A group the caller may
 * not see is a miss rather than a refusal, so the code is asserted exactly.
 */
const expectNotFound = async (promise: Promise<unknown>): Promise<void> => {
	expect((await rejection(promise)).code).toBe("NOT_FOUND");
};

/** Roles that manage nothing inside their organisation. */
const UNPRIVILEGED = [
	"member",
	"viewer",
] as const;

/** Roles below an admin. */
const BELOW_ADMIN = [
	"manager",
	...UNPRIVILEGED,
] as const;

/** A new user invited into an organisation as a member, for membership mutations to aim at. */
const invitedMember = async (
	admin: ApiClient,
	organizationId: OrganizationId,
	label: string,
): Promise<UserId> => {
	const session = await signUpInvited({
		baseURL: baseURL(),
		admin,
		organisation: {
			id: organizationId,
		},
		role: "member",
		name: `E2E Tenancy ${label}`,
		email: `e2e-tenancy-${label}-${runId()}@${EMAIL_DOMAIN}`,
	});

	return userIdSchema.parse(session.userId);
};

test("every role reads its own organisation and its members", async ({
	api,
	org,
}) => {
	for (const role of ROLES) {
		const found = await api.as(role).organization.find({
			id: org.id,
		});
		expect(found.data.slug).toBe(org.slug);

		const members = await api.as(role).organizationMember.list({
			organizationId: org.id,
			pageIndex: 0,
			pageSize: 100,
		});

		expect(members.data.map((member) => member.userId)).toContain(
			org.users[role].id,
		);
		// One user per role plus the well-known admin, which creates every
		// worker organisation and stays an admin member of it.
		expect(members.rowCount).toBeGreaterThanOrEqual(5);
	}
});

test("only an admin changes the organisation", async ({ api, org }) => {
	for (const role of BELOW_ADMIN) {
		await expectForbidden(
			api.as(role).organization.update({
				id: org.id,
				logo: null,
			}),
		);
	}

	const updated = await api.as("admin").organization.update({
		id: org.id,
		logo: null,
	});

	expect(updated.data.id).toBe(org.id);
	expect(updated.data.name).toBe(org.name);
});

test("no organisation role may delete an organisation", async ({
	api,
	orgs,
}) => {
	// A throwaway organisation, because deleting the worker's own would take
	// the rest of the slice with it.
	const throwaway = await orgs.create("E2E Role Limits Delete");

	// Deleting an organisation is an instance action, so no role inside it may
	// do it, admin included.
	for (const role of ROLES) {
		await expectForbidden(
			api.as(role, throwaway).organization.delete({
				refs: [
					{
						id: throwaway.id,
					},
				],
			}),
		);
	}

	// The throwaway admin's membership comes from the sign-up hook, which
	// answers no zedToken.
	const stillThere = await untilAllowed(() =>
		api.as("admin", throwaway).organization.find({
			id: throwaway.id,
		}),
	);
	expect(stillThere.data.id).toBe(throwaway.id);
});

test("the instance admin deletes an organisation", async ({ api, orgs }) => {
	const throwaway = await orgs.create("E2E Instance Admin Deletes");
	const invitee = `e2e-tenancy-deleted-org-${runId()}@${EMAIL_DOMAIN}`;
	await invitedMember(api.asWellKnownAdmin(), throwaway.id, "deleted-org");

	await api.asWellKnownAdmin().organizationInvitation.create({
		organizationId: throwaway.id,
		role: "member",
		expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
		items: [
			{
				email: invitee,
			},
		],
	});

	const impact = await api.asWellKnownAdmin().organization.deletionImpact({
		id: throwaway.id,
	});
	expect(impact.data.slug).toBe(throwaway.slug);
	// The well-known admin creates every worker organisation and stays a
	// member of it, plus one user per role and the member added above.
	expect(impact.data.members).toBeGreaterThanOrEqual(6);
	expect(impact.data.pendingInvitations).toBe(1);
	// Every organisation is created with an "All Members" system group.
	expect(impact.data.groups).toBeGreaterThan(0);

	const deleted = await api.asWellKnownAdmin().organization.delete({
		refs: [
			{
				id: throwaway.id,
			},
		],
	});
	expect(deleted.success).toBe(true);

	await expectDenied(
		api.asWellKnownAdmin().organization.find({
			id: throwaway.id,
		}),
	);
});

test("only the instance admin creates an organisation", async ({ api }) => {
	// Creating an organisation is an instance action, not an organisation one,
	// so no role inside an organisation may do it, admin included.
	for (const role of ROLES) {
		await expectForbidden(
			api.as(role).organization.create({
				name: `E2E Tenancy Create ${role}`,
				slug: `e2e-tenancy-${role}-${runId()}`,
			}),
		);
	}

	const slug = `e2e-tenancy-instance-${runId()}`;
	const created = await api.asWellKnownAdmin().organization.create({
		name: "E2E Tenancy Create Instance",
		slug,
	});

	expect(created.data.slug).toBe(slug);
});

test("only managers and admins change members", async ({ api, org }) => {
	const userId = await invitedMember(api.as("admin"), org.id, "changed");

	for (const role of UNPRIVILEGED) {
		await expectForbidden(
			api.as(role).organizationMember.update({
				organizationId: org.id,
				userId,
				role: "viewer",
			}),
		);
	}

	const demoted = await api.as("manager").organizationMember.update({
		organizationId: org.id,
		userId,
		role: "viewer",
	});
	expect(demoted.data.role).toBe("viewer");

	// Handing out an admin role needs `manage_organization`, which a manager
	// does not have.
	await expectForbidden(
		api.as("manager").organizationMember.update({
			organizationId: org.id,
			userId,
			role: "admin",
		}),
	);

	const promoted = await api.as("admin").organizationMember.update({
		organizationId: org.id,
		userId,
		role: "admin",
	});
	expect(promoted.data.role).toBe("admin");

	await api.as("admin").organizationMember.delete({
		organizationId: org.id,
		refs: [
			{
				userId,
			},
		],
	});
});

test("only managers and admins remove members, and only an admin removes an admin", async ({
	api,
	org,
}) => {
	const memberUserId = await invitedMember(
		api.as("admin"),
		org.id,
		"removed-member",
	);
	const adminUserId = await invitedMember(
		api.as("admin"),
		org.id,
		"removed-admin",
	);

	await api.as("admin").organizationMember.update({
		organizationId: org.id,
		userId: adminUserId,
		role: "admin",
	});

	for (const role of UNPRIVILEGED) {
		await expectForbidden(
			api.as(role).organizationMember.delete({
				organizationId: org.id,
				refs: [
					{
						userId: memberUserId,
					},
				],
			}),
		);
	}

	const removed = await api.as("manager").organizationMember.delete({
		organizationId: org.id,
		refs: [
			{
				userId: memberUserId,
			},
		],
	});
	expect(removed.success).toBe(true);

	await expectForbidden(
		api.as("manager").organizationMember.delete({
			organizationId: org.id,
			refs: [
				{
					userId: adminUserId,
				},
			],
		}),
	);

	const removedAdmin = await api.as("admin").organizationMember.delete({
		organizationId: org.id,
		refs: [
			{
				userId: adminUserId,
			},
		],
	});
	expect(removedAdmin.success).toBe(true);
});

test("members and viewers list only the groups they belong to", async ({
	api,
	org,
}) => {
	for (const role of [
		"admin",
		"manager",
	] as const) {
		const groups = await api.as(role).group.list({
			pageIndex: 0,
			pageSize: 100,
		});

		// Every organisation is created with an "All Members" system group.
		expect(groups.rowCount).toBeGreaterThan(0);

		const found = await api.as(role).group.find({
			id: groups.data[0].id,
		});
		expect(found.data.id).toBe(groups.data[0].id);
	}

	// A group none of the unprivileged roles belongs to. Lists paginate and
	// the slice accumulates groups, so its own name is the filter.
	const strangerName = `E2E Group Of Nobody ${runId()}`;
	const stranger = await api.as("admin").group.create({
		name: strangerName,
	});

	for (const role of UNPRIVILEGED) {
		// The All Members group, which every member belongs to, is theirs to
		// see: reading a group no longer needs `manage_groups`.
		const groups = await api.as(role).group.list({
			pageIndex: 0,
			pageSize: 100,
		});
		expect(groups.data.some((group) => group.kind === "system")).toBe(true);

		const filtered = await api.as(role).group.list({
			pageIndex: 0,
			pageSize: 100,
			filters: {
				search: strangerName,
			},
		});
		expect(filtered.rowCount).toBe(0);

		// A group they are not in answers as if it were not there.
		await expectNotFound(
			api.as(role).group.find({
				id: stranger.data.id,
			}),
		);
		await expectNotFound(
			api.as(role).group.listMembers({
				groupId: stranger.data.id,
				pageIndex: 0,
				pageSize: 100,
			}),
		);
	}

	// Added to the group, a member sees it; the viewer, who was not added,
	// still does not.
	await api.as("admin").group.addMembers({
		groupId: stranger.data.id,
		userIds: [
			org.users.member.id,
		],
	});

	const visible = await api.as("member").group.list({
		pageIndex: 0,
		pageSize: 100,
		filters: {
			search: strangerName,
		},
	});
	expect(visible.data.map((group) => String(group.id))).toContain(
		String(stranger.data.id),
	);

	const foundByMember = await api.as("member").group.find({
		id: stranger.data.id,
	});
	expect(foundByMember.data.id).toBe(stranger.data.id);

	await expectNotFound(
		api.as("viewer").group.find({
			id: stranger.data.id,
		}),
	);

	await api.as("admin").group.delete({
		refs: [
			{
				id: stranger.data.id,
			},
		],
	});
});

test("only managers and admins create, change and delete a group", async ({
	api,
}) => {
	for (const role of UNPRIVILEGED) {
		await expectForbidden(
			api.as(role).group.create({
				name: `E2E Group Denied To ${role} ${runId()}`,
			}),
		);
	}

	const created = await api.as("manager").group.create({
		name: `E2E Manager Group ${runId()}`,
	});
	const groupId = created.data.id;

	for (const role of UNPRIVILEGED) {
		await expectForbidden(
			api.as(role).group.update({
				id: groupId,
				name: "E2E Group Renamed By The Wrong Role",
			}),
		);
		await expectForbidden(
			api.as(role).group.delete({
				refs: [
					{
						id: groupId,
					},
				],
			}),
		);
	}

	const name = `E2E Admin Renamed Group ${runId()}`;
	const renamed = await api.as("admin").group.update({
		id: groupId,
		name,
	});
	expect(renamed.data.name).toBe(name);

	const deleted = await api.as("manager").group.delete({
		refs: [
			{
				id: groupId,
			},
		],
	});
	expect(deleted.success).toBe(true);
});

test("only managers and admins change group membership", async ({
	api,
	org,
}) => {
	const created = await api.as("admin").group.create({
		name: `E2E Membership Group ${runId()}`,
	});
	const groupId = created.data.id;
	const userIds = [
		org.users.member.id,
	];

	for (const role of UNPRIVILEGED) {
		await expectForbidden(
			api.as(role).group.addMembers({
				groupId,
				userIds,
			}),
		);
	}

	await api.as("manager").group.addMembers({
		groupId,
		userIds,
	});

	const members = await api.as("manager").group.listMembers({
		groupId,
		pageIndex: 0,
		pageSize: 100,
	});
	expect(members.data.map((member) => member.user.id)).toContain(
		org.users.member.id,
	);

	for (const role of UNPRIVILEGED) {
		await expectForbidden(
			api.as(role).group.removeMembers({
				groupId,
				userIds,
			}),
		);
	}

	const removed = await api.as("admin").group.removeMembers({
		groupId,
		userIds,
	});
	expect(removed.success).toBe(true);

	await api.as("admin").group.delete({
		refs: [
			{
				id: groupId,
			},
		],
	});
});
