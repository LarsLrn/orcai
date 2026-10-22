import { describe, expect, test } from "bun:test";
import { DB, dbSchema } from "@orcai/db";
import { eq } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import type { TwoFactorPolicy } from "@/lib/auth/two-factor-policy";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { AppConfigService } from "@/lib/effect/services/config";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, signIn, instanceAdmin } =
	authzIntegration();

const rejection = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: unknown) => error,
	);

/** The actor's call options with `TWO_FACTOR_REQUIRED` set to `policy`. */
const underPolicy = async (actor: Actor, policy: TwoFactorPolicy) => {
	const options = await procedureOptions(actor);
	const context = options.context["effect/context"];
	const service = Context.get(context, AppConfigService);
	return {
		context: {
			...options.context,
			"effect/context": Context.add(context, AppConfigService, {
				...service,
				config: {
					...service.config,
					auth: {
						...service.config.auth,
						twoFactorPolicy: policy,
					},
				},
			}),
		},
	};
};

const enrol = (actor: Actor) =>
	run(
		Effect.gen(function* () {
			yield* (yield* DB)
				.update(dbSchema.user)
				.set({
					twoFactorEnabled: true,
				})
				.where(eq(dbSchema.user.id, actor.user.id));
		}),
	);

describe("requiredAuthMiddleware under TWO_FACTOR_REQUIRED", () => {
	test(
		"refuses a user the policy covers until they enrol",
		async () => {
			const {
				organizationId,
				actors: [member],
			} = await organizationWith([
				"member",
			]);
			const procedures = await run(Procedures);
			const me = async (actor: Actor) =>
				run(procedures.user.me({}, await underPolicy(actor, "all")));

			expect(await rejection(me(member))).toMatchObject({
				reason: "TWO_FACTOR_REQUIRED",
			});

			await enrol(member);
			const enrolled = await signIn(organizationId, member.user.id);
			expect((await me(enrolled)).data.id).toBe(member.user.id);
		},
		TIMEOUT,
	);

	test(
		"under admins, covers only instance admins",
		async () => {
			const {
				organizationId,
				actors: [member],
			} = await organizationWith([
				"member",
			]);
			const admin = await instanceAdmin(organizationId);
			const procedures = await run(Procedures);
			const me = async (actor: Actor) =>
				run(procedures.user.me({}, await underPolicy(actor, "admins")));

			expect((await me(member)).data.id).toBe(member.user.id);
			expect(await rejection(me(admin))).toMatchObject({
				reason: "TWO_FACTOR_REQUIRED",
			});
		},
		TIMEOUT,
	);
});
