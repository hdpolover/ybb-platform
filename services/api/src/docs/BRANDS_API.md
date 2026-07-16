## Overview
The Brands module (also referred to as Program Categories in the database schema) represents the top-level entity in the YBB Platform ecosystem. A Brand acts as the tenant or organizer for multiple programs (events). For example, "Istanbul Youth Summit" or "YBB" are Brands.

## Base URL
`/brands`

## Data Model

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Unique identifier |
| `name` | String | Display name of the brand |
| `slug` | String | URL-friendly identifier |
| `description` | String | HTML or Text description |
| `logoUrl` | URL | Path to the brand's logo |
| `bannerUrl` | URL | Path to the brand's banner/cover image |
| `websiteUrl` | URL | External website link |
| `primaryColor` | Hex | Main brand color for UI theming |
| `contactEmail` | Email | Public contact email |
| `isActive` | Boolean | Visibility status |

## Endpoints

### 1. List Brands
*   **Method:** `GET /brands`
*   **Summary:** specific list of all registered brands.
*   **Response:** Array of Brand objects.

### 2. Get Brand Detail
*   **Method:** `GET /brands/{id}`
*   **Parameters:** `id` (UUID)
*   **Response:** Single Brand object.

### 3. Create Brand
*   **Method:** `POST /brands`
*   **Content-Type:** `multipart/form-data`
*   **Authorization:** Bearer Token (Admin)
*   **Body:**
    *   `name` (string, required)
    *   `slug` (string, optional)
    *   `description` (string, optional)
    *   `websiteUrl` (url, optional)
    *   `primaryColor` (hex, optional)
    *   `contactEmail` (email, optional)
    *   `logo` (file, optional)
    *   `banner` (file, optional)

### 4. Update Brand
*   **Method:** `PUT /brands/{id}`
*   **Content-Type:** `multipart/form-data`
*   **Authorization:** Bearer Token (Admin)
*   **Body:** Same as Create, all fields optional.

### 5. Delete Brand
*   **Method:** `DELETE /brands/{id}`
*   **Authorization:** Bearer Token (Admin)
*   **Response:** 200 OK

### 6. List Top Sponsors
*   **Method:** `GET /brands/{id}/sponsors`
*   **Summary:** Returns a list of sponsors associated with this brand (across all its programs).

## Notes for Consumers
*   **Images:** When creating or updating, you can upload `logo` and `banner` as binary files. The server will handle upload to storage and return the public URLs in the response.
*   **Slug:** If not provided, the system may auto-generate one from the name (implementation dependent).
