import type { Metadata } from "next";
import { CategoryForm } from "@/components/admin/CategoryForm";

export const metadata: Metadata = {
  title: "Add Category",
};

export default function NewCategoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">Add Category</h1>
      <CategoryForm />
    </div>
  );
}
