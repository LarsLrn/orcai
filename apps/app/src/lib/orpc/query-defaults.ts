import type { CreateRouterUtilsOptions } from "@orpc/tanstack-query";
import { keepPreviousData } from "@tanstack/react-query";
import { type client, orpc } from "./orpc";

export const queryDefaults = {
	asset: {
		list: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		find: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
	},
	assetPoint: {
		list: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
	},
	block: {
		list: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		find: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
	},
	bot: {
		list: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		listDrafts: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		find: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		findEditor: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
	},
	chat: {
		list: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		find: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
	},
	chatMessage: {
		list: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		find: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
	},
	group: {
		list: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		find: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		listMembers: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
	},
	organizationInvitation: {
		list: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		find: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
	},
	organizationMember: {
		list: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		find: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
	},
	provider: {
		list: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		find: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
	},
	resource: {
		listGrants: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		listPrincipals: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		getVisibility: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
	},
	model: {
		list: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		find: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		discover: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.model.key(),
					});
				},
			},
		},
	},
	organization: {
		list: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		find: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
	},
	storage: {
		createUploadUrls: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.storage.key(),
					});
				},
			},
		},
		createDownloadUrl: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		finalizeUpload: {
			mutationOptions: {
				onSuccess: (_output, input, _, ctx) => {
					if (input.route === "asset") {
						ctx.client.invalidateQueries({
							queryKey: orpc.asset.key(),
						});
					}
				},
			},
		},
	},
	job: {
		list: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
	},
	user: {
		list: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		find: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		listAccess: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		setTourState: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						// TODO: Only invalidate a specific user
						queryKey: orpc.user.key(),
					});
				},
			},
		},
	},
} satisfies CreateRouterUtilsOptions<typeof client>["experimental_defaults"];
