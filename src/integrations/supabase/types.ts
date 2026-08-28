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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      ai_chats: {
        Row: {
          answer: string
          category: string
          created_at: string
          id: string
          question: string
          user_id: string
        }
        Insert: {
          answer: string
          category: string
          created_at?: string
          id?: string
          question: string
          user_id: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          question?: string
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          author_name: string | null
          created_at: string
          created_by: string
          id: string
          message: string
          subject_id: string
          title: string
        }
        Insert: {
          author_name?: string | null
          created_at?: string
          created_by: string
          id?: string
          message: string
          subject_id: string
          title: string
        }
        Update: {
          author_name?: string | null
          created_at?: string
          created_by?: string
          id?: string
          message?: string
          subject_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action_type: string
          admin_id: string
          admin_name: string | null
          created_at: string
          details: string | null
          id: string
          target: string | null
        }
        Insert: {
          action_type: string
          admin_id: string
          admin_name?: string | null
          created_at?: string
          details?: string | null
          id?: string
          target?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string
          admin_name?: string | null
          created_at?: string
          details?: string | null
          id?: string
          target?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      chat_sessions: {
        Row: {
          draft: Json
          id: string
          phone: string
          step: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          draft?: Json
          id?: string
          phone: string
          step?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          draft?: Json
          id?: string
          phone?: string
          step?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      code_snippets: {
        Row: {
          code: string
          created_at: string
          id: string
          language: string
          last_output: string | null
          stdin: string
          subject_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          code?: string
          created_at?: string
          id?: string
          language: string
          last_output?: string | null
          stdin?: string
          subject_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          language?: string
          last_output?: string | null
          stdin?: string
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      faculty_subjects: {
        Row: {
          created_at: string
          faculty_id: string
          id: string
          subject_id: string
        }
        Insert: {
          created_at?: string
          faculty_id: string
          id?: string
          subject_id: string
        }
        Update: {
          created_at?: string
          faculty_id?: string
          id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faculty_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      group_items: {
        Row: {
          assignee_id: string | null
          created_at: string
          est_hours: number
          id: string
          is_done: boolean
          project_id: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          est_hours?: number
          id?: string
          is_done?: boolean
          project_id: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          est_hours?: number
          id?: string
          is_done?: boolean
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "group_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "group_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          id: string
          invited_by: string | null
          project_id: string
          responded_at: string | null
          status: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          invited_by?: string | null
          project_id: string
          responded_at?: string | null
          status?: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          invited_by?: string | null
          project_id?: string
          responded_at?: string | null
          status?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "group_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          author_name: string | null
          body: string
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "group_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      group_projects: {
        Row: {
          created_at: string
          deadline_date: string | null
          description: string | null
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          deadline_date?: string | null
          description?: string | null
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          deadline_date?: string | null
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      marks: {
        Row: {
          created_at: string
          exam_date: string
          exam_name: string
          id: string
          max_score: number
          score: number
          subject_id: string | null
          subject_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_date?: string
          exam_name: string
          id?: string
          max_score?: number
          score: number
          subject_id?: string | null
          subject_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          exam_date?: string
          exam_name?: string
          id?: string
          max_score?: number
          score?: number
          subject_id?: string | null
          subject_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "student_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          aisensy_api_key: string | null
          aisensy_campaign_name: string | null
          daily_reminder_time: string
          email_digest_enabled: boolean
          id: boolean
          twilio_whatsapp_from: string | null
          updated_at: string
          weekly_digest_day: number
          weekly_digest_time: string
          whatsapp_enabled: boolean
        }
        Insert: {
          aisensy_api_key?: string | null
          aisensy_campaign_name?: string | null
          daily_reminder_time?: string
          email_digest_enabled?: boolean
          id?: boolean
          twilio_whatsapp_from?: string | null
          updated_at?: string
          weekly_digest_day?: number
          weekly_digest_time?: string
          whatsapp_enabled?: boolean
        }
        Update: {
          aisensy_api_key?: string | null
          aisensy_campaign_name?: string | null
          daily_reminder_time?: string
          email_digest_enabled?: boolean
          id?: boolean
          twilio_whatsapp_from?: string | null
          updated_at?: string
          weekly_digest_day?: number
          weekly_digest_time?: string
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          is_read: boolean
          kind: string
          link: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          is_read?: boolean
          kind?: string
          link?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          is_read?: boolean
          kind?: string
          link?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      panic_scores: {
        Row: {
          calculated_at: string
          id: string
          score: number
          status: string | null
          user_id: string
          week_start_date: string
        }
        Insert: {
          calculated_at?: string
          id?: string
          score?: number
          status?: string | null
          user_id: string
          week_start_date: string
        }
        Update: {
          calculated_at?: string
          id?: string
          score?: number
          status?: string | null
          user_id?: string
          week_start_date?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          aisensy_chat_id: string | null
          aisensy_link_code: string | null
          aisensy_opt_in: boolean
          branch: string | null
          branch_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          semester: number | null
          status: string
          telegram_chat_id: number | null
          telegram_link_code: string | null
          telegram_opt_in: boolean
          tour_completed_at: string | null
          twilio_chat_id: string | null
          twilio_link_code: string | null
          twilio_opt_in: boolean
          username: string | null
          weekly_email_opt_in: boolean
          whatsapp_opt_in: boolean
        }
        Insert: {
          aisensy_chat_id?: string | null
          aisensy_link_code?: string | null
          aisensy_opt_in?: boolean
          branch?: string | null
          branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          semester?: number | null
          status?: string
          telegram_chat_id?: number | null
          telegram_link_code?: string | null
          telegram_opt_in?: boolean
          tour_completed_at?: string | null
          twilio_chat_id?: string | null
          twilio_link_code?: string | null
          twilio_opt_in?: boolean
          username?: string | null
          weekly_email_opt_in?: boolean
          whatsapp_opt_in?: boolean
        }
        Update: {
          aisensy_chat_id?: string | null
          aisensy_link_code?: string | null
          aisensy_opt_in?: boolean
          branch?: string | null
          branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          semester?: number | null
          status?: string
          telegram_chat_id?: number | null
          telegram_link_code?: string | null
          telegram_opt_in?: boolean
          tour_completed_at?: string | null
          twilio_chat_id?: string | null
          twilio_link_code?: string | null
          twilio_opt_in?: boolean
          username?: string | null
          weekly_email_opt_in?: boolean
          whatsapp_opt_in?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_log: {
        Row: {
          channel: string
          created_at: string
          detail: string | null
          id: string
          sent_for_date: string
          status: string
          task_id: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          detail?: string | null
          id?: string
          sent_for_date: string
          status?: string
          task_id: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          detail?: string | null
          id?: string
          sent_for_date?: string
          status?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      semester_settings: {
        Row: {
          is_active: boolean
          semester: number
          updated_at: string
        }
        Insert: {
          is_active?: boolean
          semester: number
          updated_at?: string
        }
        Update: {
          is_active?: boolean
          semester?: number
          updated_at?: string
        }
        Relationships: []
      }
      student_subjects: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_plans: {
        Row: {
          created_at: string
          exam_date: string | null
          id: string
          notes: string | null
          plan: Json
          source: string
          subject_name: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_date?: string | null
          id?: string
          notes?: string | null
          plan?: Json
          source?: string
          subject_name?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          exam_date?: string | null
          id?: string
          notes?: string | null
          plan?: Json
          source?: string
          subject_name?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      subject_deadlines: {
        Row: {
          created_at: string
          created_by: string
          deadline_date: string
          est_hours: number
          id: string
          notes: string | null
          subject_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deadline_date: string
          est_hours?: number
          id?: string
          notes?: string | null
          subject_id: string
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deadline_date?: string
          est_hours?: number
          id?: string
          notes?: string | null
          subject_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_deadlines_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          branch_id: string | null
          code: string
          created_at: string
          id: string
          name: string
          semester: number | null
        }
        Insert: {
          branch_id?: string | null
          code: string
          created_at?: string
          id?: string
          name: string
          semester?: number | null
        }
        Update: {
          branch_id?: string | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          semester?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          category: string
          created_at: string
          id: string
          message: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          category: string
          created_at?: string
          id?: string
          message: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject: string
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          deadline_date: string
          est_hours: number
          id: string
          is_completed: boolean
          subject_id: string | null
          title: string
          type: string
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          deadline_date: string
          est_hours?: number
          id?: string
          is_completed?: boolean
          subject_id?: string | null
          title: string
          type: string
          user_id: string
          weight: number
        }
        Update: {
          created_at?: string
          deadline_date?: string
          est_hours?: number
          id?: string
          is_completed?: boolean
          subject_id?: string | null
          title?: string
          type?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "student_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_keys: {
        Row: {
          api_key: string
          created_at: string
          model: string | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          model?: string | null
          provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          model?: string | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_digest_log: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          status: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          status?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          status?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_username: {
        Args: { _user_id: string; _username: string }
        Returns: string
      }
      class_workload_overview: {
        Args: never
        Returns: {
          avg_panic: number
          branch_id: string
          branch_name: string
          completed_tasks: number
          overloaded_students: number
          semester: number
          student_count: number
          total_tasks: number
        }[]
      }
      faculty_subject_tasks: {
        Args: never
        Returns: {
          created_at: string
          deadline_date: string
          est_hours: number
          is_completed: boolean
          semester: number
          source: string
          student_name: string
          subject_code: string
          subject_id: string
          subject_name: string
          title: string
          type: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invite_group_member: {
        Args: { _project_id: string; _username: string }
        Returns: string
      }
      is_accepted_group_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_guest: { Args: { _user_id: string }; Returns: boolean }
      my_group_invites: {
        Args: never
        Returns: {
          created_at: string
          deadline_date: string
          invited_by_name: string
          member_id: string
          project_id: string
          project_name: string
        }[]
      }
      resolve_login_email: { Args: { _identifier: string }; Returns: string }
      respond_group_invite: {
        Args: { _accept: boolean; _member_id: string }
        Returns: undefined
      }
      subject_in_my_class: {
        Args: { _subject_id: string; _user_id: string }
        Returns: boolean
      }
      teaches_subject: {
        Args: { _subject_id: string; _user_id: string }
        Returns: boolean
      }
      username_available: { Args: { _username: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "faculty" | "student" | "guest"
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
      app_role: ["admin", "faculty", "student", "guest"],
    },
  },
} as const
