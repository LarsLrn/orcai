import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Tracer from "effect/Tracer";
import { type Actor, authzIntegration } from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

/** The library lists' integration fixtures over one runtime. */
export const libraryIntegration = () => {
	const { run, organizationWith, procedureOptions, createAsset, signIn } =
		authzIntegration();

	type Options = Awaited<ReturnType<typeof procedureOptions>>;

	/**
	 * An organisation with an admin and a member, and `call`, which runs a
	 * procedure as an actor with the latest zed token.
	 */
	const organization = async () => {
		const {
			organizationId,
			actors: [admin, member],
			zedToken,
		} = await organizationWith([
			"admin",
			"member",
		]);
		const procedures = await run(Procedures);
		let token = zedToken;
		const call = async <A>(
			actor: Actor,
			operation: (options: Options) => Effect.Effect<
				A & {
					meta?: {
						zedToken?: string;
					};
				},
				unknown
			>,
		) => {
			const result = await run(operation(await procedureOptions(actor, token)));
			token = result.meta?.zedToken ?? token;
			return result;
		};

		const behaviour = async (
			owner: Actor,
			name: string,
			status: "ready" | "draft" = "ready",
		) =>
			(
				await call(owner, (options) =>
					procedures.block.create(
						{
							type: "behaviour",
							name,
							description: null,
							contentJson: null,
							status,
							config: {
								systemPrompt: "",
							},
						},
						options,
					),
				)
			).data.id;

		const share = (
			resource: {
				resourceType: "bot" | "block" | "asset";
				resourceId: string;
			},
			role: "viewer" | "editor" | "manager",
			principal:
				| {
						principalType: "user";
						principalId: Actor["user"]["id"];
				  }
				| {
						principalType: "group";
						principalId: string;
				  },
		) =>
			call(admin, (options) =>
				procedures.resource.grant(
					{
						...resource,
						role,
						principals: [
							principal,
						],
					} as Parameters<typeof procedures.resource.grant>[0],
					options,
				),
			);

		/** Makes later calls see writes made outside `call`. */
		const remember = (zedToken: string | undefined) => {
			token = zedToken ?? token;
		};

		const asset = async (owner: Actor) => {
			const created = await createAsset(owner, organizationId);
			remember(created.zedToken);
			return created.asset.id;
		};

		const toMember = {
			principalType: "user" as const,
			principalId: member.user.id,
		};

		return {
			organizationId,
			admin,
			member,
			procedures,
			call,
			behaviour,
			share,
			asset,
			remember,
			token: () => token,
			toMember,
		};
	};

	/** `options` under which a procedure counts the SQL statements it sends: one client span each. */
	const countingStatements = (options: Options) => {
		let statements = 0;
		const tracer = Tracer.make({
			span(spanOptions) {
				if (spanOptions.kind === "client") statements++;
				return Tracer.nativeTracer.span(spanOptions);
			},
		});
		return {
			options: {
				...options,
				context: {
					...options.context,
					"effect/context": Context.add(
						options.context["effect/context"],
						Tracer.Tracer,
						tracer,
					),
				},
			},
			statements: () => statements,
		};
	};

	const names = (page: {
		data: {
			name: string;
		}[];
	}) => page.data.map((row) => row.name).sort();

	return {
		run,
		procedureOptions,
		signIn,
		organization,
		countingStatements,
		names,
	};
};
