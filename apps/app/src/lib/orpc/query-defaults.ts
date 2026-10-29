import type { RouterClient } from "@orpc/server";
import type { RouterUtilsScoped } from "@orpc/tanstack-query";
import { keepPreviousData } from "@tanstack/react-query";
import type { router } from "./router";

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
				// Someone else's grant or membership change locks or unlocks it.
				refetchOnWindowFocus: "always",
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
		listCandidates: {
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
		listAccess: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
	},
	health: {
		instance: {
			queryOptions: {
				// Every fetch probes the dependencies: only on load and refresh.
				staleTime: 10_000,
				refetchOnWindowFocus: false,
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
	quota: {
		status: {
			queryOptions: {
				// Other members fill the pool too.
				refetchOnWindowFocus: "always",
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
	},
	organization: {
		list: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		listAll: {
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
		createDownloadUrl: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
	},
	user: {
		listAll: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
	},
} satisfies RouterUtilsScoped<RouterClient<typeof router>>;
