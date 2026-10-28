import { describe, expect, test } from "bun:test";
import type { PublicationStatus } from "@orcai/schema";
import {
	type Actor,
	authzIntegration,
	queueBehindOrganizationLock,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions } = authzIntegration();

const behaviour = (status: PublicationStatus) => ({
	type: "template" as const,
	name: "Integration behaviour",
	description: null,
	contentJson: null,
	contentHtml: null,
	status,
	config: {
		systemPrompt: "Integration prompt",
	},
});

/** A behaviour block in `status`, linked to a ready bot. */
const behaviourOfReadyBot = async (status: PublicationStatus) => {
	const {
		organizationId,
		actors: [owner],
		zedToken,
	} = await organizationWith([
		"member",
	]);
	const procedures = await run(Procedures);
	const block = await run(
		procedures.block.create(
			behaviour(status),
			await procedureOptions(owner, zedToken),
		),
	);
	const bot = await run(
		procedures.bot.save(
			{
				name: "Integration bot",
				description: "Integration bot",
				status: "ready",
				templateBlockId: block.data.id,
			},
			await procedureOptions(owner, block.meta?.zedToken ?? zedToken),
		),
	);
	const update = async (actor: Actor, next: PublicationStatus) =>
		run(
			procedures.block.update(
				{
					id: block.data.id,
					...behaviour(next),
					name: "Integration behaviour renamed",
				},
				await procedureOptions(actor, bot.meta?.zedToken),
			),
		);

	return {
		organizationId,
		owner,
		update,
	};
};

describe("block status of a ready bot's block", () => {
	test(
		"a draft block saves while it stays draft",
		async () => {
			const { owner, update } = await behaviourOfReadyBot("draft");

			const { data } = await update(owner, "draft");

			expect(data).toMatchObject({
				name: "Integration behaviour renamed",
				status: "draft",
			});
		},
		TIMEOUT,
	);

	test(
		"a draft save queued behind a concurrent publish of the block is refused",
		async () => {
			const { organizationId, owner, update } =
				await behaviourOfReadyBot("draft");
			let draftSave: unknown;

			await queueBehindOrganizationLock(
				organizationId,
				() => update(owner, "ready"),
				() =>
					update(owner, "draft").then(
						() => undefined,
						(error: unknown) => {
							draftSave = error;
						},
					),
			);

			expect(draftSave).toMatchObject({
				reason: "BLOCK_IN_USE_BY_READY_BOTS",
			});
		},
		TIMEOUT,
	);

	test(
		"a ready block cannot move to draft",
		async () => {
			const { owner, update } = await behaviourOfReadyBot("ready");

			const error = await update(owner, "draft").then(
				() => undefined,
				(error: unknown) => error,
			);

			expect(error).toMatchObject({
				reason: "BLOCK_IN_USE_BY_READY_BOTS",
				params: {
					botNames: [
						"Integration bot",
					],
				},
			});
		},
		TIMEOUT,
	);
});
