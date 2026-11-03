import * as Effect from "effect/Effect";
import { auth as betterAuth } from "@/lib/auth/auth";
import { requiresTwoFactor } from "@/lib/auth/two-factor-policy";
import { AppConfigService } from "@/lib/effect/services/config";
import * as AppErrors from "@/lib/effect/utils/errors";
import { recordRequestUser } from "@/lib/observability/request-span";

type Session = typeof betterAuth.$Infer.Session;

/** The rules every signed-in surface applies: a session, and the second factor the policy demands. */
export const requireSignedIn = (
	auth:
		| {
				session?: Session["session"];
				user?: Session["user"];
		  }
		| null
		| undefined,
) =>
	Effect.gen(function* () {
		if (!auth?.session || !auth.user) {
			return yield* Effect.fail(
				new AppErrors.UnauthorizedError({
					reason: "AUTH_REQUIRED",
					message: "You must be logged in to access this resource.",
				}),
			);
		}

		const { session, user } = auth;
		recordRequestUser(user.id);

		const { config } = yield* AppConfigService;
		if (requiresTwoFactor(config.auth.twoFactorPolicy, user)) {
			return yield* Effect.fail(
				new AppErrors.ForbiddenError({
					reason: "TWO_FACTOR_REQUIRED",
					message: "Set up two-factor authentication to continue.",
				}),
			);
		}

		return {
			session,
			user,
		};
	});

/** The request's session under those rules. */
export const signedInSession = (headers: Headers) =>
	// getSession answers null without a session, so a throw is a backend failure.
	Effect.tryPromise(() =>
		betterAuth.api.getSession({
			headers,
		}),
	).pipe(Effect.flatMap(requireSignedIn));

/** Answers a plain HTTP route for a signed-in user: 401 without a session, 403 before the required second factor. */
export const respondSignedIn = <E, R>(
	request: Request,
	respond: (
		auth: Effect.Success<ReturnType<typeof signedInSession>>,
	) => Effect.Effect<Response, E, R>,
) =>
	signedInSession(request.headers).pipe(
		Effect.matchEffect({
			onFailure: (error) => {
				switch (error._tag) {
					case "UnauthorizedError":
						return Effect.succeed(
							new Response("Unauthorized", {
								status: 401,
							}),
						);
					case "ForbiddenError":
						return Effect.succeed(
							new Response("Forbidden", {
								status: 403,
							}),
						);
					default:
						return Effect.fail(error);
				}
			},
			onSuccess: respond,
		}),
	);
