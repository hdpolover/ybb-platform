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
