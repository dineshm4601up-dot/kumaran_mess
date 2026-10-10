"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { InputField, SelectField, TextAreaField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { InfoBanner } from "@/components/ui/InfoBanner";
import { getProductImageUrl } from "@/lib/image-url";
import type { Category, Product } from "@/types";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ProductForm({
  product,
  categories,
}: {
  product?: Product;
  categories: Category[];
}) {
  const router = useRouter();
  const isEdit = Boolean(product);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? "");
  const [stockQuantity, setStockQuantity] = useState(product ? String(product.stock) : "0");
  const [isAvailable, setIsAvailable] = useState(product?.isAvailable ?? true);
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [displayOrder, setDisplayOrder] = useState(String(product?.displayOrder ?? 0));

  const [currentImagePath, setCurrentImagePath] = useState(product?.imagePath ?? null);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isRemovingImage, setIsRemovingImage] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setImageError(null);

    if (!file) {
      setStagedFile(null);
      setPreviewUrl(null);
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setImageError("Only JPEG, PNG or WEBP images are allowed.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image must be 5MB or smaller.");
      event.target.value = "";
      return;
    }

    setStagedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleRemoveImage() {
    if (!product) {
      // Not yet saved — just clear the staged file.
      setStagedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsRemovingImage(true);
    try {
      const response = await fetch(`/api/admin/products/${product.id}/image`, { method: "DELETE" });
      if (response.ok) {
        setCurrentImagePath(null);
        setStagedFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setImageError("Couldn't remove the image. Please try again.");
      }
    } finally {
      setIsRemovingImage(false);
    }
  }

  async function uploadStagedImage(productId: string) {
    if (!stagedFile) return true;
    const formData = new FormData();
    formData.append("file", stagedFile);
    const response = await fetch(`/api/admin/products/${productId}/image`, {
      method: "POST",
      body: formData,
    });
    return response.ok;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Enter a product name.";
    if (!categoryId) nextErrors.categoryId = "Choose a category.";
    const priceValue = Number(price);
    if (!Number.isFinite(priceValue) || priceValue < 0) nextErrors.price = "Enter a valid price.";
    const stockValue = Number(stockQuantity);
    if (!Number.isFinite(stockValue) || stockValue < 0) nextErrors.stockQuantity = "Enter a valid stock count.";
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price: priceValue,
        categoryId,
        stockQuantity: Math.trunc(stockValue),
        isAvailable,
        isActive,
        isFeatured,
        displayOrder: Math.trunc(Number(displayOrder)) || 0,
      };

      const response = await fetch(isEdit ? `/api/admin/products/${product!.id}` : "/api/admin/products", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setFormError("Something went wrong saving this product.");
        return;
      }

      const productId = isEdit ? product!.id : data.id;
      const imageUploadOk = await uploadStagedImage(productId);

      if (!imageUploadOk) {
        setFormError("The product saved, but the image upload failed. Edit the product to try again.");
      }

      router.push("/admin/products");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  const displayImageUrl = previewUrl ?? getProductImageUrl(currentImagePath);

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-4" noValidate>
      <InputField
        label="Name"
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={errors.name}
      />

      <TextAreaField
        label="Description (optional)"
        rows={3}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />

      <div className="grid grid-cols-2 gap-4">
        <InputField
          label="Price (₹)"
          required
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          error={errors.price}
        />
        <InputField
          label="Stock quantity"
          required
          type="number"
          min="0"
          step="1"
          value={stockQuantity}
          onChange={(event) => setStockQuantity(event.target.value)}
          error={errors.stockQuantity}
        />
      </div>

      <SelectField
        label="Category"
        required
        value={categoryId}
        onChange={(event) => setCategoryId(event.target.value)}
        error={errors.categoryId}
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </SelectField>

      <div>
        <label htmlFor="product-image-input" className="text-sm font-medium text-foreground">
          Product image
        </label>
        <div className="mt-2 flex items-start gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-surface-muted">
            <Image src={displayImageUrl} alt="" fill sizes="96px" className="object-cover" unoptimized />
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              id="product-image-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="text-sm text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">JPEG, PNG or WEBP, up to 5MB.</p>
            {imageError && <p className="text-sm text-danger">{imageError}</p>}
            {(currentImagePath || stagedFile) && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                isLoading={isRemovingImage}
                onClick={handleRemoveImage}
              >
                Remove image
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <InputField
          label="Display order"
          type="number"
          value={displayOrder}
          onChange={(event) => setDisplayOrder(event.target.value)}
          hint="Lower numbers appear first."
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(event) => setIsAvailable(event.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Available to order right now
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(event) => setIsFeatured(event.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Featured on the homepage
        </label>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Active (visible on the public menu at all)
          </label>
        )}
      </div>

      <div className="flex gap-3">
        <Button type="submit" isLoading={isSubmitting}>
          {isEdit ? "Save changes" : "Create product"}
        </Button>
      </div>

      {formError && <InfoBanner tone="warning">{formError}</InfoBanner>}
    </form>
  );
}
