import { describe, expect, test } from "bun:test";
import {
	AUTHZ_CAPABILITY_ENTITY_TYPES,
	AUTHZ_ENTITY_TYPES,
	AUTHZ_PERMISSIONS_BY_ENTITY,
	AUTHZ_RESOURCE_TYPES,
	ORGANIZATION_ROLE_PERMISSIONS,
	ORGANIZATION_ROLES,
} from "../../src/authz/permissions";

describe("authz permissions", () => {
	test("resource types are a subset of entity types", () => {
		for (const resourceType of AUTHZ_RESOURCE_TYPES) {
			expect(AUTHZ_ENTITY_TYPES).toContain(resourceType);
		}
	});

	test("capability entity types are a subset of entity types", () => {
		for (const capabilityType of AUTHZ_CAPABILITY_ENTITY_TYPES) {
			expect(AUTHZ_ENTITY_TYPES).toContain(capabilityType);
		}
	});

	test("every entity defines a permission list", () => {
		for (const entity of AUTHZ_ENTITY_TYPES) {
			expect(AUTHZ_PERMISSIONS_BY_ENTITY[entity]).toBeArray();
		}
	});

	test("admin role has every organization permission", () => {
		const adminPermissions = new Set(ORGANIZATION_ROLE_PERMISSIONS.admin);
		for (const permission of AUTHZ_PERMISSIONS_BY_ENTITY.organization) {
			expect(adminPermissions.has(permission)).toBe(true);
		}
	});

	test("roles have monotonically decreasing permissions", () => {
		const roles = ORGANIZATION_ROLES;
		for (let i = 0; i < roles.length - 1; i++) {
			const current = new Set(ORGANIZATION_ROLE_PERMISSIONS[roles[i]]);
			const next = new Set(ORGANIZATION_ROLE_PERMISSIONS[roles[i + 1]]);

			for (const permission of next) {
				expect(current.has(permission)).toBe(true);
			}
		}
	});
});
