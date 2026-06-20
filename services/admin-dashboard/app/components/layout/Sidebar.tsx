"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import { listProgramSupportTickets } from "@/src/shared/api-client";
import { useAuth } from "@/app/contexts/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import {
  Squares2X2Icon,
  UserGroupIcon,
  UserIcon,
  UserPlusIcon,
  CreditCardIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  InboxStackIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
  DocumentCheckIcon,
  PencilSquareIcon,
  ClipboardDocumentListIcon,
  BellAlertIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/solid";

type SidebarMenuItem = {
  id: string;
  label: string;
  isSubmenu?: boolean;
  parentId?: string;
};

type SidebarSection = {
  id: string;
  title?: string;
  items: SidebarMenuItem[];
};

const sidebarSections: SidebarSection[] = [
  {
    id: "main",
    items: [{ id: "dashboard", label: "Dashboard" }],
  },
  {
    id: "financial",
    title: "Financial",
    items: [{ id: "payments", label: "Payments" }],
  },
  {
    id: "scoring",
    title: "Scoring",
    items: [
      { id: "scoring", label: "Scoring" },
      {
        id: "scoring-fully-funded",
        label: "Fully Funded",
        isSubmenu: true,
        parentId: "scoring",
      },
      {
        id: "scoring-interview",
        label: "Interview",
        isSubmenu: true,
        parentId: "scoring",
      },
    ],
  },
  {
    id: "user-management",
    title: "User Management",
    items: [
      { id: "users", label: "Users" },
      {
        id: "participants",
        label: "Participants",
        isSubmenu: true,
        parentId: "users",
      },
      {
        id: "ambassadors",
        label: "Ambassadors",
        isSubmenu: true,
        parentId: "users",
      },
      { id: "support-tickets", label: "Support Tickets" },
    ],
  },
  {
    id: "program-content",
    title: "Program Content",
    items: [
      { id: "submissions", label: "Submissions" },
      {
        id: "submissions-essays",
        label: "Essays",
        isSubmenu: true,
        parentId: "submissions",
      },
      {
        id: "submissions-agreement-letters",
        label: "Agreement Letters",
        isSubmenu: true,
        parentId: "submissions",
      },
      { id: "documents", label: "Documents" },
      {
        id: "documents-program-documents",
        label: "Program Documents",
        isSubmenu: true,
        parentId: "documents",
      },
      {
        id: "documents-certificates",
        label: "Certificates",
        isSubmenu: true,
        parentId: "documents",
      },
      { id: "announcements", label: "Announcements" },
    ],
  },
  {
    id: "configuration",
    title: "Configuration",
    items: [
      { id: "master-data", label: "Master Data" },
      {
        id: "program-details",
        label: "Program Details",
        isSubmenu: true,
        parentId: "master-data",
      },
      {
        id: "submission-form",
        label: "Submission Form",
        isSubmenu: true,
        parentId: "master-data",
      },
      {
        id: "program-payments",
        label: "Program Payments",
        isSubmenu: true,
        parentId: "master-data",
      },
      {
        id: "payment-methods",
        label: "Payment Methods",
        isSubmenu: true,
        parentId: "master-data",
      },
      {
        id: "timelines",
        label: "Timelines",
        isSubmenu: true,
        parentId: "master-data",
      },
      {
        id: "program-testimonies",
        label: "Program Testimonies",
        isSubmenu: true,
        parentId: "master-data",
      },
      {
        id: "video-testimonies",
        label: "Video Testimonies",
        isSubmenu: true,
        parentId: "master-data",
      },
      {
        id: "program-photos",
        label: "Program Photos",
        isSubmenu: true,
        parentId: "master-data",
      },
      {
        id: "program-rundowns",
        label: "Program Rundowns",
        isSubmenu: true,
        parentId: "master-data",
      },
      {
        id: "program-speakers",
        label: "Program Speakers",
        isSubmenu: true,
        parentId: "master-data",
      },
      {
        id: "program-awards",
        label: "Program Awards",
        isSubmenu: true,
        parentId: "master-data",
      },
      {
        id: "program-certificates",
        label: "Program Certificates",
        isSubmenu: true,
        parentId: "master-data",
      },
      {
        id: "faqs",
        label: "FAQs",
        isSubmenu: true,
        parentId: "master-data",
      },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    items: [
      { id: "settings", label: "Settings" },
      {
        id: "main-configuration",
        label: "Main Configuration",
        isSubmenu: true,
        parentId: "settings",
      },
      {
        id: "admin-management",
        label: "Admin Management",
        isSubmenu: true,
        parentId: "settings",
      },
      {
        id: "roles-permissions",
        label: "Roles & Permissions",
        isSubmenu: true,
        parentId: "settings",
      },
      {
        id: "menu-management",
        label: "Menu Management",
        isSubmenu: true,
        parentId: "settings",
      },
    ],
  },
];

function SidebarIcon({ label }: { label: string }) {
  if (label === "Dashboard") {
    return <Squares2X2Icon className="h-5 w-5 flex-none text-blue-100" />;
  }

  if (label === "Users") {
    return <UserGroupIcon className="h-5 w-5 flex-none text-blue-100" />;
  }

  if (label === "Participants") {
    return <UserIcon className="h-5 w-5 flex-none text-blue-100" />;
  }

  if (label === "Ambassadors") {
    return <UserPlusIcon className="h-5 w-5 flex-none text-blue-100" />;
  }

  if (["Admin Management", "Roles & Permissions"].includes(label)) {
    return <UserGroupIcon className="h-5 w-5 flex-none text-blue-100" />;
  }

  if (["Payments", "Program Payments", "Payment Methods"].includes(label)) {
    return <CreditCardIcon className="h-5 w-5 flex-none text-blue-100" />;
  }

  if (["Scoring", "Fully Funded", "Interview"].includes(label)) {
    if (label === "Scoring") {
      return <ChartBarIcon className="h-5 w-5 flex-none text-blue-100" />;
    }
    if (label === "Fully Funded") {
      return <DocumentCheckIcon className="h-5 w-5 flex-none text-blue-100" />;
    }
    // Bagian Interview
    return <ClipboardDocumentListIcon className="h-5 w-5 flex-none text-blue-100" />;
  }

  if (["Submissions", "Essays", "Agreement Letters"].includes(label)) {
    if (label === "Submissions") {
      return <InboxStackIcon className="h-5 w-5 flex-none text-blue-100" />;
    }
    if (label === "Essays") {
      return <PencilSquareIcon className="h-5 w-5 flex-none text-blue-100" />;
    }
    // Bagian Agreement Letters
    return <ClipboardDocumentListIcon className="h-5 w-5 flex-none text-blue-100" />;
  }

  if (["Documents", "Program Documents", "Certificates", "Program Certificates"].includes(label)) {
    if (label === "Documents") {
      return <DocumentTextIcon className="h-5 w-5 flex-none text-blue-100" />;
    }
    if (label === "Program Documents") {
      return <DocumentDuplicateIcon className="h-5 w-5 flex-none text-blue-100" />;
    }
    // Bagian Certificate atau Program Certificate
    return <DocumentCheckIcon className="h-5 w-5 flex-none text-blue-100" />;
  }

  if (["Announcements"].includes(label)) {
    return <BellAlertIcon className="h-5 w-5 flex-none text-blue-100" />;
  }

  if (label === "Support Tickets") {
    return <InboxStackIcon className="h-5 w-5 flex-none text-blue-100" />;
  }

  if (
    [
      "Settings",
      "Master Data",
      "Main Configuration",
      "Menu Management",
      "Program Details",
      "Submission Form",
      "Timelines",
      "Program Testimonies",
      "Video Testimonies",
      "Program Photos",
      "Program Rundowns",
      "Program Speakers",
      "Program Awards",
      "Program Certificates",
      "FAQs",
    ].includes(label)
  ) {
    return <Cog6ToothIcon className="h-5 w-5 flex-none text-blue-100" />;
  }

  // Default Icon buat item lain (Scoring, Submissions, Documents, Announcements, dll.)
  return <Squares2X2Icon className="h-5 w-5 flex-none text-blue-100" />;
}

export type SidebarProps = {
  collapsed: boolean;
  selectedProgramId: string | null;
};

export function Sidebar({ collapsed, selectedProgramId }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showProgramAlert, setShowProgramAlert] = useState(false);
  const [openTicketCount, setOpenTicketCount] = useState(0);

  // selectedProgramId may be a program slug; the support-ticket API needs the
  // program UUID. Resolve it via the admin's accessible programs.
  const { accessiblePrograms } = useAuth();
  const resolvedProgramId = useMemo(() => {
    if (!selectedProgramId) return null;
    const match = accessiblePrograms.find(
      (program) =>
        program.programId === selectedProgramId || program.programSlug === selectedProgramId,
    );
    return match?.programId ?? selectedProgramId;
  }, [accessiblePrograms, selectedProgramId]);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      if (!resolvedProgramId) {
        if (isMounted) setOpenTicketCount(0);
        return;
      }
      try {
        const response = await listProgramSupportTickets(resolvedProgramId, { status: "open", limit: 1 });
        if (isMounted) setOpenTicketCount(response.meta?.total ?? 0);
      } catch {
        // Non-critical
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [resolvedProgramId]);
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (!pathname) return "dashboard";

    // Cek route yang lagi kebuka, terus samain sama menu yang nyangkut ke program
    if (pathname?.includes("/master-data/program-details")) {
      return "program-details";
    }
    if (pathname?.includes("/master-data/submission-form")) {
      return "submission-form";
    }
    if (pathname?.includes("/master-data/program-payments")) {
      return "program-payments";
    }
    if (pathname?.includes("/master-data/payment-methods")) {
      return "payment-methods";
    }
    if (pathname?.includes("/master-data/timelines")) {
      return "timelines";
    }
    if (pathname?.includes("/master-data/program-testimonies")) {
      return "program-testimonies";
    }
    if (pathname?.includes("/master-data/video-testimonies")) {
      return "video-testimonies";
    }
    if (pathname?.includes("/master-data/program-photos")) {
      return "program-photos";
    }
    if (pathname?.includes("/master-data/program-rundowns")) {
      return "program-rundowns";
    }
    if (pathname?.includes("/master-data/program-speakers")) {
      return "program-speakers";
    }
    if (pathname?.includes("/master-data/program-awards")) {
      return "program-awards";
    }
    if (pathname?.includes("/master-data/program-certificates")) {
      return "program-certificates";
    }
    if (pathname?.includes("/master-data/faqs")) {
      return "faqs";
    }
    if (pathname.includes("/announcements")) {
      return "announcements";
    }
    if (pathname.includes("/participants")) {
      return "participants";
    }
    if (pathname.includes("/ambassadors")) {
      return "ambassadors";
    }
    if (pathname.includes("/support-tickets")) {
      return "support-tickets";
    }
    if (pathname.includes("/submissions/essays")) {
      return "submissions-essays";
    }
    if (pathname.includes("/submissions/agreement-letters")) {
      return "submissions-agreement-letters";
    }
    if (pathname.includes("/submissions")) {
      return "submissions";
    }
    if (pathname.includes("/documents/program-documents")) {
      return "documents-program-documents";
    }
    if (pathname.includes("/documents")) {
      return "documents";
    }
    if (pathname.includes("/users")) {
      return "users";
    }
    if (pathname.includes("/scoring/fully-funded")) {
      return "scoring-fully-funded";
    }
    if (pathname.includes("/scoring/interview")) {
      return "scoring-interview";
    }
    if (pathname.includes("/scoring")) {
      return "scoring";
    }
    if (pathname.includes("/payments")) {
      return "payments";
    }
    if (pathname.includes("/settings/main-configuration")) {
      return "main-configuration";
    }
    if (pathname.includes("/settings/admin-management")) {
      return "admin-management";
    }
    if (pathname.includes("/settings/roles-permissions")) {
      return "roles-permissions";
    }
    if (pathname.includes("/programs/")) {
      return "dashboard";
    }
    return "dashboard";
  });
  const [openParents, setOpenParents] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (pathname?.includes("/scoring")) {
      initial["scoring"] = true;
    }
    if (
      pathname?.includes("/users") ||
      pathname?.includes("/participants") ||
      pathname?.includes("/ambassadors")
    ) {
      initial["users"] = true;
    }
    if (pathname?.includes("/submissions")) {
      initial["submissions"] = true;
    }
    if (pathname?.includes("/documents")) {
      initial["documents"] = true;
    }
    if (pathname?.includes("/settings")) {
      initial["settings"] = true;
    }
    if (
      pathname?.includes("/master-data/program-details") ||
      pathname?.includes("/master-data/submission-form") ||
      pathname?.includes("/master-data/program-payments") ||
      pathname?.includes("/master-data/payment-methods") ||
      pathname?.includes("/master-data/timelines") ||
      pathname?.includes("/master-data/program-testimonies") ||
      pathname?.includes("/master-data/video-testimonies") ||
      pathname?.includes("/master-data/program-photos") ||
      pathname?.includes("/master-data/program-rundowns") ||
      pathname?.includes("/master-data/program-speakers") ||
      pathname?.includes("/master-data/program-awards") ||
      pathname?.includes("/master-data/program-certificates") ||
      pathname?.includes("/master-data/faqs")
    ) {
      initial["master-data"] = true;
    }
    if (pathname?.includes("/announcements")) {
      initial["announcements"] = true;
    }
    return initial;
  });

  function handleClickItem(item: SidebarMenuItem, options?: { setActive?: boolean }) {
    if (!selectedProgramId) {
      setShowProgramAlert(true);
      return;
    }

    // TODO: nanti ganti sama navigasi ke halaman sesuai menunya
    console.info(
      "Sidebar menu clicked:",
      item.id,
      "(",
      item.label,
      ") for program",
      selectedProgramId,
    );

    // Navigasi ke halaman yang udah di-scope ke program yang lagi dipilih
    if (item.id === "dashboard") {
      router.push(`/programs/${selectedProgramId}`);
    } else if (item.id === "payments") {
      router.push(`/programs/${selectedProgramId}/payments`);
    } else if (item.id === "scoring") {
      router.push(`/programs/${selectedProgramId}/scoring`);
    } else if (item.id === "scoring-fully-funded") {
      router.push(`/programs/${selectedProgramId}/scoring/fully-funded`);
    } else if (item.id === "scoring-interview") {
      router.push(`/programs/${selectedProgramId}/scoring/interview`);
    } else if (item.id === "users") {
      router.push(`/programs/${selectedProgramId}/users`);
    } else if (item.id === "participants") {
      router.push(`/programs/${selectedProgramId}/participants`);
    } else if (item.id === "ambassadors") {
      router.push(`/programs/${selectedProgramId}/ambassadors`);
    } else if (item.id === "support-tickets") {
      router.push(`/programs/${selectedProgramId}/support-tickets`);
    } else if (item.id === "submissions") {
      router.push(`/programs/${selectedProgramId}/submissions`);
    } else if (item.id === "submissions-essays") {
      router.push(`/programs/${selectedProgramId}/submissions/essays`);
    } else if (item.id === "submissions-agreement-letters") {
      router.push(`/programs/${selectedProgramId}/submissions/agreement-letters`);
    } else if (item.id === "documents") {
      router.push(`/programs/${selectedProgramId}/documents`);
    } else if (item.id === "documents-program-documents") {
      router.push(`/programs/${selectedProgramId}/documents/program-documents`);
    } else if (item.id === "documents-certificates") {
      router.push(`/programs/${selectedProgramId}/documents/certificates`);
    } else if (item.id === "announcements") {
      router.push(`/programs/${selectedProgramId}/announcements`);
    } else if (item.id === "master-data") {
      router.push(`/programs/${selectedProgramId}/master-data/program-details`);
    } else if (item.id === "program-details") {
      router.push(`/programs/${selectedProgramId}/master-data/program-details`);
    } else if (item.id === "submission-form") {
      router.push(`/programs/${selectedProgramId}/master-data/submission-form`);
    } else if (item.id === "program-payments") {
      router.push(`/programs/${selectedProgramId}/master-data/program-payments`);
    } else if (item.id === "payment-methods") {
      router.push(`/programs/${selectedProgramId}/master-data/payment-methods`);
    } else if (item.id === "timelines") {
      router.push(`/programs/${selectedProgramId}/master-data/timelines`);
    } else if (item.id === "program-testimonies") {
      router.push(`/programs/${selectedProgramId}/master-data/program-testimonies`);
    } else if (item.id === "video-testimonies") {
      router.push(`/programs/${selectedProgramId}/master-data/video-testimonies`);
    } else if (item.id === "program-photos") {
      router.push(`/programs/${selectedProgramId}/master-data/program-photos`);
    } else if (item.id === "program-rundowns") {
      router.push(`/programs/${selectedProgramId}/master-data/program-rundowns`);
    } else if (item.id === "program-speakers") {
      router.push(`/programs/${selectedProgramId}/master-data/program-speakers`);
    } else if (item.id === "program-awards") {
      router.push(`/programs/${selectedProgramId}/master-data/program-awards`);
    } else if (item.id === "program-certificates") {
      router.push(`/programs/${selectedProgramId}/master-data/program-certificates`);
    } else if (item.id === "faqs") {
      router.push(`/programs/${selectedProgramId}/master-data/faqs`);
    } else if (item.id === "main-configuration") {
      router.push(`/programs/${selectedProgramId}/settings/main-configuration`);
    } else if (item.id === "admin-management") {
      router.push(`/programs/${selectedProgramId}/settings/admin-management`);
    } else if (item.id === "roles-permissions") {
      router.push(`/programs/${selectedProgramId}/settings/roles-permissions`);
    } else if (item.id === "menu-management") {
      router.push(`/programs/${selectedProgramId}/settings/menu-management`);
    }
    if (options?.setActive !== false) {
      setActiveId(item.id);
    }
  }
  return (
    <aside
      className={`flex h-screen flex-col bg-blue-800 text-white transition-all duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-4 border-b border-blue-500">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded">
          <Image
            src="/img/logosYBB.webp"
            alt="YBB Platform logo"
            width={36}
            height={36}
            className="object-contain"
          />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold">YBB Platform</span>
            <span className="text-[13px] text-blue-100">Admin Dashboard</span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4 text-[15px]">
        {sidebarSections.map((section) => (
          <div key={section.id} className="space-y-1.5">
            {section.title && !collapsed && (
              <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-blue-100/70">
                {section.title}
              </div>
            )}

            {section.items
              .filter((item) => !item.isSubmenu)
              .map((item) => {
                const isActive = selectedProgramId && activeId === item.id;
                const children = section.items.filter(
                  (child) => child.isSubmenu && child.parentId === item.id,
                );
                const isOpen = openParents[item.id] ?? false;

                const handleClickParent = () => {
                  if (children.length > 0) {
                    // Menu yang ada submenunya, cuma buat pembuka dropdown
                    setOpenParents((previous) => ({
                      ...previous,
                      [item.id]: !previous[item.id],
                    }));
                  } else {
                    // Menu yang gk ada submenu, kaya menu biasa aja
                    handleClickItem(item);
                  }
                };

                return (
                  <div key={item.id} className="space-y-1">
                    <button
                      type="button"
                      className={`flex w-full items-center rounded-md px-3 py-2.5 text-left transition-colors ${
                        isActive
                          ? "bg-blue-500 text-white shadow-sm"
                          : "text-blue-100 hover:bg-blue-500/60 hover:text-white"
                      }`}
                      onClick={handleClickParent}
                    >
                      <span className="mr-2 flex-none">
                        <SidebarIcon label={item.label} />
                      </span>
                      <span className={collapsed ? "sr-only" : "flex items-center gap-2"}>
                        {item.label}
                        {item.id === "support-tickets" && openTicketCount > 0 && !collapsed ? (
                          <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                            {openTicketCount > 99 ? "99+" : openTicketCount}
                          </span>
                        ) : null}
                      </span>
                      {children.length > 0 && !collapsed && (
                        <span className="ml-auto flex-none text-blue-100">
                          {isOpen ? (
                            <ChevronDownIcon className="h-4 w-4" />
                          ) : (
                            <ChevronRightIcon className="h-4 w-4" />
                          )}
                        </span>
                      )}
                    </button>

                    {children.length > 0 && isOpen && (
                      <div className="space-y-0.5 border-l border-blue-500/40 pl-4">
                        {children.map((child) => {
                          const isChildActive = selectedProgramId && activeId === child.id;

                          return (
                            <button
                              key={child.id}
                              type="button"
                              className={`flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                                isChildActive
                                  ? "bg-blue-500/80 text-white shadow-sm"
                                  : "text-blue-100/90 hover:bg-blue-500/60 hover:text-white"
                              }`}
                              onClick={() => handleClickItem(child)}
                            >
                              <span className="mr-2 h-1.5 w-1.5 flex-none rounded-full bg-blue-100" />
                              <span className={collapsed ? "sr-only" : ""}>{child.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </nav>

      {showProgramAlert && !collapsed && (
        <div className="mx-3 mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 shadow-sm transition-all duration-200 ease-out animate-[fadeIn_0.18s_ease-out]">
          <div className="flex items-start justify-between gap-2">
            <span>
              Pilih program terlebih dahulu di bagian atas sebelum mengakses menu
              di sidebar.
            </span>
            <button
              type="button"
              className="ml-1 text-[11px] font-semibold text-amber-700 hover:text-amber-900"
              onClick={() => setShowProgramAlert(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-blue-500 px-4 py-3 text-xs text-blue-100">
        {!collapsed && (
          <>
            <div>Made by</div>
            <div className="text-sm font-medium text-white">Hilmi Farrel Firjatullah :D</div>
          </>
        )}
      </div>
    </aside>
  );
}
