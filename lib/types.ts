import type { CategoryKey } from "@/lib/categories";

export type PhotoStatus = "processing" | "ready";

export interface Photo {
  id: string;
  drive_file_id: string;
  drive_name: string | null;
  thumbnail_path: string | null;
  tags: string[] | null;
  category: CategoryKey | null;
  current_folder_id: string | null;
  moved_at: string | null;
  perceptual_hash: string | null;
  duplicate_group_id: string | null;
  status: PhotoStatus;
  picked: boolean;
  picked_at: string | null;
  posted: boolean | null;
  created_at: string;
}
