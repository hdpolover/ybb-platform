# Ambassador Referral System

## Overview

The YBB Platform includes an anonymous ambassador referral system designed to track referrals without exposing ambassador identities in public URLs. This system uses opaque, 8-character alphanumeric tokens rather than personally identifiable information.

## How it Works

### 1. The Referral Token
Instead of using names or predictable IDs (e.g., `REF-HENDRA`), the system generates **anonymous, random 8-character tokens** for each ambassador.

*   **Format**: `[A-Z0-9]{8}` (e.g., `K9X2M4P1`)
*   **Alphabet**: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (Excludes ambiguous characters like `I`, `1`, `O`, `0`)
*   **Privacy**: The token cannot be reverse-engineered to find the ambassador's name or ID.

### 2. URL Strategy (Frontend Implementation)
To maintain the "anonymous" look, the frontend should support generic query parameters that do not explicitly scream "referral".

**Recommended URL Format:**
```
https://ybb.co/programs/ybb-15?t=K9X2M4P1
```

**Supported Query Parameters:**
The frontend should look for any of these parameters to extract the token:
*   `t` (Token)
*   `c` (Code)
*   `s` (Source)
*   `q` (Query)
*   `ref` (Legacy support, but discouraged for privacy)

**Frontend Logic:**
1.  User visits the URL.
2.  Frontend middleware or client-side script detects `?t=K9X2M4P1`.
3.  Store `K9X2M4P1` in a cookie or `localStorage` (e.g., key: `ybb_referral_code`).
4.  **Important**: Clean the URL using `window.history.replaceState` to remove the query parameter immediately, so the user doesn't see it lingering.

### 3. API Registration Flow
When calling the `POST /auth/register` endpoint, include the stored token in the payload.

**Endpoint**: `POST /auth/register`

**Payload:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "providerId": "uuid-of-provider",
  "programSlug": "ybb-15",
  "referralCode": "K9X2M4P1" // << Insert Stored Token Here
}
```

The backend will:
1.  Look up the active Ambassador identified by `K9X2M4P1`.
2.  Register the user.
3.  Create an `AmbassadorReferral` record linking the new user to the ambassador.
4.  Increment the ambassador's `totalReferrals` statistic.

## Security & Privacy Notes

*   **Opaque**: The token reveals nothing about the ambassador.
*   **Revocable**: If a token is abused, the ambassador can be deactivated, rendering the token useless.
*   **Case Insensitive**: While generated in uppercase, the system can be adapted to handle case-insensitive matching if needed (currently exact match is preferred for speed).

---

## Referral Code Formats

Two code formats exist depending on how the ambassador record was created:

| Path | Format | Example |
|------|--------|---------|
| Self-service (`POST /portal/ambassadors/apply`) | 8 random chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` | `K9X2M4P1` |
| Admin-created (`POST /admin/ambassadors`) | 3 letters from name + 5 random digits | `HEN12345` |

Both formats are stored in `ambassador.referralCode`. The lookup is always by exact match (`ambassador.referralCode = :code AND isActive = true`).

---

## Referral Capture: Two Entry Points

A referral can be linked at two distinct moments:

### 1. Onboarding (Profile Completion)

When a participant completes their profile (`POST /portal/onboarding/complete`), the payload may include a `referralCode`. If a code is provided and an active ambassador with that code exists, the system:

1. Creates an `AmbassadorReferral` record with `status: referred`.
2. Increments `ambassador.totalReferrals` and sets `ambassador.lastReferralAt`.
3. Stores the code on the participant record (`participant.referralCode`).
4. Advances the funnel to `registered` (profile completion signals this stage).

**Deduplication:** If the participant already has an `AmbassadorReferral`, the code is ignored. First referral wins.

**Invalid code:** If no active ambassador matches the code, the error is silently swallowed. Onboarding completes normally.

### 2. Application Submission (Dynamic Form Field)

When a participant submits an application (`POST /portal/applications/submit`), the handler scans the program's form fields for a field whose name or label matches referral keywords (`referral`, `refcode`, `ambassadorcode`, `ambassadorreferral`) or whose `validationRules.fieldKind` matches `/referral|ambassador/i`.

If such a field exists and has a non-empty value in the submitted `personalData`, and the participant does not already have an `AmbassadorReferral`, the system links the referral the same way as onboarding (create referral, increment counters, update participant record).

This is non-blocking: referral linking errors never prevent the application from submitting.

---

## Referral Funnel

`ReferralFunnelService` advances an `AmbassadorReferral` through conversion stages. All methods are fire-and-no-throw (failures are logged as warnings).

| Stage | Transition | Triggered by |
|-------|-----------|-------------|
| `referred` | initial | Onboarding or submission referral capture |
| `registered` | `referred` to `registered` | Onboarding completion (`CompleteOnboardingHandler`) |
| `applied` | `referred`/`registered` to `applied` | Application submission (both portal and admin paths) |
| `accepted` | any non-terminal to `accepted` | Application review approval (`ReviewApplicationHandler`). Also increments `ambassador.successfulReferrals` and sets `firstSuccessfulReferralAt` (once only). |
| `completed` | any to `completed` | When both `registrationPaymentStatus` and `programPaymentStatus` are `paid` on the application. |

The funnel only advances for referrals where `ambassador.programId` matches the application's `programId` AND `ambassador.isActive = true`.

---

## Ambassadors Are Not Exempt from Payments

A user can be both an ambassador and a paying participant. Being an ambassador confers no payment bypass. The registration fee gate applies to all participants, including those who are also ambassadors.

---

## Admin: Payments View Ambassador Badge

When an admin views the invoice list, each invoice's `participant.ambassador` field is populated if the payer is also an ambassador:

```json
{
  "referralCode": "ABC12345",
  "isActive": true,
  "isSameProgram": true
}
```

`isSameProgram` is `true` when the ambassador's assigned program matches the invoice's program. This field is `null` when the payer is not an ambassador.

---

## Admin: Ambassador List

The `GET /admin/ambassadors` endpoint supports filtering and sorting via query parameters:

| Parameter | Description |
|-----------|-------------|
| `programId` | UUID or slug of the program |
| `search` | Full-name, referral code, or email (case-insensitive) |
| `page` / `limit` | Pagination |
| `sortBy` | `totalReferrals`, `successfulReferrals`, `lastReferralAt`, `fullName`, `referralCode`, `institution`, `isActive`, `createdAt` |
| `sortOrder` | `asc` or `desc` |

The admin UI can wire column headers to `sortBy`/`sortOrder` to produce clickable sort behavior.
