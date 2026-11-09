import type { Source } from "./metrics";

/** A question in our own words and where its answer is. */
export interface Question {
	/** `<language>/<document>/<topic>`. */
	id: string;
	language: "de" | "en";
	question: string;
	/** Any of them answers it, such as the same passage in a translation. */
	sources: Source[];
}

type Entry = [
	question: string,
	source: Omit<Source, "document">,
	...also: Source[],
];

const questionsOf = (
	language: Question["language"],
	document: string,
	entries: Record<string, Entry>,
): Question[] =>
	Object.entries(entries).map(([topic, [question, source, ...also]]) => ({
		id: `${language}/${document}/${topic}`,
		language,
		question,
		sources: [
			{
				document,
				...source,
			},
			...also,
		],
	}));

export const QUESTIONS: Question[] = [
	...questionsOf("de", "stadtwerke-bericht", {
		umsatz: [
			"Wie hoch war der Umsatz der Stadtwerke Kleinmoorbach 2025?",
			{
				page: 1,
				evidence: "61,8 Millionen Euro",
			},
		],
		beschaeftigte: [
			"Wie viele Menschen arbeiten bei den Stadtwerken?",
			{
				page: 1,
				evidence: "412 Personen",
			},
		],
		wasserhaerte: [
			"Welchen Härtegrad hat das Leitungswasser in Kleinmoorbach?",
			{
				page: 1,
				evidence: "11,2 Grad deutscher Härte",
			},
		],
		rohrbrueche: [
			"Warum gab es 2025 weniger Rohrbrüche als im Vorjahr?",
			{
				page: 1,
				evidence: "Graugussleitungen in der Bahnhofstraße",
			},
		],
		wasserpreis: [
			"Was kostet ein Kubikmeter Trinkwasser ab 2026 brutto?",
			{
				page: 2,
				evidence: [
					"Trinkwasser, Arbeitspreis",
					"2,29",
				],
			},
		],
		wiederinbetriebnahme: [
			"Welche Gebühr fällt an, wenn nach einer Sperre die Versorgung wieder eingeschaltet wird?",
			{
				page: 2,
				evidence: [
					"Wiederinbetriebnahme nach Unterbrechung",
					"78,00",
				],
			},
		],
		standrohr: [
			"Wie hoch ist die Kaution für ein Standrohr?",
			{
				page: 2,
				evidence: [
					"Kaution für ein Standrohr",
					"400,00",
				],
			},
		],
		ladestrom: [
			"Was kostet Schnellladen an den Ladesäulen der Stadtwerke pro Kilowattstunde?",
			{
				page: 2,
				evidence: [
					"Ladestrom an öffentlichen Säulen, DC",
					"59,00",
				],
			},
		],
		besuche: [
			"Wie viele Besuche hatte das Hallenbad im Jahr 2023?",
			{
				page: 3,
				figure: true,
			},
		],
		schliessung: [
			"Wann war das Hallenbad wegen Bauarbeiten geschlossen?",
			{
				page: 3,
				evidence: "vom 3. März bis zum 30. Mai 2025",
			},
		],
		photovoltaik: [
			"Wie groß wird die Solaranlage auf dem Hallenbad?",
			{
				page: 4,
				evidence: "410 Kilowatt",
			},
		],
		stoerung: [
			"Unter welcher Nummer melde ich nachts einen Stromausfall?",
			{
				page: 4,
				evidence: "05555 4040",
			},
		],
	}),
	...questionsOf("de", "winterdienst-scan", {
		raeumzeiten: [
			"Ab wann muss ich am Sonntag den Gehweg vor meinem Haus räumen?",
			{
				page: 2,
				evidence: "Sonn- und Feiertagen von 9 bis 20 Uhr",
			},
		],
		breite: [
			"Wie breit muss der geräumte Streifen auf dem Gehweg sein?",
			{
				page: 2,
				evidence: "1,20 Meter",
			},
		],
		streusalz: [
			"Darf ich vor meinem Haus Streusalz verwenden?",
			{
				page: 2,
				evidence: "Streusalz darf nur an Treppen",
			},
		],
		bussgeld: [
			"Welches Bußgeld droht, wenn ich nicht Schnee schippe?",
			{
				page: 2,
				evidence: "bis zu 1.000 Euro",
			},
		],
		laub: [
			"Bis wann muss das Laub vom Gehweg entfernt sein?",
			{
				page: 1,
				evidence: "15. Dezember",
			},
		],
	}),
	...questionsOf("en", "river-watch-deck", {
		rain: [
			"How long should volunteers wait after heavy rain before sampling?",
			{
				page: 2,
				evidence: "48 hours",
			},
		],
		bank: [
			"Which river banks are too steep to sample from?",
			{
				page: 2,
				evidence: "steeper than 30 degrees",
			},
		],
		kit: [
			"What size is the bottle for bacteria samples?",
			{
				page: 3,
				evidence: "500 ml sterile bottle",
			},
		],
		rinse: [
			"Should I rinse the bottle before taking a bacteria sample?",
			{
				page: 4,
				evidence: "except for bacteria samples",
			},
		],
		lab: [
			"How quickly must bacteria samples reach the lab?",
			{
				page: 4,
				evidence: "within 6 hours",
			},
		],
		nitrate: [
			"Which site had the highest nitrate reading last season?",
			{
				page: 5,
				figure: true,
			},
		],
		deadline: [
			"When are the monthly data sheets due?",
			{
				page: 6,
				evidence: "by the 5th of the following month",
			},
		],
		hotline: [
			"What number do I call if I see dead fish in the river?",
			{
				page: 6,
				evidence: "0800 555 0142",
			},
		],
	}),
	...questionsOf("de", "wohngeld-verordnung", {
		inkrafttreten: [
			"Ab wann gilt die Fortschreibung des Wohngeldes?",
			{
				page: 4,
				evidence: "tritt am 1. Januar 2025 in Kraft",
			},
		],
		paragraph19: [
			"Welcher Betrag in § 19 Absatz 3 des Wohngeldgesetzes ändert sich und auf wie viel?",
			{
				page: 1,
				evidence: [
					"57 Euro",
					"65 Euro",
				],
			},
		],
		hoechstbetrag: [
			"Wie hoch ist der Höchstbetrag der Miete für eine Person in Mietenstufe I?",
			{
				page: 1,
				evidence: [
					"Höchstbetrag in Euro",
					"I 361",
				],
			},
		],
		mehrbetrag: [
			"Um wie viel erhöht sich der Höchstbetrag für jedes weitere Haushaltsmitglied?",
			{
				page: 2,
				evidence: [
					"Mehrbetrag für jedes weitere",
					"VII 163",
				],
			},
		],
		rundung: [
			"Wie wird das monatliche Wohngeld gerundet?",
			{
				page: 3,
				evidence: "auf den nächsten vollen Euro-Betrag aufzurunden",
			},
		],
		nachkommastellen: [
			"Mit wie vielen Nachkommastellen werden die Zwischenwerte der Wohngeldformel gerechnet?",
			{
				page: 3,
				evidence: "zehn Nachkommastellen",
			},
		],
		unterzeichnet: [
			"Welche Ministerin hat die Wohngeldverordnung unterzeichnet?",
			{
				page: 4,
				evidence: "Klara Geywitz",
			},
		],
	}),
	...questionsOf("de", "rki-gesundheitskompetenz", {
		stichprobe: [
			"Wie viele Schülerinnen und Schüler wurden 2022 in der HBSC-Studie befragt?",
			{
				page: [
					1,
					2,
					4,
				],
				evidence: "6.475",
			},
			{
				document: "rki-health-literacy",
				page: [
					1,
					2,
				],
				evidence: "6,475",
			},
		],
		geringe: [
			"Wie hoch war 2022 der Anteil der Jugendlichen mit geringer Gesundheitskompetenz?",
			{
				page: [
					1,
					6,
				],
				evidence: "24,4 %",
			},
			{
				document: "rki-health-literacy",
				page: 6,
				evidence: "(24.4 %)",
			},
		],
		divers: [
			"Welche Geschlechtergruppe hat am häufigsten eine geringe Gesundheitskompetenz?",
			{
				page: 7,
				evidence: "am häufigsten eine geringe GK",
			},
			{
				document: "rki-health-literacy",
				page: 6,
				evidence: "most likely to be assigned low HL",
			},
		],
		reliabilitaet: [
			"Wie zuverlässig ist die Skala zur Gesundheitskompetenz?",
			{
				page: 4,
				evidence: "0,887",
			},
			{
				document: "rki-health-literacy",
				page: 4,
				evidence: "0.887",
			},
		],
		erhebung: [
			"In welchem Zeitraum wurden die Daten 2022 erhoben?",
			{
				page: 2,
				evidence: "Datenerhebungszeitraum: März",
			},
			{
				document: "rki-health-literacy",
				page: 2,
				evidence: "Data collection period: March",
			},
		],
		beschwerden: [
			"Wie viele Schülerinnen und Schüler haben mindestens zwei Beschwerden pro Woche?",
			{
				page: 9,
				evidence: "40,8 %",
			},
			{
				document: "rki-health-literacy",
				page: 8,
				evidence: "40.8 %",
			},
		],
		software: [
			"Mit welcher Statistiksoftware wurde ausgewertet?",
			{
				page: 5,
				evidence: "IBM SPSS Statistics",
			},
			{
				document: "rki-health-literacy",
				page: 5,
				evidence: "IBM SPSS Statistics",
			},
		],
		ethik: [
			"Welche Ethikkommission hat die Studie geprüft?",
			{
				page: 16,
				evidence: "Ethikkommission der Ärztekammer Hamburg",
			},
			{
				document: "rki-health-literacy",
				page: 14,
				evidence: "Medical Association of Hamburg",
			},
		],
		pandemie: [
			"Warum könnte die Gesundheitskompetenz während der Pandemie gesunken sein?",
			{
				page: 12,
				evidence: "COVID-19-Pandemie bedingten Infodemie",
			},
			{
				document: "rki-health-literacy",
				page: 11,
				evidence: "infodemic caused by the COVID-19 pandemic",
			},
		],
		risiko: [
			"Um welchen Faktor ist das Risiko hoher psychosomatischer Beschwerden bei gender-diversen Jugendlichen erhöht?",
			{
				page: [
					9,
					10,
				],
				evidence: [
					"gender-divers",
					"9,80",
				],
			},
			{
				document: "rki-health-literacy",
				page: 9,
				evidence: [
					"Gender diverse",
					"9.80",
				],
			},
		],
	}),
	...questionsOf("en", "rki-health-literacy", {
		score: [
			"Which score range counts as high health literacy?",
			{
				page: 4,
				evidence: "high (36 – 40)",
			},
			{
				document: "rki-gesundheitskompetenz",
				page: 4,
				evidence: "hohe (36 – 40",
			},
		],
		low: [
			"Did more students have low health literacy in 2022 than in 2017/18?",
			{
				page: 6,
				evidence: "slightly more students have low health literacy",
			},
			{
				document: "rki-gesundheitskompetenz",
				page: 6,
				evidence:
					"etwas mehr Schülerinnen und Schüler eine geringe Gesundheitskompetenz",
			},
		],
		age: [
			"Which age group is most likely to have low health literacy?",
			{
				page: 6,
				evidence: "11-year-olds are the most likely to have low HL",
			},
		],
		migration: [
			"Do students with a migration history differ in health literacy once other factors are controlled for?",
			{
				page: 12,
				evidence:
					"the results of the multivariate analysis show no differences in HL",
			},
		],
		complaints: [
			"How often do students with low health literacy report a high psychosomatic burden compared with those with high health literacy?",
			{
				page: 8,
				evidence: "students with low HL (51.6 %)",
			},
		],
		symptoms: [
			"Which complaints does the HBSC symptom checklist ask about?",
			{
				page: 4,
				evidence: "headaches, stomach ache, backache",
			},
		],
		affluence: [
			"How is family affluence divided into groups?",
			{
				page: 5,
				evidence: "low (< 20 %), medium (20 – 80 %), and high (> 80 %)",
			},
		],
		consent: [
			"Did parents have to consent for their children to take part?",
			{
				page: 14,
				evidence: "Written consent (informed and active consent) was required",
			},
		],
		limitation: [
			"Why can the study not show trends in health literacy yet?",
			{
				page: 10,
				evidence: "only two survey dates are currently available",
			},
		],
		settings: [
			"Where should health literacy be promoted according to the authors?",
			{
				page: 13,
				evidence:
					"day-care centres, children’s and youth centres, sports clubs, schools",
			},
		],
		cycles: [
			"How many students took part across all four HBSC survey cycles?",
			{
				page: 2,
				evidence: "21,788 students",
			},
		],
	}),
	...questionsOf("en", "census-household-income", {
		national: [
			"What was the median household income in the United States in 2024?",
			{
				page: 2,
				evidence: [
					"median household income",
					"81,604",
				],
			},
			{
				document: "census-household-income",
				page: 10,
				evidence: [
					"All households",
					"81,604",
				],
			},
		],
		states: [
			"Which states had the highest median household income?",
			{
				page: 2,
				evidence: "Massachusetts, New Jersey, and Maryland had the highest",
			},
		],
		puerto: [
			"What was the median household income in Puerto Rico?",
			{
				page: 2,
				evidence: "27,213",
			},
		],
		metro: [
			"Which metro area had the highest median household income in 2024?",
			{
				page: 3,
				evidence: "San Francisco metro area had the highest",
			},
		],
		lowestMetro: [
			"Which large metro areas had the lowest household incomes?",
			{
				page: 3,
				evidence: "Detroit ($76,403)",
			},
		],
		asian: [
			"What was the median income of Asian households?",
			{
				page: [
					4,
					10,
				],
				evidence: [
					"Asian",
					"117,289",
				],
			},
		],
		young: [
			"How much did households headed by someone under 25 earn?",
			{
				page: 5,
				evidence: [
					"under the age of 25",
					"46,651",
				],
			},
			{
				document: "census-household-income",
				page: 10,
				evidence: [
					"Under 25 years",
					"46,651",
				],
			},
		],
		gini: [
			"Did income inequality in the US rise or fall between 2023 and 2024?",
			{
				page: 5,
				evidence: [
					"Gini index for the United States in 2024 (0.481)",
				],
			},
		],
		utah: [
			"Which state had the most equal income distribution?",
			{
				page: 6,
				evidence: "Utah had the lowest Gini index",
			},
		],
		poverty: [
			"Which survey is the official source for national poverty estimates?",
			{
				page: 7,
				evidence: "official source of national poverty estimates",
			},
		],
	}),
	...questionsOf("en", "naca-scan", {
		authors: [
			"Who wrote the NACA research memorandum on amines and amides as internal coolants?",
			{
				page: [
					1,
					2,
				],
				evidence: "Harry S. Imming",
			},
		],
		ratio: [
			"At what coolant-fuel ratio were the additive solutions run?",
			{
				page: [
					2,
					5,
				],
				evidence: "coolant-fuel ratio of 0.50",
			},
		],
		copper: [
			"Why is ethylenediamine a problem as an internal coolant?",
			{
				page: 3,
				evidence: "corrosive in contact with copper",
			},
		],
		ice: [
			"How was the 2,6-dimethylpyridine solution kept at the right concentration?",
			{
				page: 5,
				evidence: "ice bath",
			},
		],
		best: [
			"Which internal-coolant additives were the most effective overall?",
			{
				page: 7,
				evidence: "than any of the other 24 compounds",
			},
		],
		worse: [
			"Which additives were less effective than water at every fuel-air ratio?",
			{
				page: [
					7,
					8,
				],
				evidence:
					"less effective than water as internal coolants for all values of fuel-air ratio",
			},
		],
		speed: [
			"What engine speed was used in the knock tests?",
			{
				page: [
					9,
					11,
					12,
					13,
					14,
				],
				evidence: "engine speed, 2500 rpm",
			},
		],
		chart: [
			"What does the bar graph of relative knock-limited power compare?",
			{
				page: 15,
				figure: true,
			},
		],
	}),
];
