import { zip } from "@orcai/testing/documents";
import { type Browser, chromium } from "playwright-core";
import type { EvalDocument } from "./corpus";

/*
 * Documents built from text written for the eval, each for a case real
 * documents rarely cover cleanly: a logo on every page, a table longer than a
 * chunk, a figure whose numbers are only in the image, a scanned notice and a
 * slide deck. Chromium renders them, so they need the e2e suite's browser.
 */

const escapeXml = (text: string) =>
	text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

const screenshot = async (
	browser: Browser,
	html: string,
	size: {
		width: number;
		height: number;
	},
	type: "png" | "jpeg" = "png",
) => {
	const page = await browser.newPage({
		viewport: size,
	});
	try {
		await page.setContent(
			`<html><body style="margin:0;background:#fff">${html}</body></html>`,
		);
		return new Uint8Array(
			await page.screenshot({
				type,
				...(type === "jpeg"
					? {
							quality: 55,
						}
					: {}),
			}),
		);
	} finally {
		await page.close();
	}
};

const pdf = async (browser: Browser, html: string) => {
	const page = await browser.newPage();
	try {
		await page.setContent(`<!doctype html><html>${html}</html>`);
		return new Uint8Array(
			await page.pdf({
				format: "A4",
				printBackground: true,
			}),
		);
	} finally {
		await page.close();
	}
};

const dataUrl = (type: string, data: Uint8Array) =>
	`data:${type};base64,${Buffer.from(data).toString("base64")}`;

const barChart = (params: {
	title: string;
	unit: string;
	bars: [
		string,
		string,
		number,
	][];
}) => {
	const max = Math.max(...params.bars.map(([, , value]) => value));
	const width = 1000;
	const slot = (width - 120) / params.bars.length;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="600" font-family="Arial">
<text x="500" y="44" font-size="30" text-anchor="middle">${escapeXml(params.title)}</text>
<text x="24" y="320" font-size="20" transform="rotate(-90 24 320)" text-anchor="middle">${escapeXml(params.unit)}</text>
<line x1="90" y1="520" x2="${width - 20}" y2="520" stroke="#333" stroke-width="2"/>
${params.bars
	.map(([label, shown, value], index) => {
		const height = (value / max) * 400;
		const x = 110 + index * slot;
		return `<rect x="${x}" y="${520 - height}" width="${slot - 40}" height="${height}" fill="#3a6ea5"/>
<text x="${x + (slot - 40) / 2}" y="${508 - height}" font-size="22" text-anchor="middle">${escapeXml(shown)}</text>
<text x="${x + (slot - 40) / 2}" y="556" font-size="22" text-anchor="middle">${escapeXml(label)}</text>`;
	})
	.join("\n")}
</svg>`;
};

const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240" font-family="Georgia">
<rect width="480" height="240" fill="#fff"/>
<circle cx="110" cy="120" r="80" fill="#1f6f8b"/>
<path d="M60 140 Q110 60 160 140 Z" fill="#fff"/>
<text x="210" y="112" font-size="40" fill="#1f6f8b">Stadtwerke</text>
<text x="210" y="160" font-size="34" fill="#444">Kleinmoorbach</text>
</svg>`;

const tariffs: [
	string,
	string,
	string,
	string,
][] = [
	[
		"Trinkwasser, Arbeitspreis",
		"je m³",
		"2,14 €",
		"2,29 €",
	],
	[
		"Trinkwasser, Grundpreis Zähler Q3 = 4",
		"je Monat",
		"9,50 €",
		"10,17 €",
	],
	[
		"Trinkwasser, Grundpreis Zähler Q3 = 10",
		"je Monat",
		"23,80 €",
		"25,47 €",
	],
	[
		"Trinkwasser, Grundpreis Zähler Q3 = 16",
		"je Monat",
		"38,10 €",
		"40,77 €",
	],
	[
		"Schmutzwasser",
		"je m³",
		"2,61 €",
		"2,61 €",
	],
	[
		"Niederschlagswasser",
		"je m² versiegelte Fläche und Jahr",
		"0,58 €",
		"0,58 €",
	],
	[
		"Strom Grundversorgung, Arbeitspreis",
		"je kWh",
		"27,31 ct",
		"32,50 ct",
	],
	[
		"Strom Grundversorgung, Grundpreis",
		"je Monat",
		"11,76 €",
		"13,99 €",
	],
	[
		"Wärmestrom für Wärmepumpen",
		"je kWh",
		"21,85 ct",
		"26,00 ct",
	],
	[
		"Ladestrom an öffentlichen Säulen, AC",
		"je kWh",
		"40,34 ct",
		"48,00 ct",
	],
	[
		"Ladestrom an öffentlichen Säulen, DC",
		"je kWh",
		"49,58 ct",
		"59,00 ct",
	],
	[
		"Hallenbad, Einzelkarte Erwachsene",
		"je Besuch",
		"4,67 €",
		"5,00 €",
	],
	[
		"Hallenbad, Einzelkarte ermäßigt",
		"je Besuch",
		"2,80 €",
		"3,00 €",
	],
	[
		"Hallenbad, Familienkarte",
		"je Besuch",
		"11,21 €",
		"12,00 €",
	],
	[
		"Hallenbad, Zehnerkarte Erwachsene",
		"je Karte",
		"42,06 €",
		"45,00 €",
	],
	[
		"Sauna, Zuschlag zur Einzelkarte",
		"je Besuch",
		"5,61 €",
		"6,00 €",
	],
	[
		"Zählerwechsel auf Kundenwunsch",
		"je Vorgang",
		"63,03 €",
		"75,00 €",
	],
	[
		"Mahnung",
		"je Schreiben",
		"2,50 €",
		"2,50 €",
	],
	[
		"Unterbrechung der Versorgung",
		"je Vorgang",
		"58,82 €",
		"70,00 €",
	],
	[
		"Wiederinbetriebnahme nach Unterbrechung",
		"je Vorgang",
		"65,55 €",
		"78,00 €",
	],
	[
		"Bauwasser über Standrohr",
		"je Tag Miete",
		"3,36 €",
		"4,00 €",
	],
	[
		"Kaution für ein Standrohr",
		"einmalig",
		"400,00 €",
		"400,00 €",
	],
];

const report = async (browser: Browser) => {
	const logoPng = await screenshot(browser, logo, {
		width: 480,
		height: 240,
	});
	const chart = await screenshot(
		browser,
		barChart({
			title: "Besuche im Hallenbad",
			unit: "Besuche pro Jahr",
			bars: [
				[
					"2021",
					"61.300",
					61300,
				],
				[
					"2022",
					"88.900",
					88900,
				],
				[
					"2023",
					"97.450",
					97450,
				],
				[
					"2024",
					"102.800",
					102800,
				],
				[
					"2025",
					"94.100",
					94100,
				],
			],
		}),
		{
			width: 1000,
			height: 600,
		},
	);
	const header = `<img src="${dataUrl("image/png", logoPng)}" style="width:48mm;height:24mm">`;
	const page = (body: string) =>
		`<section style="page-break-after:always">${header}${body}</section>`;
	return pdf(
		browser,
		`<head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.45;margin:0 8mm}
h1{font-size:20pt}h2{font-size:14pt;margin-top:8mm}
table{border-collapse:collapse;width:100%;font-size:10pt}
td,th{border:1px solid #888;padding:3px 6px;text-align:left}
figcaption{font-style:italic;font-size:10pt}
</style></head><body>
${page(`<h1>Geschäftsbericht 2025 der Stadtwerke Kleinmoorbach</h1>
<h2>1 Überblick</h2>
<p>Die Stadtwerke Kleinmoorbach versorgen die rund 23.400 Einwohnerinnen und Einwohner der Stadt mit Trinkwasser und Strom, entsorgen das Abwasser und betreiben das Hallenbad am Kirchberg. Ende 2025 beschäftigte das Unternehmen 412 Personen, darunter 19 Auszubildende.</p>
<p>Die Umsatzerlöse stiegen 2025 auf 61,8 Millionen Euro, nach 58,2 Millionen Euro im Vorjahr. Den größten Anteil hatte der Stromvertrieb mit 34,1 Millionen Euro. Der Jahresüberschuss von 2,3 Millionen Euro wird vollständig in die Rücklagen eingestellt, um die Erneuerung des Leitungsnetzes zu finanzieren.</p>
<h2>2 Wasserversorgung</h2>
<p>Das Trinkwasser stammt aus drei Tiefbrunnen: Brunnen Ost, Brunnen Mühlweg und Brunnen Am Sand. Zusammen förderten sie 2025 eine Wassermenge von 1,94 Millionen Kubikmetern. Das Wasser liegt mit 11,2 Grad deutscher Härte im Härtebereich mittel, Waschmittel werden daher nach den Angaben für mittleres Wasser dosiert.</p>
<p>Das Rohrnetz ist 187 Kilometer lang. Im Jahr 2025 mussten 31 Rohrbrüche behoben werden, nach 44 im Jahr 2024. Den Rückgang führen die Stadtwerke auf den Austausch der Graugussleitungen in der Bahnhofstraße zurück.</p>`)}
${page(`<h2>3 Preise ab 1. Januar 2026</h2>
<p>Der Aufsichtsrat hat im November 2025 die folgenden Preise beschlossen. Sie gelten für alle Lieferungen und Leistungen ab dem 1. Januar 2026. Bruttopreise enthalten die gesetzliche Umsatzsteuer, Abwassergebühren sind steuerfrei.</p>
<table><thead><tr><th>Leistung</th><th>Einheit</th><th>Netto</th><th>Brutto</th></tr></thead><tbody>
${tariffs.map((row) => `<tr>${row.map((cell) => `<td>${escapeXml(cell)}</td>`).join("")}</tr>`).join("\n")}
</tbody></table>`)}
${page(`<h2>4 Hallenbad</h2>
<p>Das Hallenbad am Kirchberg hat ein Sportbecken mit 25 Metern und ein Lehrschwimmbecken. Wegen der Sanierung des Lehrschwimmbeckens war das Bad vom 3. März bis zum 30. Mai 2025 geschlossen. Schulen und Vereine wichen in dieser Zeit in das Bad der Nachbargemeinde aus.</p>
<figure><img src="${dataUrl("image/png", chart)}" style="width:170mm"><figcaption>Abbildung 1: Besuche im Hallenbad am Kirchberg nach Jahr</figcaption></figure>
<p>Die Saunalandschaft wurde im Herbst 2025 um eine Dampfsauna ergänzt. Frühschwimmen ist dienstags und donnerstags ab 6:30 Uhr möglich.</p>`)}
${page(`<h2>5 Investitionen und Ausblick</h2>
<p>Für 2026 sind Investitionen von 9,7 Millionen Euro geplant. Die größte Einzelmaßnahme ist die Erneuerung der Hauptleitung im Mühlweg für 2,4 Millionen Euro. Auf dem Dach des Hallenbads entsteht eine Photovoltaikanlage mit 410 Kilowatt Spitzenleistung, die im Herbst 2026 in Betrieb gehen soll und etwa ein Drittel des Strombedarfs des Bades decken wird.</p>
<p>Bis Ende 2028 tauschen die Stadtwerke 6.800 Stromzähler gegen intelligente Messsysteme. Kundinnen und Kunden werden vier Wochen vor dem Termin schriftlich benachrichtigt.</p>
<h2>6 Kundenservice</h2>
<p>Das Kundenzentrum am Marktplatz 4 ist montags bis donnerstags von 8 bis 16 Uhr und freitags von 8 bis 12 Uhr geöffnet. Störungen der Wasser- oder Stromversorgung nimmt die Leitwarte rund um die Uhr unter der Rufnummer 05555 4040 entgegen.</p>`)}
</body>`,
	);
};

const scanPage = (paragraphs: string[], tilt: number) => `
<div style="position:relative;width:1240px;height:1754px;filter:grayscale(1) contrast(1.1) blur(0.4px);background:#f4f2ec">
<div style="position:absolute;inset:0;padding:150px 140px;transform:rotate(${tilt}deg);font-family:'Times New Roman',serif;font-size:27px;line-height:1.5;color:#222">
${paragraphs.map((paragraph) => (paragraph.startsWith("§") || paragraph.startsWith("Bekanntmachung") ? `<p style="font-weight:bold;margin-top:34px">${escapeXml(paragraph)}</p>` : `<p>${escapeXml(paragraph)}</p>`)).join("\n")}
</div>
<svg style="position:absolute;inset:0" width="1240" height="1754"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>
</div>`;

const scannedNotice = async (browser: Browser) => {
	const pages = [
		scanPage(
			[
				"Bekanntmachung der Stadt Kleinmoorbach über die Reinigung der Straßen und den Winterdienst",
				"Der Rat der Stadt hat in seiner Sitzung am 18. September 2025 die folgende Satzung beschlossen.",
				"§ 1 Geltungsbereich",
				"Diese Satzung gilt für alle öffentlichen Straßen, Wege und Plätze innerhalb der geschlossenen Ortslage. Für Bundes- und Landesstraßen gilt sie nur für die Gehwege.",
				"§ 2 Reinigungspflicht der Anlieger",
				"Die Eigentümerinnen und Eigentümer der angrenzenden Grundstücke reinigen die Gehwege und die Rinnsteine vor ihrem Grundstück. Die Reinigung ist mindestens einmal wöchentlich, in der Regel am Samstag, durchzuführen. Laub ist bis zum 15. Dezember zu entfernen.",
			],
			0.5,
		),
		scanPage(
			[
				"§ 3 Winterdienst",
				"Gehwege sind werktags von 7 bis 20 Uhr, an Sonn- und Feiertagen von 9 bis 20 Uhr von Schnee freizuhalten und bei Glätte zu bestreuen. Die geräumte Fläche muss mindestens 1,20 Meter breit sein. Nach 20 Uhr gefallener Schnee ist bis 7 Uhr des folgenden Tages zu räumen.",
				"§ 4 Streumittel",
				"Zu verwenden sind abstumpfende Mittel wie Sand oder Splitt. Streusalz darf nur an Treppen, Rampen und starken Gefällen eingesetzt werden. Baumscheiben und Grünstreifen dürfen nicht mit salzhaltigem Schnee belastet werden.",
				"§ 5 Ordnungswidrigkeiten",
				"Ordnungswidrig handelt, wer vorsätzlich oder fahrlässig der Reinigungs- oder Räumpflicht nicht nachkommt. Die Ordnungswidrigkeit kann mit einer Geldbuße bis zu 1.000 Euro geahndet werden.",
				"§ 6 Inkrafttreten",
				"Diese Satzung tritt am 1. November 2025 in Kraft.",
			],
			-0.4,
		),
	];
	const images = await Promise.all(
		pages.map((html) =>
			screenshot(
				browser,
				html,
				{
					width: 1240,
					height: 1754,
				},
				"jpeg",
			),
		),
	);
	return pdf(
		browser,
		`<head><style>@page{margin:0}body{margin:0}img{display:block;width:210mm;height:296mm;page-break-after:always}</style></head><body>${images.map((image) => `<img src="${dataUrl("image/jpeg", image)}">`).join("")}</body>`,
	);
};

const slides: {
	title: string;
	lines: string[];
	chart?: true;
}[] = [
	{
		title: "River Watch volunteer training",
		lines: [
			"Spring session for new water sampling volunteers",
			"Sampling season runs from May to September",
		],
	},
	{
		title: "Safety first",
		lines: [
			"Never sample alone: work in pairs at every site",
			"Wear nitrile gloves and wash hands after sampling",
			"Do not sample within 48 hours after heavy rain",
			"Stay off banks steeper than 30 degrees",
		],
	},
	{
		title: "Your sampling kit",
		lines: [
			"One 500 ml sterile bottle for bacteria samples",
			"Digital thermometer and a 120 cm turbidity tube",
			"Nitrate test strips and a waterproof data sheet",
		],
	},
	{
		title: "Taking a sample",
		lines: [
			"Rinse the bottle three times with river water, except for bacteria samples",
			"Fill the bottle at elbow depth, facing upstream",
			"Record the water temperature within two minutes",
			"Keep bacteria samples at 4 °C and deliver them to the lab within 6 hours",
		],
	},
	{
		title: "Results from last season",
		lines: [
			"Average nitrate per site, May to September 2025",
		],
		chart: true,
	},
	{
		title: "Reporting",
		lines: [
			"Submit data sheets through the volunteer portal by the 5th of the following month",
			"Report a fish kill or an oil sheen at once on the hotline 0800 555 0142",
		],
	},
];

const NS =
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const REL =
	"http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const shape = (
	id: number,
	name: string,
	y: number,
	paragraphs: string[],
	title = false,
) =>
	`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr>${title ? '<p:ph type="title"/>' : ""}</p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="${y}"/><a:ext cx="8229600" cy="900000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/>${paragraphs.map((text) => `<a:p><a:r><a:rPr lang="en-GB"/><a:t>${escapeXml(text)}</a:t></a:r></a:p>`).join("")}</p:txBody></p:sp>`;

const deck = async (browser: Browser) => {
	const chart = await screenshot(
		browser,
		barChart({
			title: "Nitrate by site",
			unit: "mg/L",
			bars: [
				[
					"Mill Creek",
					"2.1",
					2.1,
				],
				[
					"Fox Bridge",
					"4.8",
					4.8,
				],
				[
					"Old Weir",
					"7.3",
					7.3,
				],
				[
					"Lantern Ford",
					"3.0",
					3,
				],
			],
		}),
		{
			width: 1000,
			height: 600,
		},
	);
	const files: Record<string, string | Uint8Array> = {
		"[Content_Types].xml": `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}</Types>`,
		"_rels/.rels": `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
		"ppt/presentation.xml": `${XML}<p:presentation ${NS}><p:sldIdLst>${slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join("")}</p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
		"ppt/_rels/presentation.xml.rels": `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slides.map((_, index) => `<Relationship Id="rId${index + 1}" Type="${REL}/slide" Target="slides/slide${index + 1}.xml"/>`).join("")}</Relationships>`,
		"ppt/media/image1.png": chart,
	};
	for (const [index, slide] of slides.entries()) {
		const picture = slide.chart
			? `<p:pic><p:nvPicPr><p:cNvPr id="4" name="Chart" descr="Bar chart of nitrate by site"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="457200" y="2100000"/><a:ext cx="7315200" cy="4389120"/></a:xfrm><a:prstGeom prst="rect"/></p:spPr></p:pic>`
			: "";
		files[`ppt/slides/slide${index + 1}.xml`] =
			`${XML}<p:sld ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shape(
				2,
				"Title",
				300000,
				[
					slide.title,
				],
				true,
			)}${shape(3, "Body", 1300000, slide.lines)}${picture}</p:spTree></p:cSld></p:sld>`;
		files[`ppt/slides/_rels/slide${index + 1}.xml.rels`] =
			`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slide.chart ? `<Relationship Id="rId2" Type="${REL}/image" Target="../media/image1.png"/>` : ""}</Relationships>`;
	}
	return zip(files);
};

export const generatedDocuments = async (): Promise<EvalDocument[]> => {
	const browser = await chromium.launch();
	try {
		return [
			{
				id: "stadtwerke-bericht",
				title: "Geschäftsbericht 2025 der Stadtwerke Kleinmoorbach",
				language: "de",
				mimeType: "application/pdf",
				data: await report(browser),
			},
			{
				id: "winterdienst-scan",
				title: "Satzung über Straßenreinigung und Winterdienst",
				language: "de",
				mimeType: "application/pdf",
				data: await scannedNotice(browser),
			},
			{
				id: "river-watch-deck",
				title: "River Watch volunteer training",
				language: "en",
				mimeType:
					"application/vnd.openxmlformats-officedocument.presentationml.presentation",
				data: await deck(browser),
			},
		];
	} finally {
		await browser.close();
	}
};
