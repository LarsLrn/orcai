import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronDown, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { orpc } from "@/lib/orpc/orpc";
import type { Chat } from "@/lib/orpc/schemas/chat";
import type { ChatBranch } from "@/lib/orpc/schemas/chat-branch";

interface BranchSwitcherProps {
	chat: Chat;
	branches: ChatBranch[];
}

export function BranchSwitcher({ chat, branches }: BranchSwitcherProps) {
	const navigate = useNavigate();
	const search = useSearch({
		strict: false,
	});
	const currentBranchId =
		(search as any).branch ?? chat.activeBranchId ?? branches[0]?.id;

	const { mutateAsync: updateBranch } = useMutation(
		orpc.chat.update.mutationOptions(),
	);

	const currentBranch =
		branches.find((b) => b.id === currentBranchId) ?? branches[0];

	if (!branches || branches.length <= 1) {
		return null;
	}

	const handleBranchSwitch = async (branchId: string) => {
		if (branchId === currentBranchId) return;

		// Update the active branch in the database
		await updateBranch({
			id: chat.id,
			activeBranchId: branchId,
		});

		navigate({
			to: ".",
			search: (prev) => ({
				...prev,
				branch: branchId,
			}),
		});
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="outline"
						size="sm"
						className="h-7 gap-1.5 px-2 font-normal text-xs"
					>
						<GitBranch className="size-3.5 text-muted-foreground" />
						<span className="max-w-37.5 truncate">{currentBranch?.name}</span>
						<ChevronDown className="size-3 text-muted-foreground opacity-50" />
					</Button>
				}
			/>
			<DropdownMenuContent align="end" className="w-50">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="px-2 py-1.5 font-normal text-muted-foreground text-xs">
						Switch Branch
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<div className="max-h-75 overflow-y-auto">
						{branches.map((branch) => (
							<DropdownMenuItem
								key={branch.id}
								onClick={() => handleBranchSwitch(branch.id)}
								className="justify-between"
							>
								<span className="truncate">{branch.name}</span>
								{branch.id === currentBranchId && (
									<div className="size-1.5 rounded-full bg-primary" />
								)}
							</DropdownMenuItem>
						))}
					</div>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
