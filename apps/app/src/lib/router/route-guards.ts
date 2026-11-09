import type {
	CapabilityEntityType,
	CapabilityFor,
	OrganizationCapability,
} from "@orcai/schema";
import type { QueryClient } from "@tanstack/react-query";
import { notFound, redirect } from "@tanstack/react-router";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { organizationCapabilitiesQuery } from "@/lib/router/organization-capabilities-query";

type RouteAuth =
	| {
			isAuthenticated: false;
	  }
	| {
			isAuthenticated: true;
			twoFactor: {
				setupRequired: boolean;
			};
	  };

const isSignedIn = <Auth extends RouteAuth>(
	auth: Auth,
): auth is Extract<
	Auth,
	{
		isAuthenticated: true;
	}
> => auth.isAuthenticated;

/**
 * Signed in under the rules every procedure applies: otherwise to sign-in,
 * or to set up the second factor the policy demands first.
 */
export const ensureSignedIn = <Auth extends RouteAuth>(auth: Auth) => {
	if (!isSignedIn(auth)) {
		throw redirect({
			to: "/login",
			statusCode: 302,
		});
	}

	if (auth.twoFactor.setupRequired) {
		throw redirect({
			to: "/setup-two-factor",
			statusCode: 302,
		});
	}

	return auth;
};

/**
 * Gates a route in `beforeLoad`, so no child loader runs first. A page the
 * viewer may not open is not found, as detail pages hide what they cannot see.
 */
export const ensureOrganizationCapability = async ({
	queryClient,
	permission,
}: {
	queryClient: QueryClient;
	permission: OrganizationCapability;
}) => {
	const { data } = await queryClient.query(organizationCapabilitiesQuery());

	if (!hasCapability(data.capabilities, permission)) {
		throw notFound();
	}
};

/** Gates a route on one entity, like `ensureOrganizationCapability`. */
export const ensureEntityCapability = async <
	Entity extends CapabilityEntityType,
>({
	queryClient,
	entityType,
	entityId,
	permission,
}: {
	queryClient: QueryClient;
	entityType: Entity;
	entityId: string;
	permission: CapabilityFor<Entity>;
}) => {
	const result = await queryClient.query(
		orpc.authorization.check.queryOptions({
			input: {
				entityType,
				entityId,
				permission,
			},
		}),
	);

	if (!result.data.allowed) {
		throw notFound();
	}
};
