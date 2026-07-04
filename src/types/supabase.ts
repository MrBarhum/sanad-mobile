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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      care_appointments: {
        Row: {
          appointment_type: Database["public"]["Enums"]["care_appointment_type"]
          assigned_to: string | null
          circle_id: string
          created_at: string
          created_by: string | null
          doctor_id: string | null
          ends_at: string | null
          id: string
          location: string | null
          notes: string | null
          starts_at: string
          status: Database["public"]["Enums"]["care_appointment_status"]
          title: string
          updated_at: string
        }
        Insert: {
          appointment_type?: Database["public"]["Enums"]["care_appointment_type"]
          assigned_to?: string | null
          circle_id: string
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["care_appointment_status"]
          title: string
          updated_at?: string
        }
        Update: {
          appointment_type?: Database["public"]["Enums"]["care_appointment_type"]
          assigned_to?: string | null
          circle_id?: string
          created_at?: string
          created_by?: string | null
          doctor_id?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["care_appointment_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_appointments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_appointments_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "care_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      care_circles: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_circles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      care_recipients: {
        Row: {
          allergies: string | null
          birth_date: string | null
          blood_type: string | null
          chronic_conditions: string | null
          circle_id: string
          created_at: string
          dialect: string | null
          emergency_notes: string | null
          full_name: string
          id: string
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          allergies?: string | null
          birth_date?: string | null
          blood_type?: string | null
          chronic_conditions?: string | null
          circle_id: string
          created_at?: string
          dialect?: string | null
          emergency_notes?: string | null
          full_name: string
          id?: string
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          allergies?: string | null
          birth_date?: string | null
          blood_type?: string | null
          chronic_conditions?: string | null
          circle_id?: string
          created_at?: string
          dialect?: string | null
          emergency_notes?: string | null
          full_name?: string
          id?: string
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_recipients_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: true
            referencedRelation: "care_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      care_tasks: {
        Row: {
          assigned_to: string | null
          cancelled_at: string | null
          category: Database["public"]["Enums"]["care_task_category"]
          circle_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          due_time: string | null
          id: string
          notes: string | null
          priority: Database["public"]["Enums"]["care_task_priority"]
          status: Database["public"]["Enums"]["care_task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          cancelled_at?: string | null
          category?: Database["public"]["Enums"]["care_task_category"]
          circle_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["care_task_priority"]
          status?: Database["public"]["Enums"]["care_task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          cancelled_at?: string | null
          category?: Database["public"]["Enums"]["care_task_category"]
          circle_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["care_task_priority"]
          status?: Database["public"]["Enums"]["care_task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_tasks_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "care_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          circle_id: string
          code_hash: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          invited_email: string | null
          invited_name: string | null
          role: Database["public"]["Enums"]["circle_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          circle_id: string
          code_hash: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          invited_email?: string | null
          invited_name?: string | null
          role: Database["public"]["Enums"]["circle_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          circle_id?: string
          code_hash?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          invited_email?: string | null
          invited_name?: string | null
          role?: Database["public"]["Enums"]["circle_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_invitations_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "care_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_members: {
        Row: {
          circle_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["circle_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["circle_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["circle_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "care_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_care_logs: {
        Row: {
          activity_notes: string | null
          appetite: Database["public"]["Enums"]["appetite_level"] | null
          bathroom_notes: string | null
          circle_id: string
          created_at: string
          food_notes: string | null
          general_notes: string | null
          hydration: Database["public"]["Enums"]["hydration_level"] | null
          id: string
          log_date: string
          mobility: Database["public"]["Enums"]["mobility_level"] | null
          mood: Database["public"]["Enums"]["daily_mood"] | null
          pain_level: number | null
          recorded_by: string | null
          sleep_quality: Database["public"]["Enums"]["sleep_quality"] | null
          updated_at: string
        }
        Insert: {
          activity_notes?: string | null
          appetite?: Database["public"]["Enums"]["appetite_level"] | null
          bathroom_notes?: string | null
          circle_id: string
          created_at?: string
          food_notes?: string | null
          general_notes?: string | null
          hydration?: Database["public"]["Enums"]["hydration_level"] | null
          id?: string
          log_date?: string
          mobility?: Database["public"]["Enums"]["mobility_level"] | null
          mood?: Database["public"]["Enums"]["daily_mood"] | null
          pain_level?: number | null
          recorded_by?: string | null
          sleep_quality?: Database["public"]["Enums"]["sleep_quality"] | null
          updated_at?: string
        }
        Update: {
          activity_notes?: string | null
          appetite?: Database["public"]["Enums"]["appetite_level"] | null
          bathroom_notes?: string | null
          circle_id?: string
          created_at?: string
          food_notes?: string | null
          general_notes?: string | null
          hydration?: Database["public"]["Enums"]["hydration_level"] | null
          id?: string
          log_date?: string
          mobility?: Database["public"]["Enums"]["mobility_level"] | null
          mood?: Database["public"]["Enums"]["daily_mood"] | null
          pain_level?: number | null
          recorded_by?: string | null
          sleep_quality?: Database["public"]["Enums"]["sleep_quality"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_care_logs_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "care_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_care_logs_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          circle_id: string
          clinic_name: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          specialty: string | null
          updated_at: string
        }
        Insert: {
          circle_id: string
          clinic_name?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          circle_id?: string
          clinic_name?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          specialty?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctors_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "care_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          circle_id: string
          created_at: string
          id: string
          is_primary: boolean
          name: string
          notes: string | null
          phone: string
          relationship: string | null
          updated_at: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          notes?: string | null
          phone: string
          relationship?: string | null
          updated_at?: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          notes?: string | null
          phone?: string
          relationship?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "care_circles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_visits: {
        Row: {
          circle_id: string
          created_at: string
          created_by: string | null
          end_time: string | null
          id: string
          notes: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["family_visit_status"]
          updated_at: string
          visit_date: string
          visitor_name: string
          visitor_user_id: string | null
        }
        Insert: {
          circle_id: string
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["family_visit_status"]
          updated_at?: string
          visit_date: string
          visitor_name: string
          visitor_user_id?: string | null
        }
        Update: {
          circle_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          id?: string
          notes?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["family_visit_status"]
          updated_at?: string
          visit_date?: string
          visitor_name?: string
          visitor_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_visits_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "care_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_visits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_visits_visitor_user_id_fkey"
            columns: ["visitor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_logs: {
        Row: {
          circle_id: string
          created_at: string
          dose_date: string
          id: string
          medication_id: string
          note: string | null
          recorded_at: string
          recorded_by: string | null
          schedule_id: string | null
          scheduled_time: string
          status: Database["public"]["Enums"]["medication_log_status"]
          updated_at: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          dose_date: string
          id?: string
          medication_id: string
          note?: string | null
          recorded_at?: string
          recorded_by?: string | null
          schedule_id?: string | null
          scheduled_time: string
          status: Database["public"]["Enums"]["medication_log_status"]
          updated_at?: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          dose_date?: string
          id?: string
          medication_id?: string
          note?: string | null
          recorded_at?: string
          recorded_by?: string | null
          schedule_id?: string | null
          scheduled_time?: string
          status?: Database["public"]["Enums"]["medication_log_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_logs_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "care_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_logs_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_logs_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "medication_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_schedules: {
        Row: {
          circle_id: string
          created_at: string
          days_of_week: number[]
          end_date: string | null
          id: string
          is_active: boolean
          medication_id: string
          notes: string | null
          start_date: string
          times: string[]
          updated_at: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          days_of_week?: number[]
          end_date?: string | null
          id?: string
          is_active?: boolean
          medication_id: string
          notes?: string | null
          start_date?: string
          times: string[]
          updated_at?: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          days_of_week?: number[]
          end_date?: string | null
          id?: string
          is_active?: boolean
          medication_id?: string
          notes?: string | null
          start_date?: string
          times?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_schedules_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "care_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_schedules_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          circle_id: string
          created_at: string
          dosage: string | null
          form: string | null
          id: string
          instructions: string | null
          is_active: boolean
          name: string
          photo_url: string | null
          responsible_user_id: string | null
          updated_at: string
          with_food: boolean
        }
        Insert: {
          circle_id: string
          created_at?: string
          dosage?: string | null
          form?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          name: string
          photo_url?: string | null
          responsible_user_id?: string | null
          updated_at?: string
          with_food?: boolean
        }
        Update: {
          circle_id?: string
          created_at?: string
          dosage?: string | null
          form?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          name?: string
          photo_url?: string | null
          responsible_user_id?: string | null
          updated_at?: string
          with_food?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "medications_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "care_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          attempt_count: number
          available_at: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          last_error: string | null
          notification_id: string
          status: Database["public"]["Enums"]["notification_outbox_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          last_error?: string | null
          notification_id: string
          status?: Database["public"]["Enums"]["notification_outbox_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          last_error?: string | null
          notification_id?: string
          status?: Database["public"]["Enums"]["notification_outbox_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          activity_updates: boolean
          appointment_reminders: boolean
          assignment_alerts: boolean
          available_to_claim_digest: boolean
          care_updates: boolean
          circle_id: string | null
          created_at: string
          emergency_alerts: boolean
          id: string
          medication_reminders: boolean
          missed_dose_alerts: boolean
          quiet_hours_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          remote_summary: boolean
          task_reminders: boolean
          timezone: string | null
          updated_at: string
          user_id: string
          visit_reminders: boolean
          visit_updates: boolean
        }
        Insert: {
          activity_updates?: boolean
          appointment_reminders?: boolean
          assignment_alerts?: boolean
          available_to_claim_digest?: boolean
          care_updates?: boolean
          circle_id?: string | null
          created_at?: string
          emergency_alerts?: boolean
          id?: string
          medication_reminders?: boolean
          missed_dose_alerts?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          remote_summary?: boolean
          task_reminders?: boolean
          timezone?: string | null
          updated_at?: string
          user_id: string
          visit_reminders?: boolean
          visit_updates?: boolean
        }
        Update: {
          activity_updates?: boolean
          appointment_reminders?: boolean
          assignment_alerts?: boolean
          available_to_claim_digest?: boolean
          care_updates?: boolean
          circle_id?: string | null
          created_at?: string
          emergency_alerts?: boolean
          id?: string
          medication_reminders?: boolean
          missed_dose_alerts?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          remote_summary?: boolean
          task_reminders?: boolean
          timezone?: string | null
          updated_at?: string
          user_id?: string
          visit_reminders?: boolean
          visit_updates?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "care_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_push_deliveries: {
        Row: {
          attempt_count: number
          available_at: string
          claim_token: string | null
          created_at: string
          error_code: string | null
          expo_ticket_id: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          outbox_id: string
          push_token_id: string
          receipt_id: string | null
          receipt_status: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          claim_token?: string | null
          created_at?: string
          error_code?: string | null
          expo_ticket_id?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          outbox_id: string
          push_token_id: string
          receipt_id?: string | null
          receipt_status?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          claim_token?: string | null
          created_at?: string
          error_code?: string | null
          expo_ticket_id?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          outbox_id?: string
          push_token_id?: string
          receipt_id?: string | null
          receipt_status?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_push_deliveries_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "notification_outbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_push_deliveries_push_token_id_fkey"
            columns: ["push_token_id"]
            isOneToOne: false
            referencedRelation: "push_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          circle_id: string | null
          created_at: string
          data: Json
          dedupe_key: string | null
          deep_link: string | null
          expires_at: string | null
          id: string
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body: string
          circle_id?: string | null
          created_at?: string
          data?: Json
          dedupe_key?: string | null
          deep_link?: string | null
          expires_at?: string | null
          id?: string
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string
          circle_id?: string | null
          created_at?: string
          data?: Json
          dedupe_key?: string | null
          deep_link?: string | null
          expires_at?: string | null
          id?: string
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "care_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          dialect: string | null
          full_name: string | null
          id: string
          locale: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          dialect?: string | null
          full_name?: string | null
          id: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          dialect?: string | null
          full_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          app_version: string | null
          created_at: string
          device_id: string | null
          expo_push_token: string
          id: string
          is_active: boolean
          last_seen_at: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_id?: string | null
          expo_push_token: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_id?: string | null
          expo_push_token?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vital_readings: {
        Row: {
          circle_id: string
          created_at: string
          diastolic: number | null
          id: string
          notes: string | null
          numeric_value: number | null
          reading_at: string
          reading_type: Database["public"]["Enums"]["vital_reading_type"]
          recorded_by: string | null
          systolic: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          diastolic?: number | null
          id?: string
          notes?: string | null
          numeric_value?: number | null
          reading_at?: string
          reading_type: Database["public"]["Enums"]["vital_reading_type"]
          recorded_by?: string | null
          systolic?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          diastolic?: number | null
          id?: string
          notes?: string | null
          numeric_value?: number | null
          reading_at?: string
          reading_type?: Database["public"]["Enums"]["vital_reading_type"]
          recorded_by?: string | null
          systolic?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vital_readings_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "care_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vital_readings_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_circle_invitation: {
        Args: { p_code: string }
        Returns: {
          circle_id: string
          membership_id: string
          role: Database["public"]["Enums"]["circle_role"]
        }[]
      }
      active_circle_member_role: {
        Args: { p_circle_id: string }
        Returns: Database["public"]["Enums"]["circle_role"]
      }
      can_view_all_operational: {
        Args: { p_circle_id: string }
        Returns: boolean
      }
      circle_notification_recipients: {
        Args: {
          p_circle_id: string
          p_type: Database["public"]["Enums"]["notification_type"]
        }
        Returns: {
          quiet_hours_enabled: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          timezone: string
          user_id: string
        }[]
      }
      claim_care_appointment: {
        Args: { p_appointment_id: string }
        Returns: {
          appointment_type: Database["public"]["Enums"]["care_appointment_type"]
          assigned_to: string | null
          circle_id: string
          created_at: string
          created_by: string | null
          doctor_id: string | null
          ends_at: string | null
          id: string
          location: string | null
          notes: string | null
          starts_at: string
          status: Database["public"]["Enums"]["care_appointment_status"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "care_appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_care_task: {
        Args: { p_task_id: string }
        Returns: {
          assigned_to: string | null
          cancelled_at: string | null
          category: Database["public"]["Enums"]["care_task_category"]
          circle_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          due_time: string | null
          id: string
          notes: string | null
          priority: Database["public"]["Enums"]["care_task_priority"]
          status: Database["public"]["Enums"]["care_task_status"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "care_tasks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_family_visit: {
        Args: { p_visit_id: string }
        Returns: {
          circle_id: string
          created_at: string
          created_by: string | null
          end_time: string | null
          id: string
          notes: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["family_visit_status"]
          updated_at: string
          visit_date: string
          visitor_name: string
          visitor_user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "family_visits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_medication_responsibility: {
        Args: { p_medication_id: string }
        Returns: {
          circle_id: string
          created_at: string
          dosage: string | null
          form: string | null
          id: string
          instructions: string | null
          is_active: boolean
          name: string
          photo_url: string | null
          responsible_user_id: string | null
          updated_at: string
          with_food: boolean
        }
        SetofOptions: {
          from: "*"
          to: "medications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_push_deliveries: {
        Args: {
          p_limit?: number
          p_lock_timeout_seconds?: number
          p_max_attempts?: number
        }
        Returns: {
          attempt_count: number
          circle_id: string
          claim_token: string
          deep_link: string
          delivery_id: string
          notification_id: string
          push_token_id: string
          token: string
          type: Database["public"]["Enums"]["notification_type"]
        }[]
      }
      create_care_circle: {
        Args: {
          circle_name: string
          recipient_birth_date?: string
          recipient_full_name: string
        }
        Returns: {
          circle_id: string
          recipient_id: string
        }[]
      }
      create_circle_invitation: {
        Args: {
          p_circle_id: string
          p_invited_email?: string
          p_invited_name?: string
          p_role: Database["public"]["Enums"]["circle_role"]
        }
        Returns: {
          code: string
          expires_at: string
          invitation_id: string
          role: Database["public"]["Enums"]["circle_role"]
        }[]
      }
      deactivate_push_token: { Args: { p_token: string }; Returns: undefined }
      deactivate_push_token_by_id: {
        Args: { p_id: string }
        Returns: undefined
      }
      deactivate_push_token_value: {
        Args: { p_token: string }
        Returns: undefined
      }
      effective_notification_prefs: {
        Args: { p_circle_id: string; p_user_id: string }
        Returns: {
          activity_updates: boolean
          appointment_reminders: boolean
          assignment_alerts: boolean
          available_to_claim_digest: boolean
          care_updates: boolean
          emergency_alerts: boolean
          medication_reminders: boolean
          missed_dose_alerts: boolean
          quiet_hours_enabled: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          remote_summary: boolean
          task_reminders: boolean
          timezone: string
          visit_reminders: boolean
          visit_updates: boolean
        }[]
      }
      enqueue_notification: {
        Args: {
          p_body: string
          p_circle_id?: string
          p_data?: Json
          p_dedupe_key?: string
          p_deep_link?: string
          p_expires_at?: string
          p_quiet_hours_enabled?: boolean
          p_quiet_hours_end?: string
          p_quiet_hours_start?: string
          p_timezone?: string
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
        }
        Returns: string
      }
      fanout_due_notifications: {
        Args: { p_limit?: number; p_max_attempts?: number }
        Returns: {
          deferred: number
          fanned: number
          skipped: number
        }[]
      }
      generate_invitation_code: { Args: never; Returns: string }
      has_circle_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["circle_role"][]
          target_circle_id: string
        }
        Returns: boolean
      }
      hash_invitation_code: { Args: { p_code: string }; Returns: string }
      is_active_user_circle_member: {
        Args: { p_circle_id: string; p_user_id: string }
        Returns: boolean
      }
      is_circle_doctor: {
        Args: { p_circle_id: string; p_doctor_id: string }
        Returns: boolean
      }
      is_circle_medication: {
        Args: { p_circle_id: string; p_medication_id: string }
        Returns: boolean
      }
      is_circle_medication_schedule: {
        Args: { p_circle_id: string; p_schedule_id: string }
        Returns: boolean
      }
      is_circle_medication_schedule_for_medication: {
        Args: {
          p_circle_id: string
          p_medication_id: string
          p_schedule_id: string
        }
        Returns: boolean
      }
      is_circle_member: { Args: { target_circle_id: string }; Returns: boolean }
      is_responsible_for_medication: {
        Args: {
          p_circle_id: string
          p_medication_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      is_user_circle_member: {
        Args: { p_circle_id: string; p_user_id: string }
        Returns: boolean
      }
      is_valid_timezone: { Args: { p_tz: string }; Returns: boolean }
      leave_care_circle: {
        Args: { p_circle_id: string }
        Returns: {
          circle_id: string
          membership_id: string
        }[]
      }
      list_available_to_claim: {
        Args: { p_circle_id: string }
        Returns: {
          category: string
          circle_id: string
          created_at: string
          date_value: string
          item_id: string
          item_type: string
          priority: string
          scheduled_at: string
          status: string
          subtitle: string
          time_value: string
          title: string
        }[]
      }
      list_circle_invitations: {
        Args: { p_circle_id: string }
        Returns: {
          accepted_at: string
          accepted_by: string
          accepted_by_name: string
          created_at: string
          created_by: string
          created_by_name: string
          expires_at: string
          id: string
          invited_email: string
          invited_name: string
          role: Database["public"]["Enums"]["circle_role"]
          status: Database["public"]["Enums"]["invitation_status"]
        }[]
      }
      list_circle_members: {
        Args: { p_circle_id: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          is_owner: boolean
          is_self: boolean
          member_id: string
          role: Database["public"]["Enums"]["circle_role"]
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }[]
      }
      mark_all_notifications_read: {
        Args: { p_circle_id?: string }
        Returns: number
      }
      mark_delivery_failed: {
        Args: {
          p_claim_token: string
          p_delivery_id: string
          p_error?: string
          p_retry_at?: string
        }
        Returns: boolean
      }
      mark_delivery_sent: {
        Args: {
          p_claim_token: string
          p_delivery_id: string
          p_ticket_id?: string
        }
        Returns: boolean
      }
      mark_delivery_skipped: {
        Args: {
          p_claim_token: string
          p_delivery_id: string
          p_reason?: string
        }
        Returns: boolean
      }
      mark_stale_receipts_unchecked: {
        Args: { p_cutoff: string; p_limit?: number }
        Returns: number
      }
      normalize_invitation_code: { Args: { p_code: string }; Returns: string }
      notification_defer_until: {
        Args: {
          p_is_emergency: boolean
          p_now: string
          p_quiet_hours_enabled: boolean
          p_quiet_hours_end: string
          p_quiet_hours_start: string
          p_timezone: string
        }
        Returns: string
      }
      notification_item_managers: {
        Args: { p_circle_id: string }
        Returns: {
          quiet_hours_enabled: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          timezone: string
          user_id: string
        }[]
      }
      notification_item_owner: {
        Args: { p_entity: string; p_item_id: string }
        Returns: string
      }
      notification_recipient_current: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      notification_recipient_eligible: {
        Args: {
          p_circle_id: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
        }
        Returns: boolean
      }
      notification_recipients_for_item_event: {
        Args: {
          p_circle_id: string
          p_entity: string
          p_item_id: string
          p_type: Database["public"]["Enums"]["notification_type"]
        }
        Returns: {
          quiet_hours_enabled: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          timezone: string
          user_id: string
        }[]
      }
      notification_source_validity: {
        Args: { p_notification_id: string }
        Returns: {
          reason: string
          valid: boolean
        }[]
      }
      record_delivery_receipt: {
        Args: {
          p_delivery_id: string
          p_details: string
          p_error_code: string
          p_expected_ticket: string
          p_receipt_id: string
          p_status: string
        }
        Returns: boolean
      }
      register_push_token: {
        Args: {
          p_app_version?: string
          p_device_id?: string
          p_platform: string
          p_token: string
        }
        Returns: string
      }
      revoke_circle_invitation: {
        Args: { p_invitation_id: string }
        Returns: {
          invitation_id: string
          status: Database["public"]["Enums"]["invitation_status"]
        }[]
      }
      set_assigned_appointment_outcome: {
        Args: {
          p_appointment_id: string
          p_status: Database["public"]["Enums"]["care_appointment_status"]
        }
        Returns: {
          appointment_type: Database["public"]["Enums"]["care_appointment_type"]
          assigned_to: string | null
          circle_id: string
          created_at: string
          created_by: string | null
          doctor_id: string | null
          ends_at: string | null
          id: string
          location: string | null
          notes: string | null
          starts_at: string
          status: Database["public"]["Enums"]["care_appointment_status"]
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "care_appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_circle_timezone: {
        Args: { p_circle_id: string; p_timezone: string }
        Returns: string
      }
      set_notification_read: {
        Args: { p_notification_id: string; p_read: boolean }
        Returns: undefined
      }
      transfer_circle_ownership: {
        Args: { p_circle_id: string; p_new_owner_user_id: string }
        Returns: {
          circle_id: string
          owner_id: string
        }[]
      }
      update_circle_member_role: {
        Args: {
          p_member_id: string
          p_role: Database["public"]["Enums"]["circle_role"]
        }
        Returns: {
          member_id: string
          role: Database["public"]["Enums"]["circle_role"]
          status: Database["public"]["Enums"]["member_status"]
        }[]
      }
      update_circle_member_status: {
        Args: {
          p_member_id: string
          p_status: Database["public"]["Enums"]["member_status"]
        }
        Returns: {
          member_id: string
          role: Database["public"]["Enums"]["circle_role"]
          status: Database["public"]["Enums"]["member_status"]
        }[]
      }
      upsert_notification_preferences: {
        Args: {
          p_activity_updates?: boolean
          p_appointment_reminders: boolean
          p_assignment_alerts?: boolean
          p_available_to_claim_digest?: boolean
          p_care_updates: boolean
          p_circle_id: string
          p_emergency_alerts: boolean
          p_medication_reminders: boolean
          p_missed_dose_alerts: boolean
          p_quiet_hours_enabled: boolean
          p_quiet_hours_end: string
          p_quiet_hours_start: string
          p_remote_summary: boolean
          p_task_reminders: boolean
          p_timezone: string
          p_visit_reminders?: boolean
          p_visit_updates: boolean
        }
        Returns: {
          activity_updates: boolean
          appointment_reminders: boolean
          assignment_alerts: boolean
          available_to_claim_digest: boolean
          care_updates: boolean
          circle_id: string | null
          created_at: string
          emergency_alerts: boolean
          id: string
          medication_reminders: boolean
          missed_dose_alerts: boolean
          quiet_hours_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          remote_summary: boolean
          task_reminders: boolean
          timezone: string | null
          updated_at: string
          user_id: string
          visit_reminders: boolean
          visit_updates: boolean
        }
        SetofOptions: {
          from: "*"
          to: "notification_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      appetite_level: "good" | "normal" | "low" | "none" | "unknown"
      care_appointment_status: "scheduled" | "completed" | "cancelled"
      care_appointment_type:
        | "doctor"
        | "lab"
        | "pharmacy"
        | "therapy"
        | "home_care"
        | "family"
        | "general"
      care_task_category:
        | "general"
        | "medication"
        | "meal"
        | "hygiene"
        | "movement"
        | "errand"
        | "appointment"
        | "other"
      care_task_priority: "low" | "normal" | "high" | "urgent"
      care_task_status: "open" | "completed" | "cancelled"
      circle_role:
        | "admin"
        | "primary_caregiver"
        | "family_member"
        | "caregiver"
        | "remote_member"
        | "elder"
      daily_mood:
        | "great"
        | "good"
        | "okay"
        | "sad"
        | "anxious"
        | "angry"
        | "confused"
        | "tired"
      family_visit_status: "planned" | "completed" | "cancelled"
      hydration_level: "good" | "normal" | "low" | "unknown"
      invitation_status: "pending" | "accepted" | "revoked" | "expired"
      medication_log_status: "given" | "missed" | "postponed"
      member_status: "active" | "invited" | "removed"
      mobility_level:
        | "normal"
        | "limited"
        | "needs_help"
        | "bedbound"
        | "unknown"
      notification_channel: "push"
      notification_delivery_status:
        | "pending"
        | "processing"
        | "sent"
        | "failed"
        | "skipped"
      notification_outbox_status: "pending" | "fanned" | "skipped" | "failed"
      notification_type:
        | "medication_due"
        | "medication_missed"
        | "task_due"
        | "appointment_upcoming"
        | "visit_update"
        | "care_update"
        | "emergency"
        | "system"
        | "item_assigned"
        | "task_overdue"
        | "visit_upcoming"
        | "item_claimed"
        | "item_completed"
        | "item_cancelled"
        | "claim_digest"
      sleep_quality: "good" | "fair" | "poor" | "unknown"
      vital_reading_type:
        | "blood_pressure"
        | "heart_rate"
        | "temperature"
        | "blood_sugar"
        | "oxygen_saturation"
        | "weight"
        | "other"
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
    Enums: {
      appetite_level: ["good", "normal", "low", "none", "unknown"],
      care_appointment_status: ["scheduled", "completed", "cancelled"],
      care_appointment_type: [
        "doctor",
        "lab",
        "pharmacy",
        "therapy",
        "home_care",
        "family",
        "general",
      ],
      care_task_category: [
        "general",
        "medication",
        "meal",
        "hygiene",
        "movement",
        "errand",
        "appointment",
        "other",
      ],
      care_task_priority: ["low", "normal", "high", "urgent"],
      care_task_status: ["open", "completed", "cancelled"],
      circle_role: [
        "admin",
        "primary_caregiver",
        "family_member",
        "caregiver",
        "remote_member",
        "elder",
      ],
      daily_mood: [
        "great",
        "good",
        "okay",
        "sad",
        "anxious",
        "angry",
        "confused",
        "tired",
      ],
      family_visit_status: ["planned", "completed", "cancelled"],
      hydration_level: ["good", "normal", "low", "unknown"],
      invitation_status: ["pending", "accepted", "revoked", "expired"],
      medication_log_status: ["given", "missed", "postponed"],
      member_status: ["active", "invited", "removed"],
      mobility_level: [
        "normal",
        "limited",
        "needs_help",
        "bedbound",
        "unknown",
      ],
      notification_channel: ["push"],
      notification_delivery_status: [
        "pending",
        "processing",
        "sent",
        "failed",
        "skipped",
      ],
      notification_outbox_status: ["pending", "fanned", "skipped", "failed"],
      notification_type: [
        "medication_due",
        "medication_missed",
        "task_due",
        "appointment_upcoming",
        "visit_update",
        "care_update",
        "emergency",
        "system",
        "item_assigned",
        "task_overdue",
        "visit_upcoming",
        "item_claimed",
        "item_completed",
        "item_cancelled",
        "claim_digest",
      ],
      sleep_quality: ["good", "fair", "poor", "unknown"],
      vital_reading_type: [
        "blood_pressure",
        "heart_rate",
        "temperature",
        "blood_sugar",
        "oxygen_saturation",
        "weight",
        "other",
      ],
    },
  },
} as const
