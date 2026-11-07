// A3: organisation member responses must omit account moderation details and preferences.
import { expect, test } from "bun:test";
import { DB, dbSchema } from "@orcai/db";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { appIntegration, TIMEOUT } from "@/lib/testing/app-integration";

const { run, organizationWith, caller, instanceAdmin } = appIntegration();

const moderationKeys = [
	"banReason",
	"banExpires",
	"preferences",
];

const bannedMember = async () => {
	const {
		organizationId,
		actors: [manager, member],
		zedToken,
	} = await organizationWith([
		"manager",
		"member",
	]);
	await run(
		Effect.gen(function* () {
			yield* (yield* DB)
				.update(dbSchema.user)
				.set({
					banned: true,
					banReason: "Confidential moderation",
					banExpires: new Date("2030-01-01"),
				})
				.where(eq(dbSchema.user.id, member.user.id));
		}),
	);
	return {
		organizationId,
		manager,
		member,
		zedToken,
	};
};

for (const operation of [
	"find",
	"list",
] as const) {
	test(
		`member ${operation} exposes member status without account moderation details or preferences`,
		async () => {
			const { manager, member, zedToken } = await bannedMember();
			const p = await run(Procedures);
			const { call } = caller(zedToken);
			const data =
				operation === "find"
					? (
							await call(manager, (o) =>
								p.organizationMember.find(
									{
										userId: member.user.id,
									},
									o,
								),
							)
						).data
					: (
							await call(manager, (o) =>
								p.organizationMember.list(
									{
										pageIndex: 0,
										pageSize: 10,
									},
									o,
								),
							)
						).data.find((u) => u.id === member.user.id);
			expect(data).toMatchObject({
				name: member.user.name,
				email: member.user.email,
				organizationRole: "member",
				banned: true,
				emailVerified: member.user.emailVerified,
			});
			expect(
				Object.keys(data ?? {}).filter((key) => moderationKeys.includes(key)),
			).toEqual([]);
		},
		TIMEOUT,
	);
}

test(
	"the instance admin user lookup keeps the moderation details",
	async () => {
		const { organizationId, member, zedToken } = await bannedMember();
		const admin = await instanceAdmin(organizationId);
		const p = await run(Procedures);
		const { call } = caller(zedToken);
		const { data } = await call(admin, (o) =>
			p.instance.user(
				{
					id: member.user.id,
				},
				o,
			),
		);
		expect(data).toMatchObject({
			banned: true,
			banReason: "Confidential moderation",
			banExpires: new Date("2030-01-01"),
		});
	},
	TIMEOUT,
);
