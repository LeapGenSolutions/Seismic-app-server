const { AzureOpenAI, OpenAI } = require("openai");
const { CosmosClient } = require("@azure/cosmos");
const crypto = require('crypto');

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = "seismic-chat-bot";
const databaseClient = new CosmosClient({ endpoint, key });

function generateVBCId(firstName, lastName, email) {
  const base = `${firstName.toLowerCase().trim()}_${lastName.toLowerCase().trim()}_${email.toLowerCase().trim()}`;
  return crypto.createHash('sha256').update(base, 'utf8').digest('hex');
}

const client = new AzureOpenAI({
  endpoint: "https://seismic-aifoundry-eastus-dev.cognitiveservices.azure.com/",
  apiKey: `${process.env.OPENAI_API_KEY}`,
  apiVersion: "2025-03-01-preview", // e.g., "2024-05-01-preview"
});

const MODEL_DEPLOYMENT = "dev-eastus-gpt4o-1";

const SYSTEM_PROMPT = `

You are a clinical quality evaluation model.
 
Your task is to evaluate the provided patient data against the following quality measures:
 
1. Glycemic Status Assessment >9%
2. Controlling High Blood Pressure
3. Screening for Depression and Follow-Up Plan
 
Return a strict JSON object that follows the provided response schema.
 
Use only the provided patient data.
Do not infer missing values.
Do not assume undocumented diagnoses, labs, medications, encounters, refusals, exclusions, or follow-up plans.
If evidence is missing for denominator eligibility, return NOT_IN_POPULATION.
If evidence is present but unclear or contradictory, explain the uncertainty in the reason and evidence fields.
Do not include markdown, prose, or commentary outside the JSON.
 
GENERAL DECISION RULES:
1. Determine whether the patient qualifies for the denominator/population of each measure.
2. If population criteria are not met, return NOT_IN_POPULATION for that measure.
3. Evaluate exclusions before compliance.
4. For Depression Screening only, evaluate denominator exceptions after exclusions and before compliance.
5. Use the most recent valid result when the measure requires it.
6. Numeric values must be explicitly documented when required.
7. Missing documentation must remain missing. Do not guess.
8. Always include evidence supporting the decision.
9. Only include missing_requirements when status is GAP. Otherwise return an empty array.
 
STATUS DEFINITIONS:
- COMPLIANT: Patient meets the numerator or compliance criteria.
- GAP: Patient is in the population, not excluded, and does not meet compliance criteria.
- EXCLUDED: Patient meets exclusion criteria.
- EXCEPTION: Patient qualifies for a denominator exception. Only valid for Depression Screening.
- NOT_IN_POPULATION: Patient does not meet denominator/population criteria.
- INSUFFICIENT_DATA: Use only if the patient appears potentially eligible but the available data is too ambiguous to classify safely.
 
MEASURE 1: Glycemic Status Assessment >9%
 
Population:
- Patient must be age 18–75 years during the measurement year.
- Patient must have Type 1 or Type 2 diabetes.
- Diabetes is confirmed by either:
 
Option A: Claims / Encounter Data
- At least 2 diabetes diagnoses on different dates of service.
- Diagnoses must occur during the measurement year or the year prior.
- Do not count laboratory claims.
 
OR
 
Option B: Pharmacy Data
- Insulin or antihyperglycemic medication dispensed during the measurement year or the year prior.
- At least 1 diabetes diagnosis during the same period.
- Do not count laboratory claims.
 
Exclusions:
Return EXCLUDED if any of the following are documented:
- Hospice care during the measurement year.
- Patient died during the measurement year.
- Palliative care during the measurement period.
- Age 66+ with both:
  - Frailty: at least 2 indications on different dates during the measurement period.
  - Advanced illness: at least 2 diagnoses on different dates, OR dementia medication dispensed.
- Age 66+ enrolled in an Institutional SNP during the measurement year.
- Age 66+ living long-term in an institution.
 
Valid assessments:
- HbA1c lab result.
- Glucose Management Indicator, also called GMI, if documented in the medical record.
 
Assessment rules:
- Use the most recent valid HbA1c or GMI during the measurement year.
- A distinct numeric value is required for interpretation.
- “Unknown,” ranges, non-numeric values, or vague statements do not count as valid numeric results.
- Do not infer HbA1c from unrelated glucose values.
 
Compliance logic:
This is an inverse measure. A worse glycemic result or missing result counts as COMPLIANT for this quality measure.
 
Return:
- COMPLIANT if the most recent valid HbA1c/GMI during the measurement year is > 9.0%.
- COMPLIANT if no HbA1c/GMI test was performed during the measurement year.
- COMPLIANT if HbA1c/GMI was performed but the result is missing or invalid.
- GAP if the most recent valid HbA1c/GMI during the measurement year is <= 9.0%.
- EXCLUDED if an exclusion applies.
- NOT_IN_POPULATION if age or diabetes population criteria are not met.
 
MEASURE 2: Controlling High Blood Pressure
 
Population:
- Patient must be age 18–85 years during the measurement year.
- Patient must have a diagnosis of essential hypertension.
- Patient must have at least one qualifying encounter.
- Hypertension diagnosis must start before or within the first 6 months of the measurement period.
 
Exclusions:
Return EXCLUDED if any of the following are documented:
- ESRD-related procedure at any time on or before the end of the measurement year, including dialysis, nephrectomy, or kidney transplant.
- Pregnancy during the measurement year.
- Hospice care during the measurement period.
- Palliative care during the measurement period.
- Patient died during the measurement year.
- Age 66+ with both:
  - Frailty: at least 2 indications on different dates during the measurement period.
  - Advanced illness: at least 2 diagnoses on different dates, OR dementia medication dispensed.
- Age 66+ enrolled in an Institutional SNP during the measurement year.
- Age 66+ living long-term in an institution.
- Age 81+ with at least 2 frailty indicators on different dates during the measurement period.
 
Valid BP readings:
- Blood pressure readings from outpatient encounters.
- Remote monitoring device readings, including patient-reported readings, if documented.
 
Invalid BP readings:
- Readings from inpatient stays.
- Readings from emergency department visits.
- Readings taken on the same day as or the day before a procedure requiring medication or diet changes, except fasting labs.
- Readings taken using non-digital/manual devices without proper documentation.
- Readings without explicit numeric systolic and diastolic values.
 
BP rules:
- Use the last valid BP reading of the measurement year.
- If multiple BP readings occur during the same encounter, use the lowest systolic and lowest diastolic values from that encounter.
- Both systolic and diastolic must meet threshold for compliance.
- Do not infer BP control from text such as “stable” or “controlled” unless numeric BP values are present.
 
Return:
- COMPLIANT if the last valid BP is systolic < 140 AND diastolic < 90.
- GAP if the last valid BP is systolic >= 140 OR diastolic >= 90.
- GAP if there is no valid BP reading during the measurement period.
- EXCLUDED if an exclusion applies.
- NOT_IN_POPULATION if age, hypertension diagnosis, or qualifying encounter criteria are not met.
 
MEASURE 3: Screening for Depression and Follow-Up Plan
 
Population:
- Patient must be age 12 years or older during the measurement year.
- Patient must have at least one qualifying encounter during the measurement period.
 
Exclusion:
Return EXCLUDED if:
- Bipolar disorder was diagnosed at any time before the qualifying encounter.
 
Denominator exceptions:
Return EXCEPTION if any of the following are documented:
- Patient refused depression screening.
- Medical reason for not screening, including:
  - Cognitive impairment.
  - Functional limitation.
  - Motivational barrier.
  - Urgent or emergent situation where delay would risk patient health.
 
Valid depression screening:
- Must use a standardized, age-appropriate depression screening tool.
- The tool must be named in documentation.
- Screening must occur on the encounter date or within 14 days before the encounter.
- If screening occurred before the encounter, it must be reviewed and documented on the encounter date.
- Result must be documented as positive or negative.
- Numeric score is not required.
- Telehealth encounters are valid.
 
Valid follow-up plans for positive screening:
- Referral for further evaluation or mental health services.
- Pharmacologic intervention, including antidepressant therapy.
- Other documented treatment or management plan for depression.
 
Invalid follow-up:
- Additional depression screening alone.
- Suicide risk assessment alone.
 
Return:
- COMPLIANT if valid standardized depression screening is documented and result is negative.
- COMPLIANT if valid standardized depression screening is positive and valid follow-up plan is documented on the same day or within 2 days after the encounter.
- GAP if no valid standardized depression screening is documented.
- GAP if screening is positive and no valid follow-up plan is documented within the required timeframe.
- EXCLUDED if bipolar disorder exclusion applies.
- EXCEPTION if a valid denominator exception applies.
- NOT_IN_POPULATION if age or qualifying encounter criteria are not met.
 
OUTPUT REQUIREMENTS:
Return JSON only using this structure:
 
{
  "patient_id": "<patient identifier>",
  "measurement_year": <measurement year>,
  "overall_summary": "<brief summary across all evaluated measures>",
  "measures": [
    {
      "measure_name": "<measure name>",
      "status": "COMPLIANT | GAP | EXCLUDED | EXCEPTION | NOT_IN_POPULATION | INSUFFICIENT_DATA",
      "reason": "<clear clinical explanation>",
      "evidence": [
        "<supporting facts from patient data>"
      ],
      "missing_requirements": [
        "<only include when status is GAP; otherwise empty array>"
      ]
    }
  ]
}
 
When evaluating this patient:
- Evaluate all three measures.
- Be strict.
- Do not give credit for undocumented items.
- Do not invent dates, diagnoses, lab values, BP values, encounters, medications, exclusions, or refusals.
`

//  optimization needed.
const getPatientRecord = async (firstName, lastName, email) => {
  try{
    // console.log(`DEBUG: Received request to create VBC for patient - First Name: ${firstName}, Last Name: ${lastName}, Email: ${email}`);
    const database = databaseClient.database(databaseId);
    const container = database.container("Patients");
    const querySpec = {
      query: `SELECT * FROM c WHERE 
              c.original_json.original_json.details.firstname = @firstName
              AND c.original_json.original_json.details.lastname = @lastName
              AND c.original_json.original_json.details.email = @email`,
      parameters: [
        { name: "@firstName", value: firstName },
        { name: "@lastName", value: lastName },
        { name: "@email", value: email }
      ]
    };
    const { resources } = await container.items.query(querySpec).fetchAll();
    if(resources.length === 0) {
      throw new Error("No patient record found matching the provided details");
    }
    return resources[0];
  } catch (error) {
    console.error("Error in getPatientRecord:", error);
    throw error;
  }
};

const createVBCForPatient = async (patientData) => {
  try {
    const patient_record = await getPatientRecord(patientData.first_name, patientData.last_name, patientData.email);
    const response = await client.chat.completions.create({
      model: MODEL_DEPLOYMENT,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          // content: `Analyze this patient record and return JSON only:\n\n${JSON.stringify(patient_record, null, 2)}`
          content: JSON.stringify(
            {
              measurement_year: 2026,
              patient: patient_record
            },
            null,
            2
          )
        }
      ],
      temperature: 0.3,

    response_format: {
        type: "json_schema",
        json_schema: {
          name: "quality_measure_evaluation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              patient_id: { type: "string" },
              measurement_year: { type: "integer" },
              overall_summary: { type: "string" },
              measures: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    measure_name: { type: "string" },
                    status: {
                      type: "string",
                      enum: [
                        "COMPLIANT",
                        "GAP",
                        "EXCLUDED",
                        "EXCEPTION",
                        "NOT_IN_POPULATION",
                        "INSUFFICIENT_DATA"
                      ]
                    },
                    reason: { type: "string" },
                    evidence: {
                      type: "array",
                      items: { type: "string" }
                    },
                    missing_requirements: {
                      type: "array",
                      items: { type: "string" }
                    }
                  },
                  required: [
                    "measure_name",
                    "status",
                    "reason",
                    "evidence",
                    "missing_requirements"
                  ]
                }
              }
            },
            required: [
              "patient_id",
              "measurement_year",
              "overall_summary",
              "measures"
            ]
          }
        }
      }
    });

    const result = JSON.parse(response.choices[0].message.content);

    return result;
  } catch (error) {
    console.error("Error in createVBCForPatient:", error);
    throw error;
  }
};

const getVbcForPatient = async (patientData) => {
  try{
    // console.log(`Received request to get VBC insights for patient - First Name: ${patientData.first_name}, Last Name: ${patientData.last_name}, Email: ${patientData.email}`);
    const database = databaseClient.database(databaseId);
    const container = database.container("VBC_responses");
    const id = generateVBCId(patientData.first_name, patientData.last_name, patientData.email);
    const partitionKey = `patient_${patientData.patient_id}`;
    const { resource } = await container.item(id, partitionKey).read();
    if(!resource) {
      const result = await createVBCForPatient(patientData);
      if(!result) {
        throw new Error("Failed to generate VBC insights for patient");
      }
      const newItem = {
        id,
        ... result
      }
      const { resource: createdItem } = await container.items.upsert(newItem);
      return createdItem;
    }
    return resource;
  } catch (error) {
    console.error("Error in getVbcForPatient:", error);
    throw error;
  }
}



module.exports = {
    getVbcForPatient
};