import type { CreateRouterUtilsOptions } from "@orpc/tanstack-query";
import { keepPreviousData } from "@tanstack/react-query";
import { type client, orpc } from "./orpc";

export const queryDefaults: CreateRouterUtilsOptions<
	typeof client
>["experimental_defaults"] = {
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
		create: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.asset.key(),
					});
				},
			},
		},
		update: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.asset.key(),
					});
				},
			},
		},
		delete: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.asset.key(),
					});
				},
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
		create: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.block.key(),
					});
				},
			},
		},
		update: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.block.key(),
					});
				},
			},
		},
		delete: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.block.key(),
					});
				},
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
		create: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.bot.key(),
					});
				},
			},
		},
		update: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.bot.key(),
					});
				},
			},
		},
		delete: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.bot.key(),
					});
				},
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
		create: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.chat.key(),
					});
				},
			},
		},
		update: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.chat.key(),
					});
				},
			},
		},
		delete: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.chat.key(),
					});
				},
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
		create: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.chatMessage.key(),
					});
				},
			},
		},
		update: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.chatMessage.key(),
					});
				},
			},
		},
		delete: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.chatMessage.key(),
					});
				},
			},
		},
		rate: {
			mutationOptions: {
				onSuccess: (output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.chatMessage.key({
							input: { chatId: output.data.chatId },
						}),
					});
				},
			},
		},
	},
	courseInvitation: {
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
		create: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.courseInvitation.key(),
					});
				},
			},
		},
		update: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.courseInvitation.key(),
					});
				},
			},
		},
		delete: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.courseInvitation.key(),
					});
				},
			},
		},
		respond: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.courseInvitation.key(),
					});
				},
			},
		},
	},
	course: {
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
		create: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.course.key(),
					});
				},
			},
		},
		update: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.course.key(),
					});
				},
			},
		},
		delete: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.course.key(),
					});
				},
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
		create: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.organizationInvitation.key(),
					});
				},
			},
		},
		update: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.organizationInvitation.key(),
					});
				},
			},
		},
		delete: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.organizationInvitation.key(),
					});
				},
			},
		},
		respond: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.organizationInvitation.key(),
					});
				},
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
		create: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.organizationMember.key(),
					});
				},
			},
		},
		update: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.organizationMember.key(),
					});
				},
			},
		},
		delete: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.organizationMember.key(),
					});
				},
			},
		},
	},
	organizationProvider: {
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
		create: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.organizationProvider.key(),
					});
				},
			},
		},
		update: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.organizationProvider.key(),
					});
				},
			},
		},
		delete: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.organizationProvider.key(),
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
		create: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.organization.key(),
					});
				},
			},
		},
		update: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.organization.key(),
					});
				},
			},
		},
		delete: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.organization.key(),
					});
				},
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
	},
	job: {
		list: {
			queryOptions: {
				placeholderData: keepPreviousData,
			},
		},
		create: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					ctx.client.invalidateQueries({
						queryKey: orpc.job.key(),
					});
				},
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
		updatePassword: {},
		setActiveOrganization: {
			mutationOptions: {
				onSuccess: (_output, _input, _, ctx) => {
					// TODO: Unsure if this is actually needed, but probably a good idea to avoid stale data
					ctx.client.clear();
				},
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
};
