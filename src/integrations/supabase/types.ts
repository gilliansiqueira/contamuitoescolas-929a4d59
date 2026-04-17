export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          description: string
          id: string
          school_id: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string
          id?: string
          school_id: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          grupo: string
          id: string
          nivel: number
          nome: string
          pai_id: string | null
          school_id: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          grupo?: string
          id?: string
          nivel?: number
          nome: string
          pai_id?: string | null
          school_id: string
          tipo?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          grupo?: string
          id?: string
          nivel?: number
          nome?: string
          pai_id?: string | null
          school_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_pai_id_fkey"
            columns: ["pai_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      conversion_data: {
        Row: {
          contatos: number
          created_at: string
          id: string
          matriculas: number
          month: string
          school_id: string
          tipo: string
        }
        Insert: {
          contatos?: number
          created_at?: string
          id?: string
          matriculas?: number
          month: string
          school_id: string
          tipo?: string
        }
        Update: {
          contatos?: number
          created_at?: string
          id?: string
          matriculas?: number
          month?: string
          school_id?: string
          tipo?: string
        }
        Relationships: []
      }
      conversion_icons: {
        Row: {
          card_key: string
          created_at: string
          file_url: string
          id: string
          school_id: string
        }
        Insert: {
          card_key: string
          created_at?: string
          file_url: string
          id?: string
          school_id: string
        }
        Update: {
          card_key?: string
          created_at?: string
          file_url?: string
          id?: string
          school_id?: string
        }
        Relationships: []
      }
      conversion_template_items: {
        Row: {
          created_at: string
          icon_contatos_url: string | null
          icon_conversao_url: string | null
          icon_matriculas_url: string | null
          id: string
          template_id: string
          thresholds: Json
          tipo: string
        }
        Insert: {
          created_at?: string
          icon_contatos_url?: string | null
          icon_conversao_url?: string | null
          icon_matriculas_url?: string | null
          id?: string
          template_id: string
          thresholds?: Json
          tipo?: string
        }
        Update: {
          created_at?: string
          icon_contatos_url?: string | null
          icon_conversao_url?: string | null
          icon_matriculas_url?: string | null
          id?: string
          template_id?: string
          thresholds?: Json
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversion_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "conversion_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      conversion_templates: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      conversion_thresholds: {
        Row: {
          color: string
          created_at: string
          id: string
          label: string
          max_value: number | null
          min_value: number | null
          school_id: string
          sort_order: number
          tipo: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          label?: string
          max_value?: number | null
          min_value?: number | null
          school_id: string
          sort_order?: number
          tipo?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          label?: string
          max_value?: number | null
          min_value?: number | null
          school_id?: string
          sort_order?: number
          tipo?: string
        }
        Relationships: []
      }
      exclusion_rules: {
        Row: {
          acao: string
          campo: string
          created_at: string
          id: string
          nova_categoria: string | null
          operador: string
          school_id: string
          tipo: string
          valor: string
        }
        Insert: {
          acao: string
          campo: string
          created_at?: string
          id?: string
          nova_categoria?: string | null
          operador: string
          school_id: string
          tipo: string
          valor: string
        }
        Update: {
          acao?: string
          campo?: string
          created_at?: string
          id?: string
          nova_categoria?: string | null
          operador?: string
          school_id?: string
          tipo?: string
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "exclusion_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          categoria: string
          created_at: string
          data: string
          descricao: string
          editado_manualmente: boolean
          id: string
          origem: string
          origem_upload_id: string | null
          school_id: string
          tipo: string
          tipo_original: string | null
          tipo_registro: string
          valor: number
        }
        Insert: {
          categoria?: string
          created_at?: string
          data: string
          descricao?: string
          editado_manualmente?: boolean
          id?: string
          origem: string
          origem_upload_id?: string | null
          school_id: string
          tipo: string
          tipo_original?: string | null
          tipo_registro?: string
          valor?: number
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string
          editado_manualmente?: boolean
          id?: string
          origem?: string
          origem_upload_id?: string | null
          school_id?: string
          tipo?: string
          tipo_original?: string | null
          tipo_registro?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_definitions: {
        Row: {
          created_at: string
          direction: string
          enabled: boolean
          icon_id: string | null
          id: string
          name: string
          school_id: string
          sort_order: number
          value_type: string
        }
        Insert: {
          created_at?: string
          direction?: string
          enabled?: boolean
          icon_id?: string | null
          id?: string
          name: string
          school_id: string
          sort_order?: number
          value_type?: string
        }
        Update: {
          created_at?: string
          direction?: string
          enabled?: boolean
          icon_id?: string | null
          id?: string
          name?: string
          school_id?: string
          sort_order?: number
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_definitions_icon_id_fkey"
            columns: ["icon_id"]
            isOneToOne: false
            referencedRelation: "kpi_icons"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_icons: {
        Row: {
          created_at: string
          file_url: string
          id: string
          name: string
          school_id: string
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          name: string
          school_id: string
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: []
      }
      kpi_template_items: {
        Row: {
          created_at: string
          direction: string
          icon_url: string | null
          id: string
          name: string
          sort_order: number
          template_id: string
          thresholds: Json
          value_type: string
        }
        Insert: {
          created_at?: string
          direction?: string
          icon_url?: string | null
          id?: string
          name: string
          sort_order?: number
          template_id: string
          thresholds?: Json
          value_type?: string
        }
        Update: {
          created_at?: string
          direction?: string
          icon_url?: string | null
          id?: string
          name?: string
          sort_order?: number
          template_id?: string
          thresholds?: Json
          value_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "kpi_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_templates: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      kpi_thresholds: {
        Row: {
          color: string
          created_at: string
          id: string
          kpi_definition_id: string
          label: string
          max_value: number | null
          min_value: number | null
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          kpi_definition_id: string
          label?: string
          max_value?: number | null
          min_value?: number | null
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          kpi_definition_id?: string
          label?: string
          max_value?: number | null
          min_value?: number | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_thresholds_kpi_definition_id_fkey"
            columns: ["kpi_definition_id"]
            isOneToOne: false
            referencedRelation: "kpi_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_values: {
        Row: {
          created_at: string
          id: string
          kpi_definition_id: string
          month: string
          school_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          kpi_definition_id: string
          month: string
          school_id: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          kpi_definition_id?: string
          month?: string
          school_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_values_kpi_definition_id_fkey"
            columns: ["kpi_definition_id"]
            isOneToOne: false
            referencedRelation: "kpi_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      module_tabs: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          school_id: string
          tab_key: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          school_id: string
          tab_key: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          school_id?: string
          tab_key?: string
        }
        Relationships: []
      }
      monthly_revenue: {
        Row: {
          created_at: string
          id: string
          month: string
          school_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          school_id: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          school_id?: string
          value?: number
        }
        Relationships: []
      }
      payment_delay_rules: {
        Row: {
          created_at: string
          forma_cobranca: string
          id: string
          prazo: number
          school_id: string
        }
        Insert: {
          created_at?: string
          forma_cobranca: string
          id?: string
          prazo?: number
          school_id: string
        }
        Update: {
          created_at?: string
          forma_cobranca?: string
          id?: string
          prazo?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_delay_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      realized_entries: {
        Row: {
          complemento: string
          conta_codigo: string
          conta_id: string | null
          conta_nome: string
          created_at: string
          data: string
          descricao: string
          id: string
          origem_arquivo: string
          school_id: string
          tipo: string
          valor: number
        }
        Insert: {
          complemento?: string
          conta_codigo?: string
          conta_id?: string | null
          conta_nome?: string
          created_at?: string
          data: string
          descricao?: string
          id?: string
          origem_arquivo?: string
          school_id: string
          tipo?: string
          valor?: number
        }
        Update: {
          complemento?: string
          conta_codigo?: string
          conta_id?: string | null
          conta_nome?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          origem_arquivo?: string
          school_id?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "realized_entries_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realized_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_card_brands: {
        Row: {
          created_at: string
          icon_url: string | null
          id: string
          name: string
          school_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon_url?: string | null
          id?: string
          name: string
          school_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon_url?: string | null
          id?: string
          name?: string
          school_id?: string
          sort_order?: number
        }
        Relationships: []
      }
      sales_data: {
        Row: {
          brand_id: string | null
          created_at: string
          id: string
          method_key: string
          month: string
          school_id: string
          value: number
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          id?: string
          method_key: string
          month: string
          school_id: string
          value?: number
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          id?: string
          method_key?: string
          month?: string
          school_id?: string
          value?: number
        }
        Relationships: []
      }
      sales_payment_methods: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          label: string
          method_key: string
          school_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          label: string
          method_key: string
          school_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string
          method_key?: string
          school_id?: string
          sort_order?: number
        }
        Relationships: []
      }
      school_kpis: {
        Row: {
          alunos_modalidade: number | null
          created_at: string
          evasao: number | null
          id: string
          inadimplencia: number | null
          lucratividade: number | null
          media_alunos_turma: number | null
          month: string
          school_id: string
        }
        Insert: {
          alunos_modalidade?: number | null
          created_at?: string
          evasao?: number | null
          id?: string
          inadimplencia?: number | null
          lucratividade?: number | null
          media_alunos_turma?: number | null
          month: string
          school_id: string
        }
        Update: {
          alunos_modalidade?: number | null
          created_at?: string
          evasao?: number | null
          id?: string
          inadimplencia?: number | null
          lucratividade?: number | null
          media_alunos_turma?: number | null
          month?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_kpis_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          created_at: string
          id: string
          nome: string
          saldo_inicial: number
          saldo_inicial_data: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          saldo_inicial?: number
          saldo_inicial_data?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          saldo_inicial?: number
          saldo_inicial_data?: string | null
        }
        Relationships: []
      }
      type_classifications: {
        Row: {
          classificacao: string
          created_at: string
          entra_no_resultado: boolean
          id: string
          impacta_caixa: boolean
          label: string
          school_id: string
          tipo_valor: string
        }
        Insert: {
          classificacao?: string
          created_at?: string
          entra_no_resultado?: boolean
          id?: string
          impacta_caixa?: boolean
          label?: string
          school_id: string
          tipo_valor: string
        }
        Update: {
          classificacao?: string
          created_at?: string
          entra_no_resultado?: boolean
          id?: string
          impacta_caixa?: boolean
          label?: string
          school_id?: string
          tipo_valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "type_classifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_records: {
        Row: {
          file_name: string
          id: string
          record_count: number
          school_id: string
          tipo: string
          uploaded_at: string
        }
        Insert: {
          file_name: string
          id?: string
          record_count?: number
          school_id: string
          tipo: string
          uploaded_at?: string
        }
        Update: {
          file_name?: string
          id?: string
          record_count?: number
          school_id?: string
          tipo?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
