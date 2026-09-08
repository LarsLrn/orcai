import { describe, expect, test } from "bun:test";
import type { OrganizationId, UserId } from "@orcai/core";
import { PgDialect } from "drizzle-orm/pg-core";
import { groupScopeCondition } from "./group-visibility";

const dialect = new PgDialect();
const userId = "00000000-0000-4000-8000-000000000001" as UserId;
const organizationId = "00000000-0000-4000-8000-000000000002" as OrganizationId;

const render = (condition: ReturnType<typeof groupScopeCondition>) =>
	condition === undefined ? undefined : dialect.sqlToQuery(condition).sql;

describe("groupScopeCondition", () => {
	test("matches nothing when the caller has no organisation", () => {
		expect(
			render(
				groupScopeCondition({
					userId,
					managed: [],
					unmanaged: [],
				}),
			),
		).toBe("false");
	});

	test("keeps every group of an organisation the caller manages", () => {
		const sql = render(
			groupScopeCondition({
				userId,
				managed: [
					organizationId,
				],
				unmanaged: [],
			}),
		);

		expect(sql).toContain('"group"."organization_id" in ($1)');
	});

	test("keeps only the caller's own groups elsewhere", () => {
		const sql = render(
			groupScopeCondition({
				userId,
				managed: [],
				unmanaged: [
					organizationId,
				],
			}),
		);

		expect(sql).toContain("organization_id");
		expect(sql).toContain("group_member");
	});
});
