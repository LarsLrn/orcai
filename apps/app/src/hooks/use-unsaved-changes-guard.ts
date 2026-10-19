// biome-ignore lint/suspicious/noDeprecatedImports: only its legacy overloads are deprecated.
import { useBlocker, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useConfirm } from "@/components/ui/dialog/confirm-dialog";
import { useCallbackRef } from "@/hooks/use-callback-ref";
import { m } from "@/paraglide/messages";

// Read at navigation time; a navigation that saves or discards on purpose passes `ignoreBlocker`.
const useUnsavedChangesGuard = (isDirty: () => boolean) => {
	const router = useRouter();
	const confirm = useConfirm();
	// The editor stays mounted until an allowed navigation has loaded its target.
	const [pathname] = useState(() => router.state.location.pathname);
	const shouldBlock = useCallbackRef(
		() => router.history.location.pathname === pathname && isDirty(),
	);
	const confirmLeave = useCallbackRef(() =>
		confirm({
			title: m.common_unsaved_changes_title(),
			description: m.common_unsaved_changes_description(),
			confirmText: m.common_unsaved_changes_leave_button(),
			cancelText: m.common_unsaved_changes_stay_button(),
		}),
	);
	const { status, proceed, reset } = useBlocker({
		shouldBlockFn: shouldBlock,
		enableBeforeUnload: shouldBlock,
		withResolver: true,
	});

	useEffect(() => {
		if (status !== "blocked") {
			return;
		}
		void confirmLeave().then((leave) => (leave ? proceed() : reset()));
	}, [
		status,
		proceed,
		reset,
		confirmLeave,
	]);
};

const useConfirmDiscard = () => {
	const confirm = useConfirm();

	return () =>
		confirm({
			title: m.common_unsaved_changes_discard_title(),
			description: m.common_unsaved_changes_discard_description(),
			confirmText: m.common_unsaved_changes_discard_button(),
			cancelText: m.common_unsaved_changes_stay_button(),
		});
};

export { useConfirmDiscard, useUnsavedChangesGuard };
