import type {
	ConfigEntry,
	InstanceProcess,
	InstanceQueue,
	InstanceVersions,
} from "@orcai/schema";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatCount } from "@/lib/presentation/format-number";
import { formatDisplayTimestamp } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

const HealthCard = ({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: ReactNode;
}) => (
	<Card>
		<CardHeader>
			<CardTitle>{title}</CardTitle>
			<CardDescription>{description}</CardDescription>
		</CardHeader>
		<CardContent>{children}</CardContent>
	</Card>
);

const Empty = ({ children }: { children: ReactNode }) => (
	<p className="py-6 text-center text-muted-foreground text-sm">{children}</p>
);

export const ProcessesCard = ({
	processes,
}: {
	processes: readonly InstanceProcess[];
}) => (
	<HealthCard
		title={m.instance_health_processes_title()}
		description={m.instance_health_processes_description()}
	>
		{processes.length === 0 ? (
			<Empty>{m.instance_health_processes_empty()}</Empty>
		) : (
			<div className="overflow-auto rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{m.instance_health_process_name_header()}</TableHead>
							<TableHead>{m.instance_health_process_host_header()}</TableHead>
							<TableHead>{m.instance_health_process_status_header()}</TableHead>
							<TableHead>
								{m.instance_health_process_started_header()}
							</TableHead>
							<TableHead>
								{m.instance_health_process_heartbeat_header()}
							</TableHead>
							<TableHead>
								{m.instance_health_process_last_error_header()}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{processes.map((process) => (
							<TableRow key={`${process.host}:${process.pid}:${process.name}`}>
								<TableCell className="font-medium">
									{process.name ?? m.instance_health_process_unnamed()}
								</TableCell>
								<TableCell className="font-mono text-xs">
									{process.host} · {process.pid}
								</TableCell>
								<TableCell>
									{process.live ? (
										<Badge variant="success">
											{m.instance_health_process_live()}
										</Badge>
									) : (
										<Badge variant="danger">
											{m.instance_health_process_quiet()}
										</Badge>
									)}
								</TableCell>
								<TableCell>
									{formatDisplayTimestamp(process.startedOn)}
								</TableCell>
								<TableCell>
									{formatDisplayTimestamp(process.heartbeatOn)}
								</TableCell>
								<TableCell>
									{process.lastWorkerErrorOn
										? formatDisplayTimestamp(process.lastWorkerErrorOn)
										: m.instance_health_none()}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		)}
	</HealthCard>
);

export const QueuesCard = ({
	queues,
}: {
	queues: readonly InstanceQueue[];
}) => {
	const deadLetters = new Set(queues.map((queue) => queue.deadLetter));
	return (
		<HealthCard
			title={m.instance_health_queues_title()}
			description={m.instance_health_queues_description()}
		>
			{queues.length === 0 ? (
				<Empty>{m.instance_health_queues_empty()}</Empty>
			) : (
				<div className="overflow-auto rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{m.instance_health_queue_name_header()}</TableHead>
								<TableHead className="text-right">
									{m.instance_health_queue_queued_header()}
								</TableHead>
								<TableHead className="text-right">
									{m.instance_health_queue_active_header()}
								</TableHead>
								<TableHead className="text-right">
									{m.instance_health_queue_failed_header()}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{queues.map((queue) => (
								<TableRow key={queue.name}>
									<TableCell className="font-mono text-xs">
										<span className="flex items-center gap-2">
											{queue.name}
											{deadLetters.has(queue.name) && (
												<Badge variant="outline">
													{m.instance_health_queue_dead_letter_badge()}
												</Badge>
											)}
										</span>
									</TableCell>
									<TableCell className="text-right">
										{formatCount(queue.queued)}
									</TableCell>
									<TableCell className="text-right">
										{formatCount(queue.active)}
									</TableCell>
									<TableCell className="text-right">
										{formatCount(queue.failed)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</HealthCard>
	);
};

const KeyValueTable = ({
	rows,
}: {
	rows: readonly {
		key: string;
		label: ReactNode;
		value: ReactNode;
	}[];
}) => (
	<div className="overflow-auto rounded-md border">
		<Table>
			<TableBody>
				{rows.map((row) => (
					<TableRow key={row.key}>
						<TableHead scope="row" className="w-1/3 font-mono text-xs">
							{row.label}
						</TableHead>
						<TableCell className="whitespace-normal break-all">
							{row.value}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	</div>
);

const unknown = () => m.instance_health_unknown_value();

export const VersionsCard = ({ versions }: { versions: InstanceVersions }) => (
	<HealthCard
		title={m.instance_health_versions_title()}
		description={m.instance_health_versions_description()}
	>
		<KeyValueTable
			rows={[
				{
					key: "app",
					label: m.instance_health_version_app_label(),
					value: versions.app,
				},
				{
					key: "postgres",
					label: m.instance_health_check_postgres_title(),
					value: versions.postgres ?? unknown(),
				},
				{
					key: "qdrant",
					label: m.instance_health_check_qdrant_title(),
					value: versions.qdrant ?? unknown(),
				},
				{
					key: "valkey",
					label: m.instance_health_check_valkey_title(),
					value: versions.valkey ?? unknown(),
				},
				{
					key: "migration",
					label: m.instance_health_version_migration_label(),
					value: versions.migration ? (
						<span className="flex flex-col">
							<span className="font-mono text-xs">
								{versions.migration.name}
							</span>
							{versions.migration.appliedAt && (
								<span className="text-muted-foreground text-xs">
									{m.instance_health_version_migration_applied({
										date: formatDisplayTimestamp(versions.migration.appliedAt),
									})}
								</span>
							)}
						</span>
					) : (
						unknown()
					),
				},
			]}
		/>
	</HealthCard>
);

const configValue = (entry: ConfigEntry) => {
	switch (entry.kind) {
		case "value":
			return <span className="font-mono text-xs">{entry.value}</span>;
		case "secret":
			return entry.set ? (
				<Badge variant="secondary">
					{m.instance_health_config_secret_set()}
				</Badge>
			) : (
				<Badge variant="outline">{m.instance_health_config_unset()}</Badge>
			);
		case "unset":
			return (
				<Badge variant="outline">{m.instance_health_config_unset()}</Badge>
			);
	}
};

export const ConfigCard = ({ config }: { config: readonly ConfigEntry[] }) => (
	<HealthCard
		title={m.instance_health_config_title()}
		description={m.instance_health_config_description()}
	>
		<KeyValueTable
			rows={config.map((entry) => ({
				key: entry.key,
				label: entry.key,
				value: configValue(entry),
			}))}
		/>
	</HealthCard>
);
