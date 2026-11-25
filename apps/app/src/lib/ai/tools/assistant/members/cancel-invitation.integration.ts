import { describe, expect, test } from "bun:test";
import { mapEffectErrors } from "@/lib/orpc/implementation/error-mapping";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { appIntegration, TIMEOUT } from "@/lib/testing/app-integration";
import { createAssistantTurn } from "../turn-state";
import { cancelInvitations } from "./cancel-invitation";

const { run, organizationWith, procedureOptions } = appIntegration();

describe("cancelInvitation", () => {
	test(
		"one manager withdraws another manager's invitation and the summary keeps its email",
		async () => {
			const {
				actors: [inviter, colleague],
				zedToken,
			} = await organizationWith([
				"manager",
				"manager",
			]);
			const procedures = await run(Procedures);
			const email = `invitee-${crypto.randomUUID()}@example.test`;
			const {
				data: [invitation],
				meta,
			} = await run(
				procedures.organizationInvitation.create(
					{
						role: "member",
						expiresAt: new Date(Date.now() + 7 * 86_400_000),
						items: [
							{
								email,
							},
						],
					},
					await procedureOptions(inviter, zedToken),
				),
			);
			const token = meta?.zedToken ?? zedToken;
			const { context } = await procedureOptions(colleague, token);

			const output = await run(
				cancelInvitations(
					{
						context: {
							...context,
							"effect/wrap": mapEffectErrors,
						},
						turn: createAssistantTurn({
							zedToken: token,
						}),
					},
					[
						invitation.id,
					],
				),
			);

			expect(output).toEqual({
				withdrawn: [
					{
						type: "invitation",
						id: invitation.id,
						email,
					},
				],
			});
			const { rowCount } = await run(
				procedures.organizationInvitation.list(
					{
						filters: {
							status: "pending",
						},
					},
					await procedureOptions(colleague, token),
				),
			);
			expect(rowCount).toBe(0);
		},
		TIMEOUT,
	);
});
