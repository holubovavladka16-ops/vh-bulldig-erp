export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type GenericTable = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
  Relationships: []
}

type GenericFunction = {
  Args: Record<string, unknown>
  Returns: unknown
}

export type Database = {
  public: {
    Tables: Record<string, GenericTable>
    Views: Record<string, never>
    Functions: Record<string, GenericFunction>
    Enums: Record<string, string>
    CompositeTypes: Record<string, never>
  }
}
