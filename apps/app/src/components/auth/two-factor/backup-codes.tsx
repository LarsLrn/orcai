import { CopyIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";

const download = (codes: readonly string[]) => {
	const blob = new Blob(
		[
			`${codes.join("\n")}\n`,
		],
		{
			type: "text/plain;charset=utf-8",
		},
	);
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = "orcai-backup-codes.txt";
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
};

/** Backup codes, shown once: each signs in one time when the authenticator is out of reach. */
export const BackupCodes = ({ codes }: { codes: readonly string[] }) => (
	<div className="flex flex-col gap-4">
		<p className="text-muted-foreground text-sm">
			{m.two_factor_backup_codes_description()}
		</p>
		<ul
			aria-label={m.two_factor_backup_codes_list_label()}
			className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4 font-mono text-sm"
		>
			{codes.map((code) => (
				<li key={code}>{code}</li>
			))}
		</ul>
		<div className="flex flex-wrap gap-2">
			<Button
				type="button"
				variant="outline"
				onClick={() =>
					toast.promise(navigator.clipboard.writeText(codes.join("\n")), {
						success: m.two_factor_backup_codes_copy_toast_success(),
						error: m.two_factor_backup_codes_copy_toast_error(),
					})
				}
			>
				<CopyIcon />
				{m.two_factor_backup_codes_copy_button()}
			</Button>
			<Button type="button" variant="outline" onClick={() => download(codes)}>
				<DownloadIcon />
				{m.two_factor_backup_codes_download_button()}
			</Button>
		</div>
	</div>
);
