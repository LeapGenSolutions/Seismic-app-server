# SEISMIC Billing & Payments — API Documentation

**Base URL:** `/api`
**Auth:** All billing endpoints require a valid doctor JWT (`Authorization: Bearer <token>`)
**Access:** Only the Doctor (account owner) can call these APIs. NP and Back Office Staff get 403.

---

## SUBSCRIPTIONS

### GET `/api/subscriptions/current`
**What it does:** Returns the doctor's current subscription details.

**Use case:** Load the billing overview page — show what plan they're on, when it renews, how many seats, current status.

**Response:**
```json
{
  "modality": "monthly",
  "status": "active",
  "currentPeriodStart": "2026-03-01",
  "currentPeriodEnd": "2026-04-01",
  "seats": [...],
  "cancelAtPeriodEnd": false
}
```

---

### POST `/api/subscriptions/trial`
**What it does:** Starts a 30-day free trial for a new doctor. No payment required.

**Use case:** Doctor just registered → lands on billing page → clicks "Start Free Trial" → gets 30 days access without entering a card.

**Rules:**
- Can only be called once per doctor
- If subscription already exists → returns 400

---

### GET `/api/subscriptions/trial-status`
**What it does:** Returns how many days are left in the trial.

**Use case:** Show the trial countdown banner in the UI — "You have 12 days left in your trial."

**Response:**
```json
{
  "onTrial": true,
  "trialEndDate": "2026-03-31",
  "daysLeft": 12,
  "expired": false
}
```

---

### POST `/api/subscriptions`
**What it does:** Creates a paid subscription after the doctor has added a payment method.

**Use case:** Doctor selects a plan (Monthly / Annual / One-Time) and confirms — this charges their saved card and activates the subscription immediately.

**Body:**
```json
{
  "modality": "monthly",
  "paymentMethodId": "pm_xxx"
}
```

**What happens internally:**
- Monthly/Annual → creates a Stripe Subscription (auto-renews every cycle)
- One-Time → single charge via Stripe PaymentIntent, no auto-renewal
- Subscription record saved to Cosmos DB

---

### PATCH `/api/subscriptions/cancel`
**What it does:** Cancels the subscription.

**Use case:** Doctor wants to stop their plan.

**Body:**
```json
{ "immediate": false }
```

**Two modes:**
- `immediate: false` → stays active until end of current period, then stops (default)
- `immediate: true` → access cut off right now

---

### PATCH `/api/subscriptions/convert`
**What it does:** Converts a one-time or trial subscription to a recurring monthly or annual plan.

**Use case:**
- Trial is expiring → doctor clicks "Upgrade to Monthly"
- Doctor had a one-time plan → wants to switch to auto-renewing

**Body:**
```json
{
  "modality": "annual",
  "paymentMethodId": "pm_xxx"
}
```

---

### PATCH `/api/subscriptions/downgrade`
**What it does:** Schedules a downgrade from Annual → Monthly at the next renewal date.

**Use case:** Doctor is on annual, wants to switch to monthly but doesn't want to lose the remaining annual period they paid for. Change takes effect at next renewal.

**Note:** Does not charge or refund anything immediately.

---

## PAYMENT METHODS

### GET `/api/payment-methods`
**What it does:** Lists all saved payment methods for the doctor.

**Use case:** Show the "Saved Payment Methods" section — cards on file, Venmo linked, which one is default.

**Response:**
```json
[
  {
    "id": "uuid",
    "type": "stripe_card",
    "brand": "visa",
    "last4": "4242",
    "expMonth": 12,
    "expYear": 2027,
    "isDefault": true
  }
]
```

---

### POST `/api/payment-methods/setup-intent`
**What it does:** Creates a Stripe SetupIntent and returns a `clientSecret` to the frontend.

**Use case:** Doctor clicks "Add Card" → frontend uses this `clientSecret` with Stripe.js to display a secure card input form. Raw card numbers never touch SEISMIC servers.

**Response:**
```json
{
  "clientSecret": "seti_xxx_secret_xxx",
  "stripeCustomerId": "cus_xxx"
}
```

**Flow:**
1. Frontend calls this → gets `clientSecret`
2. Frontend uses Stripe.js to collect card and confirm the SetupIntent
3. Card is vaulted in Stripe
4. Frontend calls `POST /api/payment-methods/confirm-card` to save it to SEISMIC

---

### POST `/api/payment-methods/confirm-card`
**What it does:** After Stripe.js confirms the card on the frontend, this saves the masked card details to SEISMIC's database.

**Use case:** Completing the "Add Card" flow — the card is now saved and ready to use for subscriptions.

**Body:**
```json
{
  "paymentMethodId": "pm_xxx",
  "stripeCustomerId": "cus_xxx"
}
```

---

### GET `/api/payment-methods/braintree-token`
**What it does:** Returns a short-lived Braintree client token.

**Use case:** Doctor clicks "Link Venmo" → frontend needs this token to initialize the Braintree/Venmo drop-in UI widget.

**Response:**
```json
{ "clientToken": "eyJ2ZXJzaW9uIjoy..." }
```

---

### POST `/api/payment-methods/venmo`
**What it does:** After the doctor authorizes Venmo in the frontend drop-in UI, this saves the Venmo token to SEISMIC.

**Use case:** Completing the "Link Venmo" flow — Venmo is now saved as a payment option.

**Body:**
```json
{
  "paymentMethodNonce": "xxx",
  "venmoEmail": "doctor@venmo.com"
}
```

---

### DELETE `/api/payment-methods/:id`
**What it does:** Removes a saved payment method.

**Use case:** Doctor wants to remove an old card or unlink Venmo.

**Note:** Also detaches the card from Stripe so it can't be accidentally charged.

---

### PATCH `/api/payment-methods/:id/default`
**What it does:** Sets a payment method as the default for future charges.

**Use case:** Doctor has two cards saved — wants to switch which one gets charged for renewals.

---

## SEATS (Supporting Users)

### GET `/api/seats`
**What it does:** Returns the list of supporting users currently on the subscription.

**Use case:** Show the "Supporting Users" section — who is added, their role, when they were added.

---

### GET `/api/seats/cost-preview?role=Nurse+Practitioner`
**What it does:** Returns a cost preview before the doctor actually adds a seat.

**Use case:** Doctor clicks "Add NP" → show them "This will charge $19.35 today (prorated for 20 remaining days this month), then $29/month going forward." Doctor can confirm or cancel.

**Response:**
```json
{
  "role": "Nurse Practitioner",
  "monthlyPrice": 29,
  "proratedAmount": 19.35,
  "periodEnd": "2026-04-01"
}
```

---

### POST `/api/seats`
**What it does:** Adds a supporting user to the subscription and charges the prorated amount immediately.

**Use case:** Doctor invites an NP or Back Office Staff member mid-cycle. They're charged only for the remaining days in the current billing period.

**Body:**
```json
{
  "userId": "nurse@clinic.com",
  "role": "Nurse Practitioner"
}
```

**Seat limit behavior:** If the doctor already has 2 seats, this returns:
```json
{
  "error": "Seat limit reached.",
  "upgradeRequired": true,
  "redirectUrl": "https://seismichealth.com/upgrade/clinic"
}
```
Frontend shows the "Upgrade to Clinic Plan" modal.

---

### DELETE `/api/seats/:userId`
**What it does:** Removes a supporting user from the subscription and applies a prorated credit.

**Use case:** Doctor removes an NP who left the practice. A credit for the unused days is applied to the next invoice automatically.

---

## INVOICES

### GET `/api/invoices`
**What it does:** Returns a paginated list of all invoices.

**Use case:** Invoice history page — show all past invoices with dates, amounts, status.

**Query params:** `?offset=0&limit=20`

---

### GET `/api/invoices/:id`
**What it does:** Returns a single invoice's full details.

**Use case:** Doctor clicks on an invoice to view the line items — base subscription, seat charges, taxes, total.

---

### GET `/api/invoices/:id/download`
**What it does:** Streams the invoice as a downloadable PDF.

**Use case:** Doctor clicks "Download PDF" — gets a professional invoice with their name, NPI, line items, transaction ID, and payment details.

---

### POST `/api/invoices/:id/send`
**What it does:** Re-sends the invoice PDF to the doctor's email.

**Use case:** Doctor lost the original email — clicks "Re-send Invoice" to get it again.

---

## TRANSACTIONS

### GET `/api/transactions`
**What it does:** Returns a list of all payment transactions with optional filters.

**Use case:** Transaction history page — show every charge attempt: date, amount, status (Success / Failed / Refunded), payment method.

**Query params:** `?status=succeeded&from=2026-01-01&to=2026-12-31`

---

### GET `/api/transactions/:id`
**What it does:** Returns a single transaction's full details.

**Use case:** Doctor clicks on a transaction to see details — transaction ID, failure reason if failed, linked invoice.

---

### GET `/api/transactions/:id/receipt`
**What it does:** Generates and downloads a receipt PDF for a specific payment.

**Use case:** Doctor needs a receipt for a specific charge (e.g., for expense reimbursement). Simpler than a full invoice — just confirms the payment was made.

---

## REPORTS

### GET `/api/reports/billing-summary?year=2026`
**What it does:** Returns a monthly spend breakdown for the given year.

**Use case:** "Billing Summary" section — show total spent this year, broken down by month. Useful for the doctor to track their healthcare software costs.

**Response:**
```json
{
  "year": 2026,
  "annualTotal": 1245.00,
  "monthlySummary": [
    { "month": 1, "monthName": "January", "total": 99.00, "count": 1 },
    { "month": 2, "monthName": "February", "total": 128.00, "count": 2 },
    ...
  ]
}
```

---

### GET `/api/reports/export?from=2026-01-01&to=2026-12-31`
**What it does:** Exports all transactions as a downloadable CSV file.

**Use case:** Doctor or their accountant needs a full payment history for tax purposes or accounting software import.

**CSV columns:** Date, Transaction ID, Subscription Type, Payment Method, Amount, Status, Description

---

## WEBHOOKS (Internal — not called by frontend)

### POST `/webhooks/stripe`
**What it does:** Receives real-time events from Stripe.

**Events handled:**
| Event | Action |
|---|---|
| `payment_intent.succeeded` | Marks transaction as succeeded, generates invoice PDF, emails doctor |
| `payment_intent.payment_failed` | Marks transaction as failed, emails doctor to update payment method |
| `invoice.paid` | For recurring subscriptions — records renewal, generates invoice |
| `customer.subscription.updated` | Syncs subscription status and period dates from Stripe |
| `customer.subscription.deleted` | Marks subscription as cancelled in SEISMIC |
| `payment_method.updated` | Updates saved card expiry date when doctor's card is renewed by their bank |

---

### POST `/webhooks/braintree`
**What it does:** Receives real-time events from Braintree (Venmo payments).

**Events handled:**
| Event | Action |
|---|---|
| `TRANSACTION_SETTLED` | Marks Venmo transaction as succeeded, generates invoice |
| `TRANSACTION_SETTLEMENT_DECLINED` | Marks transaction as failed, emails doctor |
| `SUBSCRIPTION_CHARGED_UNSUCCESSFULLY` | Marks subscription as past due |

---

## AUTOMATED BACKGROUND JOBS (run daily at midnight UTC)

These run automatically — no API call needed.

| Job | Trigger | Action |
|---|---|---|
| One-time expiry check | Every day | If one-time sub has expired → set status to expired, email doctor |
| One-time expiry reminders | Every day | 7 days before expiry → reminder email. 2 days before → final reminder |
| Annual renewal reminder | Every day | 30 days before annual renewal → reminder email |
| Monthly renewal reminder | Every day | 3 days before monthly renewal → reminder email |
| Trial expiry check | Every day | If trial ended → set expired, email doctor to choose a plan |
| Trial reminders | Every day | 7 days and 2 days before trial ends → reminder email |
| Venmo renewals | Every day | On renewal date for Venmo subscribers → charge Braintree, generate invoice |

---

## ERROR RESPONSES

All endpoints return consistent error shapes:

```json
{ "error": "Human-readable message" }
```

| Status | Meaning |
|---|---|
| 400 | Bad request — missing or invalid fields |
| 401 | Not authenticated — missing or expired JWT |
| 403 | Forbidden — user is not a Doctor, or seat limit hit (with upgradeRequired flag) |
| 404 | Resource not found |
| 409 | Conflict — e.g., subscription already exists |
| 500 | Server error |
