"use client";
import { useParams } from "next/navigation";
import SpatialWorkspace from "@/components/SpatialWorkspace";
export default function Materials() {
  const { id } = useParams<{ id: string }>();
  return <SpatialWorkspace id={id} initialShopping />;
}
