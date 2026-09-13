export interface LabelTemplateRecord {
  id: number;
  name: string;
  width_mm: number;
  height_mm: number;
  layout_json: string;
  is_default: number | boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateLabelTemplateDTO {
  name: string;
  width_mm: number;
  height_mm: number;
  layout_json: string;
  is_default?: boolean;
}

export type UpdateLabelTemplateDTO = CreateLabelTemplateDTO;
