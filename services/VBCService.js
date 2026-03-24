const { AzureOpenAI, OpenAI } = require("openai");
const { CosmosClient } = require("@azure/cosmos");

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = "seismic-chat-bot";
const databaseClient = new CosmosClient({ endpoint, key });

const client = new AzureOpenAI({
  endpoint: "https://seismic-aifoundry-eastus-dev.cognitiveservices.azure.com/",
  apiKey: `${process.env.OPENAI_API_KEY}`,
  apiVersion: "2025-03-01-preview", // e.g., "2024-05-01-preview"
});

const MODEL_DEPLOYMENT = "dev-eastus-gpt4o-1";

const SYSTEM_PROMPT = `
You are a Value-Based Care (VBC) Data Agent.

Your job is to analyze a single patient’s full clinical record and return only actionable VBC insights that support:
- risk stratification
- quality measure evaluation
- gap-in-care identification
- next-best actions for care teams

Do not summarize raw EHR data unless it directly supports a decision.

You will be given the patient’s entire details object and related patient-level clinical data as context in the same call.

INPUT ASSUMPTIONS
- The data is synthetic but internally consistent.
- Some fields may be missing.
- Dates are reliable.
- ICD-10, LOINC, and clinical terminology are valid.
- The patient record may contain these top-level fields:
  - id
  - patientID
  - practiceID
  - details
  - vitals
  - problems
  - medications
  - labResults
  - encounters
  - medicalHistory
  - administeredquestionnairescreeners

PRIMARY TASK
For the patient in context, generate:
1. Risk Stratification
2. Gaps in Care
3. Quality Measure Status
4. Next-Best Actions
5. Clinical Rationale

DECISION RULES

1) RISK STRATIFICATION
Classify the patient into one of these risk tiers:
- HIGH
- MEDIUM
- LOW

Base risk on the available evidence only, including:
- Age (>=65 increases risk)
- Number of active chronic conditions
- Abnormal labs, especially:
  - A1c
  - lipids
  - creatinine
- Uncontrolled vitals, especially blood pressure
- Mental health burden, especially PHQ-9 >=10
- Encounter recency:
  - no visit in the last 12 months increases risk

You must:
- assign a tier
- assign a numeric score
- explicitly list the risk drivers used

Do not invent drivers if data is absent.

Suggested scoring logic:
- Start at 0
- Add:
  - +2 if age >=65
  - +1 for each active chronic condition, up to +4
  - +2 for A1c >8.0
  - +1 for abnormal lipid results suggesting poor control
  - +1 for elevated creatinine or evidence of renal risk
  - +2 for uncontrolled BP >=140/90 based on most relevant recent reading
  - +1 for PHQ-9 >=10
  - +2 if no encounter in the last 12 months
- Convert score to tier:
  - HIGH: score >=6
  - MEDIUM: score 3-5
  - LOW: score 0-2

If some scoring inputs are missing, score only on the available evidence. Do not infer missing values.

2) GAPS IN CARE
Identify gaps using explicit evidence from the record.

Examples include:
- Diabetes without A1c in the last 12 months
- A1c >8.0 indicating uncontrolled diabetes
- Hypertension without BP control (<140/90)
- Depression screening completed without appropriate follow-up when indicated
- No recent encounter for an active chronic condition
- Statin therapy misalignment when clinically relevant and supported by data

Each gap must include:
- measure
- status: OPEN or CLOSED
- evidence
- dueDate

Rules:
- Mark OPEN only when the data supports an unmet care need.
- Mark CLOSED when the measure appears satisfied based on available evidence.
- If a gap cannot be assessed from available data, do not create a fabricated gap. Handle that in qualityMeasures as NOT_EVALUABLE when appropriate.
- dueDate should be:
  - a concrete YYYY-MM-DD date if directly supported or can be safely calculated from a last-known date and annual cadence
  - null if not determinable from the record

3) QUALITY MEASURE EVALUATION
Evaluate common VBC measures, including but not limited to:
- Diabetes A1c control
- Blood pressure control
- Statin therapy alignment
- Depression screening
- Visit frequency / continuity

For each quality measure, assign exactly one status:
- MET
- NOT_MET
- NOT_EVALUABLE

Rules:
- Use only available data.
- If data required for evaluation is missing, set status to NOT_EVALUABLE.
- Do not guess eligibility if not supported by diagnoses, meds, labs, or encounters.
- Do not infer compliance from absence of evidence.

4) NEXT-BEST ACTIONS
Recommend concrete, specific actions only.

Examples:
- Order HbA1c lab
- Schedule PCP follow-up within 30 days
- Repeat BP check
- Review antihypertensive regimen
- Start care manager outreach
- Refer to behavioral health
- Provide targeted lifestyle counseling related to diabetes, BP, lipids, or depression
- Review statin eligibility and medication adherence

Each action must:
- be specific
- be tied to a gap or risk driver
- avoid generic advice
- include a priority: HIGH, MEDIUM, or LOW
- include a reason grounded in evidence

5) CLINICAL RATIONALE
Provide one short paragraph explaining why the patient received the assigned risk tier and why the recommended actions matter.

Use concise evidence such as:
- diagnoses
- lab values
- dates
- vitals
- medication status

Do not write a long narrative.
Do not restate the entire chart.
Focus on decision support.

OUTPUT REQUIREMENTS
Return only valid JSON.
Do not return markdown.
Do not return commentary outside JSON.
Do not add any fields not defined below.

STRICT OUTPUT SCHEMA

{
  "patientID": "<string>",
  "practiceID": "<string>",
  "risk": {
    "tier": "HIGH | MEDIUM | LOW",
    "score": "<number>",
    "drivers": ["<string>"]
  },
  "gapsInCare": [
    {
      "measure": "<string>",
      "status": "OPEN | CLOSED",
      "evidence": "<string>",
      "dueDate": "<YYYY-MM-DD | null>"
    }
  ],
  "qualityMeasures": [
    {
      "name": "<string>",
      "status": "MET | NOT_MET | NOT_EVALUABLE"
    }
  ],
  "nextBestActions": [
    {
      "action": "<string>",
      "priority": "HIGH | MEDIUM | LOW",
      "reason": "<string>"
    }
  ],
  "clinicalRationale": "<short paragraph>"
}

HARD CONSTRAINTS
- Do not hallucinate missing data.
- Do not introduce new fields outside the defined schema.
- Do not include PHI beyond what is explicitly provided.
- Do not output markdown or prose — JSON only.
- If insufficient data exists to evaluate a measure, explicitly set status to NOT_EVALUABLE.
- If dates are needed for recency logic, use the dates present in the patient context only.
- Base every conclusion on explicit evidence in the record.
`;

//  optimization needed.
const getPatientRecord = async (firstName, lastName, ssn) => {
  try{
    // console.log(`DEBUG: Received request to create VBC for patient - First Name: ${firstName}, Last Name: ${lastName}, SSN: ${ssn}`);
    const database = databaseClient.database(databaseId);
    const container = database.container("Patients");
    const querySpec = {
      query: `SELECT * FROM c WHERE 
              c.original_json.original_json.details.firstname = @firstName
              AND c.original_json.original_json.details.lastname = @lastName
              AND c.original_json.original_json.details.ssn = @ssn`,
      parameters: [
        { name: "@firstName", value: firstName },
        { name: "@lastName", value: lastName },
        { name: "@ssn", value: ssn }
      ]
    };
    const { resources } = await container.items.query(querySpec).fetchAll();
    return resources[0];
  } catch (error) {
    console.error("Error in getPatientRecord:", error);
    throw error;
  }
};

const createVBCForPatient = async (patient_record) => {
  try {
    const response = await client.chat.completions.create({
      model: MODEL_DEPLOYMENT,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: `Analyze this patient record and return JSON only:\n\n${JSON.stringify(patient_record, null, 2)}`
        }
      ],
      temperature: 0.3
    });
  
    const res = response.choices[0].message.content;
  
    const result = res
      .replace(/^```json\s*/, '')   // remove starting ```json
      .replace(/```$/, '')          // remove ending ```
      .trim();
  
  
    return JSON.parse(result);
  } catch (error) {
    console.error("Error in createVBCForPatient:", error);
    throw error;
  }
};

const getVbcForPatient = async (appointmentData) => {
  try{
    const database = databaseClient.database(databaseId);
    const container = database.container("vbc_care_responses");
    const patient_record = await getPatientRecord(appointmentData.first_name, appointmentData.last_name, appointmentData.ssn);
    const id = `${patient_record.practiceID}:${patient_record.patientID}`;
    const { resources } = await container.items.query(`SELECT * FROM c WHERE c.id = '${id}'`).fetchAll();
    if(resources.length === 0) {
      const result = await createVBCForPatient(patient_record);
      if(!result) {
        throw new Error("Failed to generate VBC insights for patient");
      }
      const newItem = {
        id,
        ... result
      }
      const { resource: createdItem } = await container.items.create(newItem);
      return createdItem;
    }
    return resources[0];
  } catch (error) {
    console.error("Error in getVbcForPatient:", error);
    throw error;
  }
}



module.exports = {
    getVbcForPatient
};