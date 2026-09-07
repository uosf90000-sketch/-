"use client";
import { useParams } from "next/navigation";
import SpatialWorkspace from "@/components/SpatialWorkspace";
export default function Walk() {
  const { id } = useParams<{ id: string }>();
  return <SpatialWorkspace key={id} id={id} walk />;
}
