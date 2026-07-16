import { use } from "react";
import BrandEditPage from "./BrandEditPage";

export default function BrandEditRoute({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = use(params);
  return <BrandEditPage brandId={brandId} />;
}
