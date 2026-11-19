// services/admin-dashboard/app/request-access/page.tsx
import type { Metadata } from "next";
import RequestAccessForm from "./RequestAccessForm";

export const metadata: Metadata = { title: "Request access - YBB Admin" };

export default function RequestAccessPage() {
  return <RequestAccessForm />;
}
