import { DENIED, rejection, untilAllowed } from "../../fixtures/authorization";
import { ROLES } from "../../fixtures/constants";
import { type ApiClient, expect, test } from "../../fixtures/index";
import { enterApp } from "../../fixtures/navigation";

/**
 * Group ids a role can list. Every role may list groups now, each seeing its
 * own, and the claim under test is that no role ever reaches another
 * organisation's groups.
 */
const listableGroupIds = async (client: ApiClient): Promise<string[]> => {
	const groups = await client.group.list({
		pageIndex: 0,
		pageSize: 100,
	});

	return groups.data.map((group) => group.id);
};

for (const role of ROLES) {
	const article = role === "admin" ? "an" : "a";

	test(`${article} ${role} sees nothing of another organisation`, async ({
		api,
		org,
		orgs,
		pageAs,
	}) => {
		const other = await orgs.create("E2E Seam Neighbour");

		const visible = await api.as(role).organization.list({
			pageIndex: 0,
			pageSize: 100,
		});

		expect(visible.data.map((organisation) => organisation.id)).toContain(
			org.id,
		);
		expect(visible.data.map((organisation) => organisation.id)).not.toContain(
			other.id,
		);

		expect(DENIED).toContain(
			(
				await rejection(
					api.as(role).organization.find({
						id: other.id,
					}),
				)
			).code,
		);

		expect(DENIED).toContain(
			(
				await rejection(
					api.as(role).organizationMember.list({
						organizationId: other.id,
						pageIndex: 0,
						pageSize: 100,
					}),
				)
			).code,
		);

		// Every organisation gets an "All Members" group when it is created, so
		// the neighbour always has at least one group that could leak. The
		// neighbour admin's membership comes from the sign-up hook, which
		// answers no zedToken.
		const otherGroups = await untilAllowed(() =>
			api.as("admin", other).group.list({
				pageIndex: 0,
				pageSize: 100,
			}),
		);
		const otherGroupIds: string[] = otherGroups.data.map((group) => group.id);
		expect(otherGroupIds.length).toBeGreaterThan(0);

		const ownGroupIds = await listableGroupIds(api.as(role));
		expect(
			ownGroupIds.filter((id) => otherGroupIds.includes(id)),
		).toStrictEqual([]);

		const page = await pageAs(role);
		await enterApp(page, org.slug);

		// The switcher carries the active organisation, so it renders before the
		// neighbour's absence means anything.
		await expect(
			page.getByRole("button", {
				name: org.name,
			}),
		).toBeVisible();
		await expect(page.getByText(other.name)).toHaveCount(0);
	});
}
