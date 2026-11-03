import { describe, expect, mock, test } from "bun:test";
import type * as Effect from "effect/Effect";
import { mapEffectErrors } from "@/lib/orpc/implementation/error-mapping";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { appIntegration, TIMEOUT } from "@/lib/testing/app-integration";

const { run, organizationWith, procedureOptions } = appIntegration();

// Assistant tools run on the app's runtime; here it is the test's.
mock.module("@/lib/effect/runtime", () => ({
	runPromise: <A, E>(effect: Effect.Effect<A, E, never>) => run(effect),
}));
const { listInvitationsTool } = await import(
	"@/lib/ai/tools/assistant/people/list-invitations"
);
const { createAssistantTurn } = await import(
	"@/lib/ai/tools/assistant/turn-state"
);

/** A manager the admin demotes to member, and the tokens from before and after. */
const demotedManager = async () => {
	const {
		organizationId,
		actors: [admin, manager],
		zedToken: beforeDemotion,
	} = await organizationWith([
		"admin",
		"manager",
	]);
	const procedures = await run(Procedures);
	const { meta } = await run(
		procedures.organizationMember.update(
			{
				userId: manager.user.id,
				role: "member",
			},
			await procedureOptions(admin, beforeDemotion),
		),
	);
	const afterDemotion = meta?.zedToken;
	expect(afterDemotion).toBeDefined();
	expect(afterDemotion).not.toBe(beforeDemotion);
	return {
		organizationId,
		manager,
		beforeDemotion,
		afterDemotion,
		procedures,
	};
};

describe("authorization reads at an input token", () => {
	test(
		"a demoted manager replaying a token from before the demotion keeps no manager capability",
		async () => {
			const {
				organizationId,
				manager,
				beforeDemotion,
				afterDemotion,
				procedures,
			} = await demotedManager();
			const options = await procedureOptions(manager, afterDemotion);

			const check = await run(
				procedures.authorization.check(
					{
						entityType: "organization",
						entityId: organizationId,
						permission: "manage_groups",
						zedToken: beforeDemotion,
					},
					options,
				),
			);
			const capabilities = await run(
				procedures.authorization.organizationCapabilities(
					{
						permissions: [
							"manage_groups",
						],
						zedToken: beforeDemotion,
					},
					options,
				),
			);

			expect(check.data.allowed).toBe(false);
			expect(capabilities.data.capabilities.manage_groups).toBe(false);
		},
		TIMEOUT,
	);

	test(
		"an Assistant tool call at a turn token from before the demotion is refused",
		async () => {
			const { manager, beforeDemotion, afterDemotion } = await demotedManager();
			const { context } = await procedureOptions(manager, afterDemotion);
			const tool = listInvitationsTool({
				// The app maps a procedure's failures, so the tool reads them as refusals.
				context: {
					...context,
					"effect/wrap": mapEffectErrors,
				},
				turn: createAssistantTurn({
					zedToken: beforeDemotion,
				}),
			});

			const outcome = await Promise.resolve(
				tool.execute?.(
					{
						status: "pending",
						limit: 10,
					},
					{
						toolCallId: "list-invitations",
						messages: [],
						context: {},
					},
				),
			).then(
				() => "listed",
				(error: unknown) => String(error),
			);

			expect(outcome).toContain("permission");
		},
		TIMEOUT,
	);
});
