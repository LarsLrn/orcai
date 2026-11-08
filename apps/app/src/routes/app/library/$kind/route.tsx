import { type BlockType, blockTypeSchema } from "@orcai/schema";
import { createFileRoute } from "@tanstack/react-router";
import { kindParams } from "@/lib/router/kind-params";
import { m } from "@/paraglide/messages";

const TITLES = {
	behaviour: m.library_view_behaviour,
	repository: m.library_view_repository,
} satisfies Record<BlockType, () => string>;

export const Route = createFileRoute("/app/library/$kind")({
	params: kindParams(blockTypeSchema.options),
	// Runs on a slug that did not parse too, with the raw slug in params.
	head: ({ params, match }) => ({
		meta: match.paramsError
			? []
			: [
					{
						title: TITLES[params.kind](),
					},
				],
	}),
});
