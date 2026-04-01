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
