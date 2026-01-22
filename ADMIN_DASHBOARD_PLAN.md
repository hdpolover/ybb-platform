# Admin Dashboard Configuration & Structure Plan

This document outlines the configuration and structure for the `admin-dashboard` service. It maps the backend data models (Prisma) to the frontend folder structure (`app/platform` vs `app/programs/[programId]`).

## 1. Core Concept
The dashboard is split into two distinct contexts:
*   **Platform Admin** (`/app/platform`): Manages the Brand/Organization (`ProgramCategory`), global Users, and System-wide settings. **System Admins (Platform Admins) have Super Admin access, allowing them to view and edit all Programs automatically.**
*   **Program Admin** (`/app/programs/[programId]`): Manages the execution of a specific Event (`Program`), including Participants, Content, and Finances. Access is limited to assigned Programs.

---

## 2. Platform Admin Dashboard
**Route Base:** `/platform`
**Scope:** `ProgramCategory` (e.g., YBB, YAF) & Global Resources.

### Sidebar Menu Structure

1.  **Dashboard** (`/platform`)
    *   **Overview**: Total revenue, Active Programs, Total Users.
    *   **Quick Actions**: "Create Program", "Add Platform Admin".

2.  **Organization** (`/platform/settings`)
    *   **General**:
        *   Profile: Name, Tagline, Description, Vision/Mission.
        *   Contact: Email, WhatsApp, Address, Social Media Links.
        *   Branding: Logo, Banner, Primary Color.
    *   **Localization**: Default Currency, Timezone, IDR/USD Rate.
    *   **Legal**: Privacy Policy & Terms Editor (`LegalDocument`).
    *   **Finance**: **Payment Gateway Config** (Midtrans/Stripe/Xendit keys).
    *   **Landing Page**: Footer Nav, SEO Keys (`ProgramCategorySetting`).

3.  **Communication & Marketing** (`/platform/marketing`)
    *   **Newsletter**: Subscriber list (`NewsletterSubscriber`). Export to CSV.
    *   **AI Chatbots**: Manage Bot Configs (`AiChatBotConfig`).
        *   Config: Script/Embed code, Active domains.
    *   **Social Feed**: Manage Instagram/TikTok posts (`ProgramSocialFeed`).

4.  **Programs** (`/platform/programs`)
    *   **All Programs**: List of active/draft/archived programs.
    *   **Management**: Create new Program, Clone existing.

5.  **User Management** (`/platform/users`)
    *   **Users**: Global search (Name, Email).
    *   **Security**: Banned users list, Activity logs.

6.  **Admins & Roles** (`/platform/admins`)
    *   **Team**: List of all admins (Platform & Program level).
    *   **Roles**: Define Permission Sets (`AdminRole`).

7.  **Support** (`/platform/support`)
    *   **Master Inbox**: All tickets from all programs.
    *   **Actions**: Reply, Resolve, Re-assign.

---

## 3. Program Admin Dashboard
**Route Base:** `/programs/[programId]`
**Scope:** `Program` (Specific Event Instance).

### Sidebar Menu Structure

1.  **Overview** (`.../`)
    *   Stats: Applicants (Draft vs Submitted), Payments Pending, Revenue.
    *   Timeline: Current active phase indicator.

2.  **Website & Preview** (`.../website`)
    *   **Preview**: Live view of the Landing Page (reflecting all changes).
    *   **Hero & SEO**: Banner, Video, Meta tags.
    *   **Text Content**: About, Requirements, Benefits descriptions.
    *   **Resources**: Public Guidebooks (`ProgramResource`).
    *   **Visibility**: Publish/Unpublish Program.

3.  **Applications** (`.../submissions`)
    *   **Inbox**: List of new submissions.
    *   **Review Board**: Kanban view (Under Review -> Interview -> Accepted).
    *   **Scoring**: Grade essays/documents.
    *   **Forms**: Configure Application Form (`ApplicationFormField`).
    *   **Requirements**: Manage upload requirements (`ProgramRequirement`).

4.  **Participants** (`.../participants`)
    *   **Database**: Full participant list (Registered & Applied).
    *   **Ambassadors**: Referral leaderboard & verification.

5.  **Program Data** (`.../master-data`)
    *   **Schedule**: Manage Itinerary & Calendar.
    *   **Speakers**: Speaker profiles.
    *   **Partners**: Sponsors & Partners list.
    *   **FAQs**: Program-specific Q&A.
    *   **Participation Info**: "Fully Funded" vs "Self Funded" details.

6.  **Communication** (`.../announcements`)
    *   **Announcements**: Create new broadcast (Email/Banner).
    *   **Support**: **Program Inbox** (Tickets linked to this Program ID).

7.  **Finances** (`.../payments`)
    *   **Transactions**: Verify manual bank transfers.
    *   **Pricing**: Configure Packages & Tiers (`ProgramPricingTier`).

8.  **Settings** (`.../settings`)
    *   **Configuration**: Dates, Location, Theme.
    *   **Registration**: Open/Close toggle, Fees.
    *   **Documents**: Certificate Templates.

---

## 4. Next Steps
1.  **Schema**: `PaymentGatewayConfig` is applied. (Done)
2.  **Scaffold**: Generate the sidebar and layout components based on this menu structure.
3.  **Components**: Build the specific forms for "Organization Settings" and "Participation Info".
