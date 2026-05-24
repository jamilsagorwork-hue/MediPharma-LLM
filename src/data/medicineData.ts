export interface PillShapeOption {
  id: string;
  name: string;
  className: string; // for rendering a visual CSS representation of the shape
}

export interface PillColorOption {
  id: string;
  name: string;
  hex: string;
  textClass: string;
}

export interface DosingMedication {
  id: string;
  name: string;
  genericName: string;
  category: string;
  standardStrengths: string[];
  pediatricDosePerKg: number; // mg per kg per day
  adultStandardDose: string; // standard dose text
  scheduleFrequency: string; // e.g., "q8h", "qd", "bid"
  maxDailyDose: string;
  clinicalPearls: string[];
  warningNote: string;
}

export const PILL_SHAPES: PillShapeOption[] = [
  { id: "round", name: "Round", className: "w-7 h-7 rounded-full border-2" },
  { id: "oblong", name: "Oblong / Oval", className: "w-9 h-6 rounded-3xl border-2" },
  { id: "capsule", name: "Capsule", className: "w-10 h-5 rounded-full border-2 border-dashed" },
  { id: "triangle", name: "Triangle", className: "w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-b-[24px]" },
];

export const PILL_COLORS: PillColorOption[] = [
  { id: "white", name: "White", hex: "#f0f0f0", textClass: "text-zinc-400" },
  { id: "yellow", name: "Yellow", hex: "#fbbf24", textClass: "text-yellow-400" },
  { id: "orange", name: "Orange / Peach", hex: "#f97316", textClass: "text-orange-400" },
  { id: "blue", name: "Blue / Teal", hex: "#06b6d4", textClass: "text-cyan-400" },
  { id: "green", name: "Green", hex: "#10b981", textClass: "text-emerald-400" },
  { id: "pink", name: "Pink", hex: "#ec4899", textClass: "text-pink-400" },
  { id: "red", name: "Red", hex: "#ef4444", textClass: "text-red-400" },
];

export const PILL_PRESETS = [
  { shape: "round", color: "orange", imprint: "IG 282", desc: "Round peach/orange tablet with imprint IG 282" },
  { shape: "oblong", color: "yellow", imprint: "L484", desc: "Oblong yellow tablet with imprint L484" },
  { shape: "capsule", color: "white", imprint: "IP 204", desc: "White capsule-shape tablet with imprint IP 204" },
  { shape: "round", color: "blue", imprint: "H 116", desc: "Round blue pill with imprint H 116" },
];

export const CLINICAL_DOSING_DATABASE: DosingMedication[] = [
  {
    id: "amoxicillin",
    name: "Amoxil",
    genericName: "Amoxicillin Trihydrate",
    category: "Antibiotic (Penicillin class)",
    standardStrengths: ["250 mg", "500 mg", "875 mg"],
    pediatricDosePerKg: 45, // 45 mg/kg/day split into doses
    adultStandardDose: "500 mg to 875 mg every 12 hours (or 250 mg to 500 mg every 8 hours)",
    scheduleFrequency: "Every 12 hours (Twice daily)",
    maxDailyDose: "2000 mg",
    clinicalPearls: [
      "In pediatric patients, suspend evenly of oral liquid; shake well before using.",
      "Complete the entire therapeutic course even if physiological symptoms improve earlier.",
      "Can be administered without regard to meals."
    ],
    warningNote: "Contraindicated in individuals with documented severe hypersensitivity to penicillins or cephalosporins."
  },
  {
    id: "ibuprofen",
    name: "Advil / Motrin",
    genericName: "Ibuprofen USP",
    category: "Non-Steroidal Anti-Inflammatory Drug (NSAID)",
    standardStrengths: ["200 mg", "400 mg", "600 mg", "800 mg"],
    pediatricDosePerKg: 30, // 30 mg/kg/day max split
    adultStandardDose: "400 mg to 800 mg every 6 to 8 hours as needed for inflammation or physical pain",
    scheduleFrequency: "Every 6 to 8 hours (with meals)",
    maxDailyDose: "3200 mg (Rx) or 1200 mg (OTC)",
    clinicalPearls: [
      "Always administer alongside food or milk to safeguard the gastrointestinal lining.",
      "Ensure patient maintains clinical hydration to optimize renal filtration.",
      "Monitor for signs of GI bleeding or black, tarry stools."
    ],
    warningNote: "Black Box Warning for increased risk of cardiovascular thrombotic events and severe gastrointestinal ulceration/bleeding."
  },
  {
    id: "acetaminophen",
    name: "Tylenol",
    genericName: "Acetaminophen (APAP)",
    category: "Analgesic / Antipyretic",
    standardStrengths: ["325 mg", "500 mg", "650 mg"],
    pediatricDosePerKg: 15, // 10-15 mg/kg per dose Every 4-6h
    adultStandardDose: "500 mg to 1000 mg every 4 to 6 hours as needed for fever or mild-to-moderate pain",
    scheduleFrequency: "Every 4 to 6 hours",
    maxDailyDose: "4000 mg (Absolute limit to prevent hepatotoxicity)",
    clinicalPearls: [
      "Extremely common component in multi-symptom cold formulations; verify double-dosing.",
      "Crucial liver function oversight needed for chronic clinical ingestion.",
      "Antidote for acute over-dosage is N-acetylcysteine (NAC)."
    ],
    warningNote: "Severe risk of acute liver failure if maximal daily dosing threshold of 4000 mg is bypassed."
  },
  {
    id: "atorvastatin",
    name: "Lipitor",
    genericName: "Atorvastatin Calcium",
    category: "HMG-CoA Reductase Inhibitor (Statins)",
    standardStrengths: ["10 mg", "20 mg", "40 mg", "80 mg"],
    pediatricDosePerKg: 0, // Not typical for weight-based general pediatric use
    adultStandardDose: "10 mg to 80 mg administered once daily at any time of day",
    scheduleFrequency: "Once daily (Bedtime preferred)",
    maxDailyDose: "80 mg",
    clinicalPearls: [
      "Instruct patients to immediately report unexplained muscle tenderness or muscular pain.",
      "Liver enzyme panel evaluations are recommended prior to initiating statin therapy.",
      "Should be avoided alongside large intake of fresh grapefruit juice (potentiates blood concentrations)."
    ],
    warningNote: "Risk of myopathy and rhabdomyolysis. Strictly contraindicated under active pregnancy or liver insufficiency."
  },
  {
    id: "metformin",
    name: "Glucophage",
    genericName: "Metformin Hydrochloride",
    category: "Biguanide Antidiabetic Agen",
    standardStrengths: ["500 mg", "850 mg", "1000 mg"],
    pediatricDosePerKg: 0,
    adultStandardDose: "500 mg twice daily or 850 mg once daily with morning/evening meals, increased incrementally",
    scheduleFrequency: "Twice daily with meals",
    maxDailyDose: "2550 mg (adults)",
    clinicalPearls: [
      "Take with meals to alleviate initial gastrointestinal distress (bloating, diarrhea).",
      "Requires temporary discontinuation (48 hours) before and after iodinated contrast imaging.",
      "Enhances insulin sensitivity without triggering acute hypoglycemia when used as monotherapy."
    ],
    warningNote: "Risk of lactic acidosis, especially in patients with moderate-to-severe renal impairment or chronic liver disease."
  }
];
