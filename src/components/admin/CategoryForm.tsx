"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { InputField, TextAreaField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { InfoBanner } from "@/components/ui/InfoBanner";
import { slugify } from "@/lib/validation/slug";
import type { Category } from "@/types";

export function CategoryForm({ category }: { category?: Category }) {
  const router = useRouter();
  const isEdit = Boolean(category);

  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [description, setDescription] = useState(category?.description ?? "");
  const [displayOrder, setDisplayOrder] = useState(String(category?.displayOrder ?? 0));
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: { name?: string; slug?: string } = {};
    if (!name.trim()) nextErrors.name = "Enter a category name.";
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      nextErrors.slug = "Lowercase letters, numbers and hyphens only.";
    }
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        slug,
        description: description.trim() || null,
        displayOrder: Number(displayOrder) || 0,
        ...(isEdit ? { isActive } : {}),
      };

      const response = await fetch(
        isEdit ? `/api/admin/categories/${category!.id}` : "/api/admin/categories",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        setFormError(
          data.error === "slug_taken"
            ? "That slug is already used by another category."
            : "Something went wrong saving this category.",
        );
        return;
      }

      router.push("/admin/categories");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4" noValidate>
      <InputField
        label="Name"
        required
        value={name}
        onChange={(event) => handleNameChange(event.target.value)}
        error={errors.name}
      />
      <InputField
        label="Slug"
        required
        value={slug}
        onChange={(event) => {
          setSlugTouched(true);
          setSlug(event.target.value.toLowerCase());
        }}
        error={errors.slug}
        hint="Used in menu links, e.g. /menu?category=tiffin."
      />
      <TextAreaField
        label="Description (optional)"
        rows={3}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <InputField
        label="Display order"
        type="number"
        value={displayOrder}
        onChange={(event) => setDisplayOrder(event.target.value)}
        hint="Lower numbers appear first."
      />

      {isEdit && (
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Active (visible on the public menu)
        </label>
      )}

      <div className="flex gap-3">
        <Button type="submit" isLoading={isSubmitting}>
          {isEdit ? "Save changes" : "Create category"}
        </Button>
      </div>

      {formError && <InfoBanner tone="warning">{formError}</InfoBanner>}
    </form>
  );
}
