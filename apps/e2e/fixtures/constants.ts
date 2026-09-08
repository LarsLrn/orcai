/** The only instance-wide seed: created by the first-run spec, signed in as by every run. */
export const WELL_KNOWN_ADMIN = {
	email: "admin@e2e.orcai.test",
	password: "E2E-well-known-admin-9f3a",
	name: "E2E Admin",
} as const;

/** The organisation the first-run spec creates alongside the well-known admin. */
export const INSTANCE_ORGANISATION = {
	name: "E2E Instance",
	slug: "e2e-instance",
} as const;

export const ROLES = [
	"admin",
	"manager",
	"member",
	"viewer",
] as const;

export type Role = (typeof ROLES)[number];

/** Password every fixture-created user gets. */
export const USER_PASSWORD = "E2E-worker-user-4b71";

/** Email domain for every user the suite creates. */
export const EMAIL_DOMAIN = "e2e.orcai.test";
