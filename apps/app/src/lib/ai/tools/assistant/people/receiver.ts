import { type HandedOver, userIdSchema } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { type AssistantToolDeps, callProcedure } from "../procedure-tool";

export const receiverIdSchema = userIdSchema.optional();

type NamedHandover = {
	handedOver?: {
		receiver: {
			type: "member";
			id: HandedOver["receiverId"];
			name: string | undefined;
		};
		bots: number;
		blocks: number;
		assets: number;
	};
};

/** What a membership change handed over, with the receiver named; nothing when nothing moved. */
export const receiverOf = (
	deps: AssistantToolDeps,
	handedOver: HandedOver | null,
) =>
	Effect.gen(function* () {
		if (handedOver === null) return {} as NamedHandover;
		const name = yield* callProcedure(deps, (procedures, options) =>
			procedures.organizationMember.find(
				{
					userId: handedOver.receiverId,
				},
				options,
			),
		).pipe(
			Effect.map(({ data }) => data.name),
			Effect.orElseSucceed(() => undefined),
		);
		const named: NamedHandover = {
			handedOver: {
				receiver: {
					type: "member",
					id: handedOver.receiverId,
					name,
				},
				bots: handedOver.bots,
				blocks: handedOver.blocks,
				assets: handedOver.assets,
			},
		};
		return named;
	});
