import { use } from "react";
import BrandDetailPage from "./BrandDetailPage";

export default function BrandDetailRoute({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = use(params);
  return <BrandDetailPage brandId={brandId} />;
}
