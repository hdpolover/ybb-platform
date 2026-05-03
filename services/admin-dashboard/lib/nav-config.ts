import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Layers,
  FolderOpen,
  UserCheck,
  UserPlus,
  BarChart3,
  Settings,
  CreditCard,
  Trophy,
  Inbox,
  FileText,
  FileBadge,
  Bell,
  Database,
  FileEdit,
  DollarSign,
  Wallet,
  Calendar,
  MessageSquare,
  Video,
  Image,
  PlayCircle,
  Mic,
  Award,
  HelpCircle,
  BookOpen,
  Handshake,
  LifeBuoy,
  ShieldCheck,
  Shield,
  Menu,
  ChevronRight,
  Images,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NavItem = {
  id: string;
  label: string;
  /** Absolute href for platform nav; relative segment for program nav (without leading slash) */
  href: string;
  icon: LucideIcon;
  children?: NavItem[];
};

export type NavSection = {
  id: string;
  title?: string;
  items: NavItem[];
};

// ─── Platform Nav ─────────────────────────────────────────────────────────────

export const platformNavSections: NavSection[] = [
  {
    id: "main",
    items: [
      { id: "dashboard", label: "Dashboard", href: "/platform", icon: LayoutDashboard },
    ],
  },
  {
    id: "management",
    title: "Management",
    items: [
      { id: "brands", label: "Brands", href: "/platform/brands", icon: FolderOpen },
      { id: "programs", label: "Programs", href: "/platform/programs", icon: Layers },
      { id: "admins", label: "Admins", href: "/platform/admins", icon: UserCheck },
    ],
  },
  {
    id: "financial",
    title: "Financial",
    items: [
      { id: "payment-gateways", label: "Payment Gateways", href: "/platform/payment-gateways", icon: CreditCard },
    ],
  },
  {
    id: "content",
    title: "Content",
    items: [
      { id: "system-announcements", label: "Announcements", href: "/platform/announcements", icon: Bell },
    ],
  },
  {
    id: "insights",
    title: "Insights",
    items: [
      { id: "analytics", label: "Analytics", href: "/platform/analytics", icon: BarChart3 },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    items: [
      { id: "platform-settings", label: "Platform Settings", href: "/platform/settings", icon: Settings },
      { id: "support-access", label: "Support Access", href: "/platform/support-access", icon: ShieldCheck },
    ],
  },
];

// ─── Program Nav ──────────────────────────────────────────────────────────────

/**
 * Hrefs here are relative segments. The AdminShell will prefix them with
 * `/programs/${programId}/` at render time.
 */
export const programNavSections: NavSection[] = [
  {
    id: "main",
    items: [
      { id: "dashboard", label: "Dashboard", href: "", icon: LayoutDashboard },
    ],
  },
  {
    id: "financial",
    title: "Financial",
    items: [
      { id: "payments", label: "Payments", href: "payments", icon: CreditCard },
    ],
  },
  {
    id: "scoring",
    title: "Scoring",
    items: [
      {
        id: "scoring",
        label: "Scoring",
        href: "scoring",
        icon: Trophy,
        children: [
          { id: "scoring-fully-funded", label: "Fully Funded", href: "scoring/fully-funded", icon: FileBadge },
          { id: "scoring-interview", label: "Interview", href: "scoring/interview", icon: MessageSquare },
        ],
      },
    ],
  },
  {
    id: "users",
    title: "User Management",
    items: [
      {
        id: "participants",
        label: "Participants",
        href: "participants",
        icon: UserCheck,
      },
      {
        id: "ambassadors",
        label: "Ambassadors",
        href: "ambassadors",
        icon: UserPlus,
      },
    ],
  },
  {
    id: "media",
    title: "Media",
    items: [
      {
        id: "media-library",
        label: "Media Library",
        href: "media",
        icon: Images,
      },
    ],
  },
  {
    id: "program-content",
    title: "Program Content",
    items: [
      {
        id: "submissions",
        label: "Submissions",
        href: "submissions",
        icon: Inbox,
        children: [
          { id: "submissions-essays", label: "Essays", href: "submissions/essays", icon: FileEdit },
          { id: "submissions-agreement-letters", label: "Agreement Letters", href: "submissions/agreement-letters", icon: FileText },
        ],
      },
      {
        id: "documents",
        label: "Documents",
        href: "documents",
        icon: FileText,
        children: [
          { id: "documents-program-documents", label: "Program Documents", href: "documents/program-documents", icon: FileText },
          { id: "documents-loa-template", label: "LOA Template", href: "documents/loa-template", icon: FileEdit },
          { id: "documents-certificates", label: "Certificates", href: "documents/certificates", icon: FileBadge },
          { id: "documents-program-guidelines", label: "Guidelines", href: "documents/program-guidelines", icon: BookOpen },
        ],
      },
      { id: "announcements", label: "Announcements", href: "announcements", icon: Bell },
      { id: "partnerships", label: "Partnerships", href: "partnerships", icon: Handshake },
      { id: "support-tickets", label: "Support Tickets", href: "support-tickets", icon: LifeBuoy },
    ],
  },
  {
    id: "configuration",
    title: "Configuration",
    items: [
      {
        id: "master-data",
        label: "Master Data",
        href: "master-data",
        icon: Database,
        children: [
          { id: "program-details", label: "Program Details", href: "master-data/program-details", icon: Layers },
          { id: "submission-form", label: "Submission Form", href: "master-data/submission-form", icon: FileEdit },
          { id: "program-payments", label: "Program Payments", href: "master-data/program-payments", icon: DollarSign },
          { id: "payment-methods", label: "Payment Methods", href: "master-data/payment-methods", icon: Wallet },
          { id: "timelines", label: "Timelines", href: "master-data/timelines", icon: Calendar },
          { id: "program-testimonies", label: "Testimonials", href: "master-data/program-testimonies", icon: MessageSquare },
          { id: "video-testimonies", label: "Video Testimonials", href: "master-data/video-testimonies", icon: Video },
          { id: "program-photos", label: "Photos", href: "master-data/program-photos", icon: Image },
          { id: "program-rundowns", label: "Rundowns", href: "master-data/program-rundowns", icon: PlayCircle },
          { id: "program-speakers", label: "Speakers", href: "master-data/program-speakers", icon: Mic },
          { id: "program-awards", label: "Awards", href: "master-data/program-awards", icon: Award },
          { id: "program-certificates", label: "Certificates", href: "master-data/program-certificates", icon: FileBadge },
          { id: "faqs", label: "FAQs", href: "master-data/faqs", icon: HelpCircle },
        ],
      },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    items: [
      {
        id: "settings",
        label: "Settings",
        href: "settings",
        icon: Settings,
        children: [
          { id: "main-configuration", label: "Main Configuration", href: "settings/main-configuration", icon: Settings },
          { id: "admin-management", label: "Admin Management", href: "settings/admin-management", icon: UserCheck },
          { id: "roles-permissions", label: "Roles & Permissions", href: "settings/roles-permissions", icon: Shield },
          { id: "menu-management", label: "Menu Management", href: "settings/menu-management", icon: Menu },
        ],
      },
    ],
  },
];

// Re-export lucide icons used in sidebar chevron (so sidebar doesn't need its own import)
export { ChevronRight };
