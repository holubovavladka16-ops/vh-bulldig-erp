export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenericTable = {
  Row: any
  Insert: any
  Update: any
  Relationships: []
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenericFunction = {
  Args: any
  Returns: any
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
