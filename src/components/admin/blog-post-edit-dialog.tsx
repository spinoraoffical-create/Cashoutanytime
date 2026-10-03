"use client";

import * as React from "react";
import { format } from "date-fns";
import { Loader2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import {
  EntityEditDialog,
  type FieldDef,
  type FieldValue,
} from "@/components/admin/entity-edit-dialog";
import {
  deleteCmsEntityAction,
  fetchBlogPostForEditAction,
  uploadBlogImageAction,
  upsertBlogPostAction,
} from "@/lib/actions/admin/cms";
import { Button } from "@/components/ui/button";

const BLOG_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

function blogStatusFields(p?: {
  seo_title: string | null;
  seo_description: string | null;
  status: string;
  published_at: string | null;
}): FieldDef[] {
  return [
    { name: "seo_title", label: "SEO title", type: "text", defaultValue: p?.seo_title ?? "" },
    {
      name: "seo_description",
      label: "SEO description",
      type: "textarea",
      defaultValue: p?.seo_description ?? "",
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      defaultValue: p?.status ?? "draft",
      options: BLOG_STATUS_OPTIONS,
    },
    {
      name: "published_at",
      label: "Publish date/time (Scheduled only)",
      type: "datetime-local",
      defaultValue: p?.published_at ? format(new Date(p.published_at), "yyyy-MM-dd'T'HH:mm") : "",
    },
  ];
}

export function BlogPostEditDialog({ postId }: { postId: string }) {
  const router = useRouter();
  const [fields, setFields] = React.useState<FieldDef[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function loadFields() {
    if (fields || loading) return fields;
    setLoading(true);
    const result = await fetchBlogPostForEditAction(postId);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return null;
    }
    const p = result.post;
    const next: FieldDef[] = [
      { name: "title", label: "Title", type: "text", defaultValue: p.title },
      { name: "slug", label: "Slug", type: "text", defaultValue: p.slug },
      { name: "excerpt", label: "Excerpt", type: "textarea", defaultValue: p.excerpt ?? "" },
      {
        name: "content",
        label: "Content",
        type: "richtext",
        defaultValue: p.content ?? "",
        onUploadImage: uploadBlogImageAction,
        withSeoPanel: true,
      },
      ...blogStatusFields(p),
    ];
    setFields(next);
    return next;
  }

  if (loading) {
    return (
      <Button variant="ghost" size="icon-sm" disabled aria-label="Loading post">
        <Loader2 className="size-4 animate-spin" aria-hidden />
      </Button>
    );
  }

  if (!fields) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Edit post"
        onClick={() => void loadFields()}
      >
        <Pencil className="size-4" aria-hidden />
      </Button>
    );
  }

  return (
    <EntityEditDialog
      title="Edit post"
      enableAutosave
      dialogClassName="sm:max-w-3xl max-h-[85dvh] overflow-y-auto"
      fields={fields}
      action={async (v: Record<string, FieldValue>) => {
        const result = await upsertBlogPostAction({
          id: postId,
          title: String(v.title),
          slug: String(v.slug),
          excerpt: String(v.excerpt),
          content: String(v.content),
          seo_title: String(v.seo_title ?? ""),
          seo_description: String(v.seo_description ?? ""),
          status: v.status as "draft" | "scheduled" | "published" | "archived",
          published_at: String(v.published_at ?? ""),
        });
        if (result.ok) router.refresh();
        return result;
      }}
    />
  );
}

export function BlogPostDeleteButton({ postId }: { postId: string }) {
  return (
    <ConfirmActionButton
      action={deleteCmsEntityAction.bind(null, "blog_posts", postId)}
      title="Delete post?"
      description="This blog post will be permanently removed."
      confirmLabel="Delete"
    />
  );
}

export function BlogPostCreateDialog() {
  return (
    <EntityEditDialog
      title="New post"
      triggerLabel="New post"
      dialogClassName="sm:max-w-3xl max-h-[85dvh] overflow-y-auto"
      fields={[
        { name: "title", label: "Title", type: "text", defaultValue: "" },
        { name: "slug", label: "Slug", type: "text", defaultValue: "" },
        { name: "excerpt", label: "Excerpt", type: "textarea", defaultValue: "" },
        {
          name: "content",
          label: "Content",
          type: "richtext",
          defaultValue: "",
          onUploadImage: uploadBlogImageAction,
          withSeoPanel: true,
        },
        ...blogStatusFields(),
      ]}
      action={async (v: Record<string, FieldValue>) =>
        upsertBlogPostAction({
          title: String(v.title),
          slug: String(v.slug),
          excerpt: String(v.excerpt),
          content: String(v.content),
          seo_title: String(v.seo_title ?? ""),
          seo_description: String(v.seo_description ?? ""),
          status: v.status as "draft" | "scheduled" | "published" | "archived",
          published_at: String(v.published_at ?? ""),
        })
      }
    />
  );
}
