// types/database.ts
// Handwritten type stub — mirrors supabase/migrations/20260310000000_initial_schema.sql
// Re-generate via `npx supabase gen types typescript --project-id <ref>` after schema is finalized.
// Note: GenericTable (supabase-js v2.99+) requires Row, Insert, Update, and Relationships fields.

export type LeaveType =
  | 'sick'
  | 'personal'
  | 'vacation'
  | 'bereavement'
  | 'jury_duty'
  | 'professional_development'
  | 'maternity_paternity'

export type RequestStatus = 'pending' | 'approved' | 'denied' | 'auto_denied'

export type Database = {
  public: {
    Tables: {
      requests: {
        Row: {
          id: string
          teacher_name: string
          teacher_email: string
          leave_type: LeaveType
          start_date: string
          end_date: string
          reason: string | null
          is_blackout: boolean
          status: RequestStatus
          submitted_at: string
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          id?: string
          teacher_name: string
          teacher_email: string
          leave_type: LeaveType
          start_date: string
          end_date: string
          reason?: string | null
          is_blackout: boolean
          status?: RequestStatus
          submitted_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          id?: string
          teacher_name?: string
          teacher_email?: string
          leave_type?: LeaveType
          start_date?: string
          end_date?: string
          reason?: string | null
          is_blackout?: boolean
          status?: RequestStatus
          submitted_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: []
      }
      blackout_dates: {
        Row: {
          id: string
          label: string
          start_date: string
          end_date: string
          created_at: string
        }
        Insert: {
          id?: string
          label: string
          start_date: string
          end_date: string
          created_at?: string
        }
        Update: {
          id?: string
          label?: string
          start_date?: string
          end_date?: string
          created_at?: string
        }
        Relationships: []
      }
      rate_limit_log: {
        Row: {
          id: number
          key: string
          occurred_at: string
        }
        Insert: {
          id?: number
          key: string
          occurred_at?: string
        }
        Update: {
          id?: number
          key?: string
          occurred_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      leave_type: LeaveType
      request_status: RequestStatus
    }
  }
}
