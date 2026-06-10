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
            foreignKeyName: "care_appointments_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "care_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_appointments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
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
            foreignKeyName: "care_tasks_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "care_circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
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
          {
            foreignKeyName: "care_tasks_completed_by_fkey"
            columns: ["completed_by"]
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
            foreignKeyName: "family_visits_visitor_user_id_fkey"
            columns: ["visitor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_visits_created_by_fkey"
            columns: ["created_by"]
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
            foreignKeyName: "medication_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "medication_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_logs_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      create_care_circle: {
        Args: {
          circle_name: string
          recipient_full_name: string
          recipient_birth_date?: string
        }
        Returns: {
          circle_id: string
          recipient_id: string
        }[]
      }
      has_circle_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["circle_role"][]
          target_circle_id: string
        }
        Returns: boolean
      }
      is_circle_member: { Args: { target_circle_id: string }; Returns: boolean }
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
      medication_log_status: "given" | "missed" | "postponed"
      member_status: "active" | "invited" | "removed"
      mobility_level: "normal" | "limited" | "needs_help" | "bedbound" | "unknown"
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
      medication_log_status: ["given", "missed", "postponed"],
      member_status: ["active", "invited", "removed"],
      mobility_level: ["normal", "limited", "needs_help", "bedbound", "unknown"],
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
