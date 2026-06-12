import type { ContentTag } from "@/lib/tags";

export type PhotoStatus = "processing" | "ready";

export interface Photo {
  id: string;
  drive_file_id: string;
  drive_name: string | null;
  thumbnail_path: string | null;
  tags: ContentTag[] | null;
  perceptual_hash: string | null;
  duplicate_group_id: string | null;
  status: PhotoStatus;
  picked: boolean;
  picked_at: string | null;
  posted: boolean | null;
  created_at: string;
}
