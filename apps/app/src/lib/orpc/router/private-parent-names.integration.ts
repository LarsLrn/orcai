// A2: refusing a block status change must not disclose private parent bot names.
import { expect, test } from "bun:test";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { appIntegration, TIMEOUT } from "@/lib/testing/app-integration";

const { run, organizationWith, caller } = appIntegration();
test(
	"a block owner receives no private parent bot name when moving the block to draft is refused",
	async () => {
		const {
			actors: [alice, bob],
			zedToken,
		} = await organizationWith([
			"member",
			"member",
		]);
		const p = await run(Procedures);
		const { call } = caller(zedToken);
		const fields = {
			type: "behaviour" as const,
			name: "Shared behaviour",
			description: null,
			contentJson: null,
			status: "ready" as const,
			config: {
				systemPrompt: "",
			},
		};
		const { data: block } = await call(alice, (o) => p.block.create(fields, o));
		await call(alice, (o) =>
			p.resource.grant(
				{
					resourceType: "block",
					resourceId: block.id,
					role: "viewer",
					principals: [
						{
							principalType: "user",
							principalId: bob.user.id,
						},
					],
				},
				o,
			),
		);
		const secret = `Confidential project ${crypto.randomUUID()}`;
		const { data: bot } = await call(bob, (o) =>
			p.bot.save(
				{
					name: secret,
					description: "Integration bot",
					status: "ready",
					behaviourId: block.id,
				},
				o,
			),
		);
		expect(
			await call(alice, (o) =>
				p.bot.find(
					{
						id: bot.id,
					},
					o,
				),
			).then(
				() => false,
				() => true,
			),
		).toBe(true);
		const error = await call(alice, (o) =>
			p.block.update(
				{
					...fields,
					id: block.id,
					status: "draft",
				},
				o,
			),
		).then(
			() => undefined,
			(e) => e,
		);
		expect(error).toMatchObject({
			reason: "BLOCK_IN_USE_BY_READY_BOTS",
			params: {
				botNames: [],
				otherCount: 1,
			},
		});
		expect(JSON.stringify(error)).not.toContain(secret);
	},
	TIMEOUT,
);
