import { expect, test } from "bun:test";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { appIntegration, TIMEOUT } from "@/lib/testing/app-integration";

const { run, organizationWith, instanceAdmin, procedureOptions } =
	appIntegration();

test(
	"instance user exposes moderation fields without preferences",
	async () => {
		const {
			organizationId,
			actors: [member],
		} = await organizationWith([
			"member",
		]);
		const admin = await instanceAdmin(organizationId);
		const p = await run(Procedures);
		const { data } = await run(
			p.instance.user(
				{
					id: member.user.id,
				},
				await procedureOptions(admin),
			),
		);
		const list = await run(
			p.user.listAll(
				{
					filters: {
						search: member.user.email,
					},
				},
				await procedureOptions(admin),
			),
		);
		const row = list.data.find((entry) => entry.id === member.user.id);
		expect(row).toBeDefined();
		expect(row).not.toHaveProperty("preferences");
		expect(row).toHaveProperty("banReason");
		expect(row).toHaveProperty("banExpires");
		expect(data).not.toHaveProperty("preferences");
		expect(data).toHaveProperty("banReason");
		expect(data).toHaveProperty("banExpires");
	},
	TIMEOUT,
);
