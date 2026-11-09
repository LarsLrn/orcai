import * as Context from "effect/Context";
import * as Tracer from "effect/Tracer";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { type Actor, appIntegration } from "@/lib/testing/app-integration";

/** The library lists' integration fixtures over one runtime. */
export const libraryIntegration = () => {
	const {
		run,
		caller,
		organizationWith,
		procedureOptions,
		createAsset,
		signIn,
	} = appIntegration();

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
		const { call, observe, token } = caller(zedToken);

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

		const asset = async (owner: Actor) => {
			const created = await createAsset(owner, organizationId);
			await observe(created.zedToken);
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
			observe,
			token,
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
