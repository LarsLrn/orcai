import { randomBytes } from "node:crypto";
import type { OrganizationId, UserId } from "@orcai/core";
import { organizationIdSchema, userIdSchema } from "@orcai/schema";
import { createApiClient } from "./api";
import { type Session, type StorageState, signIn, signUpInvited } from "./auth";
import { untilAllowed } from "./authorization";
import {
	EMAIL_DOMAIN,
	INSTANCE_ORGANISATION,
	ROLES,
	type Role,
	USER_PASSWORD,
	WELL_KNOWN_ADMIN,
} from "./constants";

export type WorkerUser = {
	id: UserId;
	email: string;
	password: string;
};

export type WorkerOrganisation = {
	id: OrganizationId;
	slug: string;
	name: string;
	users: Record<Role, WorkerUser>;
	storageStates: Record<Role, StorageState>;
	/** `cookie` header per role, for API calls outside the `api` fixture. */
	cookieHeaders: Record<Role, string>;
};

/** Short suffix that keeps `--no-reset` reruns from colliding. */
export const runId = (): string => randomBytes(3).toString("hex");

/** Sign in as the well-known admin with the instance organisation active. */
const openAdminSession = async (baseURL: string): Promise<Session> => {
	const session = await signIn(baseURL, WELL_KNOWN_ADMIN);
	const api = createApiClient(baseURL, session.cookieHeader);

	// The instance organisation is the oldest, so ascending puts it on the first page.
	const organisations = await api.organization.list({
		pageIndex: 0,
		pageSize: 10,
		sort: [
			{
				id: "createdAt",
				desc: false,
			},
		],
	});

	const instance = organisations.data.find(
		(organisation) => organisation.slug === INSTANCE_ORGANISATION.slug,
	);

	if (!instance) {
		throw new Error(
			`The well-known admin is not a member of "${INSTANCE_ORGANISATION.slug}". Did the setup project run?`,
		);
	}

	await api.user.setActiveOrganization({
		organizationId: instance.id,
	});

	return session;
};

let openedAdminSession: Promise<Session> | undefined;

/** The well-known admin session, opened once per Playwright worker process. */
export const adminSession = (baseURL: string): Promise<Session> =>
	(openedAdminSession ??= openAdminSession(baseURL));

/** Create an organisation owned by the well-known admin with one user per role. */
export const createWorkerOrganisation = async (params: {
	baseURL: string;
	admin: Session;
	name: string;
	slug: string;
}): Promise<WorkerOrganisation> => {
	const adminApi = createApiClient(params.baseURL, params.admin.cookieHeader);

	const created = await adminApi.organization.create({
		name: params.name,
		slug: params.slug,
	});

	const organizationId = organizationIdSchema.parse(created.data.id);

	const members = [];

	for (const role of ROLES) {
		const email = `${params.slug}-${role}@${EMAIL_DOMAIN}`;
		const session = await signUpInvited({
			baseURL: params.baseURL,
			admin: adminApi,
			organisation: {
				id: organizationId,
			},
			role,
			name: `E2E ${role}`,
			email,
			password: USER_PASSWORD,
		});

		members.push({
			role,
			email,
			session,
			userId: userIdSchema.parse(session.userId),
		});
	}

	const users = {} as Record<Role, WorkerUser>;
	const storageStates = {} as Record<Role, StorageState>;
	const cookieHeaders = {} as Record<Role, string>;

	for (const member of members) {
		users[member.role] = {
			id: member.userId,
			email: member.email,
			password: USER_PASSWORD,
		};
		storageStates[member.role] = member.session.storageState;
		cookieHeaders[member.role] = member.session.cookieHeader;
	}

	return {
		id: organizationId,
		slug: params.slug,
		name: params.name,
		users,
		storageStates,
		cookieHeaders,
	};
};

/** The organisation an unaffiliated user joins and leaves again; never asserted on. */
const openThrowawayOrganisation = async (
	baseURL: string,
): Promise<OrganizationId> => {
	const admin = await adminSession(baseURL);
	const created = await createApiClient(
		baseURL,
		admin.cookieHeader,
	).organization.create({
		name: "E2E Unaffiliated",
		slug: `e2e-unaffiliated-${runId()}-${runId()}`,
	});

	return organizationIdSchema.parse(created.data.id);
};

let openedThrowawayOrganisation: Promise<OrganizationId> | undefined;

/** The throwaway organisation, created once per Playwright worker process. */
const throwawayOrganisation = (baseURL: string): Promise<OrganizationId> =>
	(openedThrowawayOrganisation ??= openThrowawayOrganisation(baseURL));

/** Create a user with no organisation: joins the throwaway organisation, then is removed. */
export const signUpUnaffiliated = async (params: {
	baseURL: string;
	name: string;
	email: string;
	password?: string;
}): Promise<Session> => {
	const admin = await adminSession(params.baseURL);
	const adminApi = createApiClient(params.baseURL, admin.cookieHeader);
	const organizationId = await throwawayOrganisation(params.baseURL);

	const session = await signUpInvited({
		baseURL: params.baseURL,
		admin: adminApi,
		organisation: {
			id: organizationId,
		},
		role: "member",
		name: params.name,
		email: params.email,
		password: params.password,
	});

	await untilAllowed(() =>
		adminApi.organizationMember.delete({
			organizationId,
			refs: [
				{
					userId: userIdSchema.parse(session.userId),
				},
			],
		}),
	);

	return session;
};
