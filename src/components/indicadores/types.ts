export interface KpiIcon {
  id: string;
  school_id: string;
  name: string;
  file_url: string;
}

export interface KpiDefinition {
  id: string;
  school_id: string;
  name: string;
  icon_id: string | null;
  value_type: 'percent' | 'currency' | 'number';
  direction: 'higher_is_better' | 'lower_is_better';
  enabled: boolean;
  sort_order: number;
}

export interface KpiThreshold {
  id: string;
  kpi_definition_id: string;
  min_value: number | null;
  max_value: number | null;
  color: string;
  label: string;
  sort_order: number;
}

export interface KpiValue {
  id: string;
  school_id: string;
  kpi_definition_id: string;
  month: string;
  value: number;
}

export interface KpiDefinitionWithThresholds extends KpiDefinition {
  thresholds: KpiThreshold[];
  icon?: KpiIcon;
}
