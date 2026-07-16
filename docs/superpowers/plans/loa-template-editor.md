# LOA Template Editor — Feature Spec

> **Status:** Spec only. Implementation deferred. Reference this doc when starting the LOA template editor feature.

---

## What This Is

An admin-side rich template editor for Letter of Acceptance (LOA) documents. Admins compose a reusable template with dynamic placeholders (e.g. `{{participant_name}}`). When triggered, the system merges a specific participant's data into the template and generates a PDF participants can download from their portal.

---

## User Stories

### Admin
1. As an admin, I can create an LOA template with a header (logo, program name, date), body (acceptance text with placeholders), and footer (signature block, institution name).
2. As an admin, I can insert placeholders from a predefined list (e.g. participant name, program name, batch, acceptance date) into the template body.
3. As an admin, I can preview the rendered template with sample data before saving.
4. As an admin, I can publish or unpublish the template.
5. As an admin, I can trigger bulk LOA generation for all eligible participants, or per-participant on their detail page.

### Participant
1. As a participant, I can see my LOA listed in my Documents tab once generated.
2. As a participant, I can download my LOA as a PDF.
3. As a participant, I can see the generation date and a verification hash/QR code on the document.

---

## Data Model

### DocumentTemplate (existing, extend)

```prisma
model DocumentTemplate {
  // existing fields...
  type          DocumentTemplateType  // letter_of_acceptance (use this type)
  htmlContent   String?               // The Tiptap/ProseMirror HTML with placeholder tokens
  placeholders  Json                  // Array of { key: string, label: string, source: string }
  layoutConfig  Json                  // { pageSize, margins, headerHtml, footerHtml, logoUrl, signatureUrl }
}
```

`layoutConfig` shape:
```json
{
  "pageSize": "A4",
  "margins": { "top": 40, "right": 40, "bottom": 40, "left": 40 },
  "headerHtml": "<div>...</div>",
  "footerHtml": "<div>...</div>",
  "logoUrl": "https://...",
  "signatureUrl": "https://..."
}
```

`placeholders` shape:
```json
[
  { "key": "{{participant_name}}", "label": "Participant Full Name", "source": "participant.fullName" },
  { "key": "{{program_name}}", "label": "Program Name", "source": "program.name" },
  { "key": "{{acceptance_date}}", "label": "Acceptance Date", "source": "generated_at" },
  { "key": "{{batch}}", "label": "Batch / Cohort", "source": "program.batch" },
  { "key": "{{document_number}}", "label": "Document Number", "source": "participant_document.documentNumber" },
  { "key": "{{participation_category}}", "label": "Participation Category", "source": "application.participationCategory.name" }
]
```

### ParticipantDocument (existing)

No schema changes needed. Fields used:
- `templateId` — links to the LOA template
- `fileUrl` — S3/storage URL of the generated PDF
- `documentNumber` — auto-generated unique reference (e.g. `LOA-2027-001234`)
- `generatedAt` — when PDF was created
- `isPublic: false` — visible only to the participant

---

## Architecture

```
Admin editor (Tiptap)
       │ saves htmlContent + layoutConfig
       ▼
DocumentTemplate (DB)
       │
       ├── Admin triggers generation (per-participant or bulk)
       │        │
       │        ▼
       │   GenerateLOACommand → handler
       │        │ merges placeholders with participant data
       │        │ calls PDF generation service (gRPC or HTTP)
       │        │ stores result as ParticipantDocument
       │        ▼
       │   PDF stored in storage, URL saved
       │
       └── Participant portal fetches via GET /portal/documents
                │ sees LOA in myDocuments
                ▼
           Download button → PDF
```

PDF generation reuses the existing `/documents/generate/offer-letter` endpoint in `src/modules/files/presentation/documents.controller.ts`. The handler passes `htmlContent` + merged data to the gRPC PDF service.

---

## Admin UI — Template Editor Page

**Route:** `/programs/[programId]/documents/loa-template`

**Layout:** Two-column split
- Left (60%): Tiptap rich text editor for body content
- Right (40%): Live preview panel + placeholder picker

**Toolbar sections:**
1. **Document settings** (collapsible): page size, margins
2. **Header editor**: logo upload, program name, date field
3. **Body editor** (Tiptap): full rich text — bold, italic, underline, alignment, lists, font size
4. **Footer editor**: signature image upload, signer name, title, institution

**Placeholder insertion:**
- Sidebar shows all available `{{placeholder}}` tokens
- Click inserts at cursor position in Tiptap editor
- Tokens render highlighted in the editor (custom Tiptap extension)

**Preview:**
- "Preview" button renders the template with hardcoded sample data in an iframe
- Shows exactly how the PDF will look

**Save / Publish:**
- "Save Draft" — saves without publishing
- "Publish" — sets `isActive = true`, makes available for generation

---

## Admin UI — Generation Trigger

**Per-participant:** On `admin/programs/[programId]/participants/[accountId]` page, add "Generate LOA" button. Calls `POST /programs/[programId]/document-templates/[templateId]/generate` with `{ participantId }`.

**Bulk:** On LOA template page, "Generate for All Eligible" button. Calls same endpoint with `{ bulk: true }`. Shows progress toast.

---

## Backend — New Endpoints Needed

```
POST /programs/:programId/document-templates/:templateId/generate
  Body: { participantId?: string, bulk?: boolean }
  Guard: JwtAuthGuard (admin only)
  - Resolves eligible participants
  - Calls PDF generation gRPC service with merged HTML
  - Creates/updates ParticipantDocument records
  - Returns { generated: number, failed: number }
```

---

## PDF Generation Service Integration

Existing: `POST /documents/generate/offer-letter` in `documents.controller.ts` (lines 204–247).

The LOA handler will call this internally via `CommandBus` or directly via `FilesService`. It must pass:
```typescript
{
  html: string,          // merged htmlContent
  headerHtml: string,    // from layoutConfig
  footerHtml: string,    // from layoutConfig
  pageSize: 'A4',
  margins: { top, right, bottom, left },
  documentNumber: string,
  participantId: string,
}
```

---

## Verification / Anti-Fraud

Each generated LOA gets a `documentNumber` (format: `LOA-{YEAR}-{6-digit-sequence}`) and a verification hash stored in the document. The existing `GET /documents/verify/:hash` endpoint in `documents.controller.ts` (line ~320) can validate authenticity.

A QR code pointing to the verify URL should be embedded in the footer.

---

## Libraries to Evaluate

| Need | Candidate |
|---|---|
| Rich text editor | `@tiptap/react` with `@tiptap/extension-*` |
| Custom placeholder node | Tiptap custom `Node` extension |
| PDF generation (server) | Already handled by gRPC `files` service |
| PDF preview (client) | `react-pdf` or iframe with blob URL |
| QR code in PDF | `qrcode` npm package, base64 embed |

---

## Open Questions (resolve before implementation)

1. **Can Tiptap tokens survive copy-paste?** The placeholder node needs to be an atomic inline node, not just styled text — otherwise users can accidentally break `{{participant_name}}` by editing it.
2. **How does the gRPC PDF service accept HTML?** Check `generate-offer-letter` gRPC proto to understand the exact input format required.
3. **Bulk generation scale:** With 1,000+ participants, bulk generation needs a queue (BullMQ job). Confirm whether the background job infrastructure exists.
4. **LOA number sequence:** Is there a global sequence or per-program? Confirm with business.
5. **Expiry:** Should LOAs expire? `ParticipantDocument.expiresAt` exists — decide if LOAs should use it.
