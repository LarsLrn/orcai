import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

/** Holds the newest zedToken produced by the authz writes of one request. */
export interface ZedTokenMailbox {
	readonly record: (zedToken: string | undefined) => void;
	readonly read: () => string | undefined;
}

export const createZedTokenMailbox = (): ZedTokenMailbox => {
	let latest: string | undefined;

	return {
		record: (zedToken) => {
			if (zedToken) latest = zedToken;
		},
		read: () => latest,
	};
};

export class ZedTokenMailboxService extends Context.Service<
	ZedTokenMailboxService,
	ZedTokenMailbox
>()("ZedTokenMailboxService") {}

/** Records a token when a mailbox is present. No-op for callers without one */
export const recordZedToken = (zedToken: string | undefined) =>
	Effect.serviceOption(ZedTokenMailboxService).pipe(
		Effect.flatMap((mailbox) =>
			Effect.sync(() => {
				if (Option.isSome(mailbox)) mailbox.value.record(zedToken);
			}),
		),
	);
