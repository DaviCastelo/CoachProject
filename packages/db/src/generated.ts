export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      announcement_attachments: {
        Row: {
          announcement_id: string
          created_at: string
          file_name: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          file_name: string
          id?: string
          mime_type: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_attachments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_groups: {
        Row: {
          announcement_id: string
          group_id: string
          include_subgroups: boolean
        }
        Insert: {
          announcement_id: string
          group_id: string
          include_subgroups?: boolean
        }
        Update: {
          announcement_id?: string
          group_id?: string
          include_subgroups?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "announcement_groups_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_recipients: {
        Row: {
          announcement_id: string
          athlete_id: string | null
          profile_id: string
          read_at: string | null
        }
        Insert: {
          announcement_id: string
          athlete_id?: string | null
          profile_id: string
          read_at?: string | null
        }
        Update: {
          announcement_id?: string
          athlete_id?: string | null
          profile_id?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_recipients_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_recipients_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_recipients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          organization_id: string
          sent_at: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["announcement_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          organization_id: string
          sent_at?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["announcement_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          organization_id?: string
          sent_at?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["announcement_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes: {
        Row: {
          allergies: string | null
          availability: Json | null
          created_at: string
          current_club: string | null
          date_of_birth: string
          deleted_at: string | null
          dominant_foot: string | null
          emergency_contact: Json | null
          first_name: string
          gender: string | null
          graduation_year: number | null
          household_id: string | null
          id: string
          jersey_size: string | null
          last_name: string
          long_term_goals: string | null
          medical_notes: string | null
          medical_treatment_consent: boolean
          medications: string | null
          notes: string | null
          organization_id: string
          photo_consent: boolean
          photo_url: string | null
          playing_level: string | null
          positions: string[] | null
          preferred_name: string | null
          school: string | null
          short_term_goals: string | null
          source: string | null
          status: Database["public"]["Enums"]["athlete_status"]
          tags: string[] | null
          training_interests: string[] | null
          updated_at: string
          user_id: string | null
          utm: Json | null
        }
        Insert: {
          allergies?: string | null
          availability?: Json | null
          created_at?: string
          current_club?: string | null
          date_of_birth: string
          deleted_at?: string | null
          dominant_foot?: string | null
          emergency_contact?: Json | null
          first_name: string
          gender?: string | null
          graduation_year?: number | null
          household_id?: string | null
          id?: string
          jersey_size?: string | null
          last_name: string
          long_term_goals?: string | null
          medical_notes?: string | null
          medical_treatment_consent?: boolean
          medications?: string | null
          notes?: string | null
          organization_id: string
          photo_consent?: boolean
          photo_url?: string | null
          playing_level?: string | null
          positions?: string[] | null
          preferred_name?: string | null
          school?: string | null
          short_term_goals?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["athlete_status"]
          tags?: string[] | null
          training_interests?: string[] | null
          updated_at?: string
          user_id?: string | null
          utm?: Json | null
        }
        Update: {
          allergies?: string | null
          availability?: Json | null
          created_at?: string
          current_club?: string | null
          date_of_birth?: string
          deleted_at?: string | null
          dominant_foot?: string | null
          emergency_contact?: Json | null
          first_name?: string
          gender?: string | null
          graduation_year?: number | null
          household_id?: string | null
          id?: string
          jersey_size?: string | null
          last_name?: string
          long_term_goals?: string | null
          medical_notes?: string | null
          medical_treatment_consent?: boolean
          medications?: string | null
          notes?: string | null
          organization_id?: string
          photo_consent?: boolean
          photo_url?: string | null
          playing_level?: string | null
          positions?: string[] | null
          preferred_name?: string | null
          school?: string | null
          short_term_goals?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["athlete_status"]
          tags?: string[] | null
          training_interests?: string[] | null
          updated_at?: string
          user_id?: string | null
          utm?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "athletes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athletes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athletes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          athlete_id: string | null
          created_at: string
          data: Json
          error: string | null
          form_version_id: string
          guardian_id: string | null
          id: string
          ip_address: unknown
          organization_id: string
          pdf_url: string | null
          status: string
          submitted_by: string | null
          user_agent: string | null
          utm: Json | null
        }
        Insert: {
          athlete_id?: string | null
          created_at?: string
          data: Json
          error?: string | null
          form_version_id: string
          guardian_id?: string | null
          id?: string
          ip_address?: unknown
          organization_id: string
          pdf_url?: string | null
          status?: string
          submitted_by?: string | null
          user_agent?: string | null
          utm?: Json | null
        }
        Update: {
          athlete_id?: string | null
          created_at?: string
          data?: Json
          error?: string | null
          form_version_id?: string
          guardian_id?: string | null
          id?: string
          ip_address?: unknown
          organization_id?: string
          pdf_url?: string | null
          status?: string
          submitted_by?: string | null
          user_agent?: string | null
          utm?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_versions: {
        Row: {
          created_at: string
          form_id: string
          id: string
          published_at: string | null
          schema: Json
          version: number
        }
        Insert: {
          created_at?: string
          form_id: string
          id?: string
          published_at?: string | null
          schema: Json
          version: number
        }
        Update: {
          created_at?: string
          form_id?: string
          id?: string
          published_at?: string | null
          schema?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_versions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          redirect_url: string | null
          requires_payment: boolean
          requires_waiver: boolean
          slug: string
          status: string
          success_message: string | null
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          redirect_url?: string | null
          requires_payment?: boolean
          requires_waiver?: boolean
          slug: string
          status?: string
          success_message?: string | null
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          redirect_url?: string | null
          requires_payment?: boolean
          requires_waiver?: boolean
          slug?: string
          status?: string
          success_message?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      group_coaches: {
        Row: {
          coach_id: string
          created_at: string
          group_id: string
          id: string
          is_lead: boolean
          organization_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          group_id: string
          id?: string
          is_lead?: boolean
          organization_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          group_id?: string
          id?: string
          is_lead?: boolean
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_coaches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_coaches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_coaches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          added_by: string | null
          athlete_id: string
          created_at: string
          group_id: string
          id: string
          joined_at: string
          left_at: string | null
          notes: string | null
          organization_id: string
          status: Database["public"]["Enums"]["group_member_status"]
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          athlete_id: string
          created_at?: string
          group_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          notes?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["group_member_status"]
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          athlete_id?: string
          created_at?: string
          group_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          notes?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["group_member_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          age_group: string | null
          capacity: number
          color: string | null
          created_at: string
          default_duration_minutes: number | null
          default_location_id: string | null
          id: string
          max_birth_year: number | null
          min_birth_year: number | null
          name: string
          notes: string | null
          organization_id: string
          parent_group_id: string | null
          playing_levels: string[] | null
          program_id: string | null
          skill_focus: string[] | null
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          age_group?: string | null
          capacity?: number
          color?: string | null
          created_at?: string
          default_duration_minutes?: number | null
          default_location_id?: string | null
          id?: string
          max_birth_year?: number | null
          min_birth_year?: number | null
          name: string
          notes?: string | null
          organization_id: string
          parent_group_id?: string | null
          playing_levels?: string[] | null
          program_id?: string | null
          skill_focus?: string[] | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          age_group?: string | null
          capacity?: number
          color?: string | null
          created_at?: string
          default_duration_minutes?: number | null
          default_location_id?: string | null
          id?: string
          max_birth_year?: number | null
          min_birth_year?: number | null
          name?: string
          notes?: string | null
          organization_id?: string
          parent_group_id?: string | null
          playing_levels?: string[] | null
          program_id?: string | null
          skill_focus?: string[] | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_parent_group_id_fkey"
            columns: ["parent_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_athletes: {
        Row: {
          athlete_id: string
          can_pay: boolean
          can_pickup: boolean
          can_receive_comms: boolean
          guardian_id: string
        }
        Insert: {
          athlete_id: string
          can_pay?: boolean
          can_pickup?: boolean
          can_receive_comms?: boolean
          guardian_id: string
        }
        Update: {
          athlete_id?: string
          can_pay?: boolean
          can_pickup?: boolean
          can_receive_comms?: boolean
          guardian_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_athletes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_athletes_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          created_at: string
          email: string
          first_name: string
          household_id: string | null
          id: string
          is_emergency: boolean
          is_primary: boolean
          last_name: string
          organization_id: string
          phone: string | null
          preferred_language: string | null
          relationship: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          household_id?: string | null
          id?: string
          is_emergency?: boolean
          is_primary?: boolean
          last_name: string
          organization_id: string
          phone?: string | null
          preferred_language?: string | null
          relationship?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          household_id?: string | null
          id?: string
          is_emergency?: boolean
          is_primary?: boolean
          last_name?: string
          organization_id?: string
          phone?: string | null
          preferred_language?: string | null
          relationship?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardians_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardians_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardians_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          account_balance: number
          address: Json | null
          billing_notes: string | null
          created_at: string
          id: string
          name: string | null
          organization_id: string
          primary_email: string | null
          primary_phone: string | null
          updated_at: string
        }
        Insert: {
          account_balance?: number
          address?: Json | null
          billing_notes?: string | null
          created_at?: string
          id?: string
          name?: string | null
          organization_id: string
          primary_email?: string | null
          primary_phone?: string | null
          updated_at?: string
        }
        Update: {
          account_balance?: number
          address?: Json | null
          billing_notes?: string | null
          created_at?: string
          id?: string
          name?: string | null
          organization_id?: string
          primary_email?: string | null
          primary_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "households_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_counters: {
        Row: {
          last_number: number
          organization_id: string
          year: number
        }
        Insert: {
          last_number?: number
          organization_id: string
          year: number
        }
        Update: {
          last_number?: number
          organization_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          admin_notes: string | null
          athlete_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          discount_cents: number
          discount_reason: string | null
          due_on: string | null
          household_id: string | null
          id: string
          memo: string | null
          number: string
          organization_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_cents: number
          total_cents: number
          updated_at: string
          voided_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          athlete_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_cents?: number
          discount_reason?: string | null
          due_on?: string | null
          household_id?: string | null
          id?: string
          memo?: string | null
          number: string
          organization_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_cents: number
          total_cents: number
          updated_at?: string
          voided_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          athlete_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_cents?: number
          discount_reason?: string | null
          due_on?: string | null
          household_id?: string | null
          id?: string
          memo?: string | null
          number?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          access_notes: string | null
          address: string | null
          city: string | null
          created_at: string
          field_count: number | null
          has_lights: boolean | null
          hourly_cost_cents: number | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          map_url: string | null
          name: string
          organization_id: string
          parking_notes: string | null
          postal_code: string | null
          state: string | null
          surface: string | null
        }
        Insert: {
          access_notes?: string | null
          address?: string | null
          city?: string | null
          created_at?: string
          field_count?: number | null
          has_lights?: boolean | null
          hourly_cost_cents?: number | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          map_url?: string | null
          name: string
          organization_id: string
          parking_notes?: string | null
          postal_code?: string | null
          state?: string | null
          surface?: string | null
        }
        Update: {
          access_notes?: string | null
          address?: string | null
          city?: string | null
          created_at?: string
          field_count?: number | null
          has_lights?: boolean | null
          hourly_cost_cents?: number | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          map_url?: string | null
          name?: string
          organization_id?: string
          parking_notes?: string | null
          postal_code?: string | null
          state?: string | null
          surface?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          status: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          status?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempts: number
          body: string
          channel: string
          created_at: string
          dedupe_key: string
          error: string | null
          id: string
          invoice_id: string | null
          organization_id: string
          payload: Json
          payment_id: string | null
          provider: string | null
          provider_id: string | null
          recipient: string
          recipient_name: string | null
          sent_at: string | null
          status: string
          subject: string
          type: string
        }
        Insert: {
          attempts?: number
          body: string
          channel?: string
          created_at?: string
          dedupe_key: string
          error?: string | null
          id?: string
          invoice_id?: string | null
          organization_id: string
          payload?: Json
          payment_id?: string | null
          provider?: string | null
          provider_id?: string | null
          recipient: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          type: string
        }
        Update: {
          attempts?: number
          body?: string
          channel?: string
          created_at?: string
          dedupe_key?: string
          error?: string | null
          id?: string
          invoice_id?: string | null
          organization_id?: string
          payload?: Json
          payment_id?: string | null
          provider?: string | null
          provider_id?: string | null
          recipient?: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_balances"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "notifications_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      org_settings: {
        Row: {
          key: string
          organization_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          organization_id: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          organization_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "org_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: Json | null
          brand_colors: Json | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          currency: string
          id: string
          legal_name: string | null
          locale: string
          logo_url: string | null
          name: string
          settings: Json
          slug: string
          stripe_account_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: Json | null
          brand_colors?: Json | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          id?: string
          legal_name?: string | null
          locale?: string
          logo_url?: string | null
          name: string
          settings?: Json
          slug: string
          stripe_account_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: Json | null
          brand_colors?: Json | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          id?: string
          legal_name?: string | null
          locale?: string
          logo_url?: string | null
          name?: string
          settings?: Json
          slug?: string
          stripe_account_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          external_id: string | null
          failure_reason: string | null
          fee_cents: number | null
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          organization_id: string
          paid_at: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          recorded_by: string | null
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          external_id?: string | null
          failure_reason?: string | null
          fee_cents?: number | null
          id?: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          organization_id: string
          paid_at?: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          recorded_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          external_id?: string | null
          failure_reason?: string | null
          fee_cents?: number | null
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          organization_id?: string
          paid_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          recorded_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_balances"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
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
          email: string
          full_name: string | null
          id: string
          last_seen_at: string | null
          locale: string | null
          must_change_password: boolean
          phone: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          last_seen_at?: string | null
          locale?: string | null
          must_change_password?: boolean
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          locale?: string | null
          must_change_password?: boolean
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      program_options: {
        Row: {
          capacity: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          price_cents: number
          program_id: string
          sessions_included: number | null
          sort_order: number
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          price_cents: number
          program_id: string
          sessions_included?: number | null
          sort_order?: number
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          price_cents?: number
          program_id?: string
          sessions_included?: number | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_options_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_options_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          capacity: number | null
          created_at: string
          description: string | null
          ends_on: string | null
          form_id: string | null
          genders: string[] | null
          hero_image_url: string | null
          id: string
          max_birth_year: number | null
          min_birth_year: number | null
          name: string
          organization_id: string
          registration_closes_at: string | null
          registration_opens_at: string | null
          settings: Json
          slug: string
          starts_on: string | null
          status: string
          type: Database["public"]["Enums"]["program_type"]
          updated_at: string
          waiver_template_id: string | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          ends_on?: string | null
          form_id?: string | null
          genders?: string[] | null
          hero_image_url?: string | null
          id?: string
          max_birth_year?: number | null
          min_birth_year?: number | null
          name: string
          organization_id: string
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          settings?: Json
          slug: string
          starts_on?: string | null
          status?: string
          type: Database["public"]["Enums"]["program_type"]
          updated_at?: string
          waiver_template_id?: string | null
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          ends_on?: string | null
          form_id?: string | null
          genders?: string[] | null
          hero_image_url?: string | null
          id?: string
          max_birth_year?: number | null
          min_birth_year?: number | null
          name?: string
          organization_id?: string
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          settings?: Json
          slug?: string
          starts_on?: string | null
          status?: string
          type?: Database["public"]["Enums"]["program_type"]
          updated_at?: string
          waiver_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          external_id: string | null
          id: string
          organization_id: string
          payment_id: string
          reason: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          id?: string
          organization_id: string
          payment_id: string
          reason?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          external_id?: string | null
          id?: string
          organization_id?: string
          payment_id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "refunds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          athlete_id: string
          canceled_at: string | null
          cancellation_reason: string | null
          created_at: string
          group_id: string | null
          id: string
          invoice_id: string | null
          organization_id: string
          program_id: string | null
          program_option_id: string | null
          reserved_until: string | null
          source: string | null
          status: Database["public"]["Enums"]["registration_status"]
          submission_id: string | null
          updated_at: string
          utm: Json | null
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          athlete_id: string
          canceled_at?: string | null
          cancellation_reason?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          invoice_id?: string | null
          organization_id: string
          program_id?: string | null
          program_option_id?: string | null
          reserved_until?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          submission_id?: string | null
          updated_at?: string
          utm?: Json | null
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          athlete_id?: string
          canceled_at?: string | null
          cancellation_reason?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          invoice_id?: string | null
          organization_id?: string
          program_id?: string | null
          program_option_id?: string | null
          reserved_until?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["registration_status"]
          submission_id?: string | null
          updated_at?: string
          utm?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_balances"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "registrations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_program_option_id_fkey"
            columns: ["program_option_id"]
            isOneToOne: false
            referencedRelation: "program_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_attendance: {
        Row: {
          athlete_id: string
          checked_in_at: string | null
          checked_in_by: string | null
          coach_note: string | null
          created_at: string
          id: string
          organization_id: string
          responded_at: string | null
          responded_by: string | null
          session_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
        }
        Insert: {
          athlete_id: string
          checked_in_at?: string | null
          checked_in_by?: string | null
          coach_note?: string | null
          created_at?: string
          id?: string
          organization_id: string
          responded_at?: string | null
          responded_by?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          checked_in_at?: string | null
          checked_in_by?: string | null
          coach_note?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          responded_at?: string | null
          responded_by?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_attendance_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendance_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendance_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_groups: {
        Row: {
          group_id: string
          include_subgroups: boolean
          session_id: string
        }
        Insert: {
          group_id: string
          include_subgroups?: boolean
          session_id: string
        }
        Update: {
          group_id?: string
          include_subgroups?: boolean
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_groups_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          canceled_at: string | null
          canceled_by: string | null
          cancellation_reason: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          event_type: string
          field_label: string | null
          id: string
          location_id: string | null
          organization_id: string
          published_at: string | null
          starts_at: string
          status: Database["public"]["Enums"]["session_status"]
          title: string
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          canceled_by?: string | null
          cancellation_reason?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          event_type?: string
          field_label?: string | null
          id?: string
          location_id?: string | null
          organization_id: string
          published_at?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["session_status"]
          title: string
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          canceled_by?: string | null
          cancellation_reason?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          event_type?: string
          field_label?: string | null
          id?: string
          location_id?: string | null
          organization_id?: string
          published_at?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_canceled_by_fkey"
            columns: ["canceled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      waiver_signatures: {
        Row: {
          athlete_id: string
          consent_to_electronic_signature: boolean
          created_at: string
          document_hash: string
          expires_on: string | null
          guardian_id: string | null
          id: string
          ip_address: unknown
          organization_id: string
          pdf_url: string | null
          revoked_at: string | null
          signature_data: string
          signature_type: string
          signed_at: string
          signer_email: string
          signer_name: string
          signer_relationship: string
          user_agent: string
          waiver_template_id: string
        }
        Insert: {
          athlete_id: string
          consent_to_electronic_signature?: boolean
          created_at?: string
          document_hash: string
          expires_on?: string | null
          guardian_id?: string | null
          id?: string
          ip_address: unknown
          organization_id: string
          pdf_url?: string | null
          revoked_at?: string | null
          signature_data: string
          signature_type: string
          signed_at?: string
          signer_email: string
          signer_name: string
          signer_relationship: string
          user_agent: string
          waiver_template_id: string
        }
        Update: {
          athlete_id?: string
          consent_to_electronic_signature?: boolean
          created_at?: string
          document_hash?: string
          expires_on?: string | null
          guardian_id?: string | null
          id?: string
          ip_address?: unknown
          organization_id?: string
          pdf_url?: string | null
          revoked_at?: string | null
          signature_data?: string
          signature_type?: string
          signed_at?: string
          signer_email?: string
          signer_name?: string
          signer_relationship?: string
          user_agent?: string
          waiver_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiver_signatures_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiver_signatures_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiver_signatures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiver_signatures_waiver_template_id_fkey"
            columns: ["waiver_template_id"]
            isOneToOne: false
            referencedRelation: "waiver_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      waiver_templates: {
        Row: {
          body_markdown: string
          created_at: string
          effective_from: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          requires_initials: boolean
          version: number
        }
        Insert: {
          body_markdown: string
          created_at?: string
          effective_from: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          requires_initials?: boolean
          version: number
        }
        Update: {
          body_markdown?: string
          created_at?: string
          effective_from?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          requires_initials?: boolean
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "waiver_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          error: string | null
          event_id: string
          id: string
          payload: Json
          processed_at: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          received_at: string
          type: string
        }
        Insert: {
          error?: string | null
          event_id: string
          id?: string
          payload: Json
          processed_at?: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          received_at?: string
          type: string
        }
        Update: {
          error?: string | null
          event_id?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          received_at?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      invoice_balances: {
        Row: {
          balance_cents: number | null
          invoice_id: string | null
          organization_id: string | null
          paid_cents: number | null
          pending_cents: number | null
          total_cents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      announcement_org: { Args: { p_announcement_id: string }; Returns: string }
      apply_stripe_payment: {
        Args: {
          p_amount_cents: number
          p_external_id: string
          p_failure_reason?: string
          p_fee_cents?: number
          p_invoice_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_paid_at?: string
          p_status: Database["public"]["Enums"]["payment_status"]
        }
        Returns: string
      }
      approve_registration_with_groups: {
        Args: { p_group_ids?: string[]; p_registration_id: string }
        Returns: undefined
      }
      athlete_age: { Args: { dob: string }; Returns: number }
      athlete_age_group: { Args: { dob: string }; Returns: string }
      auth_athlete_ids: { Args: never; Returns: string[] }
      auth_coach_group_ids: { Args: never; Returns: string[] }
      auth_family_group_ids: { Args: never; Returns: string[] }
      auth_org_ids: { Args: never; Returns: string[] }
      backfill_announcements_for_athlete: {
        Args: { p_athlete_id: string; p_user_id: string }
        Returns: number
      }
      can_manage_announcement: {
        Args: { p_announcement_id: string }
        Returns: boolean
      }
      can_manage_group: { Args: { p_group_id: string }; Returns: boolean }
      can_manage_session: { Args: { p_session_id: string }; Returns: boolean }
      can_view_invoice: { Args: { p_invoice: string }; Returns: boolean }
      can_view_session: { Args: { p_session_id: string }; Returns: boolean }
      create_invoice_for_registration: {
        Args: {
          p_discount_cents?: number
          p_discount_reason?: string
          p_due_on?: string
          p_memo?: string
          p_registration_id: string
        }
        Returns: string
      }
      enqueue_notification: {
        Args: {
          p_body: string
          p_dedupe_key: string
          p_invoice_id?: string
          p_organization_id: string
          p_payload?: Json
          p_payment_id?: string
          p_recipient: string
          p_recipient_name?: string
          p_subject: string
          p_type: string
        }
        Returns: string
      }
      group_descendants: { Args: { p_group_id: string }; Returns: string[] }
      has_org_role: {
        Args: { org: string; roles: Database["public"]["Enums"]["org_role"][] }
        Returns: boolean
      }
      invoice_billing_contact: {
        Args: { p_invoice_id: string }
        Returns: {
          email: string
          locale: string
          name: string
        }[]
      }
      is_announcement_recipient: {
        Args: { p_announcement_id: string }
        Returns: boolean
      }
      is_staff: { Args: { org: string }; Returns: boolean }
      list_my_group_coaches: {
        Args: never
        Returns: {
          full_name: string
          group_id: string
        }[]
      }
      list_my_teammates: {
        Args: never
        Returns: {
          athlete_id: string
          full_name: string
          group_id: string
        }[]
      }
      next_invoice_number: { Args: { p_org: string }; Returns: string }
      process_registration_submission: {
        Args: {
          p_athlete: Json
          p_guardian: Json
          p_household?: Json
          p_program_id?: string
          p_program_option_id?: string
          p_submission_id: string
          p_waiver?: Json
        }
        Returns: string
      }
      publish_session: { Args: { p_session_id: string }; Returns: number }
      recalc_invoice_status: {
        Args: { p_invoice_id: string }
        Returns: Database["public"]["Enums"]["invoice_status"]
      }
      record_offline_payment: {
        Args: {
          p_amount_cents: number
          p_invoice_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_paid_at?: string
          p_reference?: string
        }
        Returns: string
      }
      record_offline_payments_bulk: {
        Args: {
          p_invoice_ids: string[]
          p_method: Database["public"]["Enums"]["payment_method"]
          p_references?: string[]
        }
        Returns: number
      }
      respond_rsvp: {
        Args: { p_athlete_id: string; p_session_id: string; p_status: string }
        Returns: undefined
      }
      send_announcement: {
        Args: { p_announcement_id: string }
        Returns: number
      }
      set_group_capacity: {
        Args: { p_capacity: number; p_group_id: string }
        Returns: undefined
      }
      shares_org_with_viewer: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      submit_public_registration: {
        Args: {
          p_athlete: Json
          p_data: Json
          p_form_version_id: string
          p_guardian: Json
          p_household?: Json
          p_ip?: unknown
          p_program_option_id?: string
          p_user_agent?: string
          p_waiver?: Json
        }
        Returns: string
      }
    }
    Enums: {
      announcement_status: "draft" | "sent"
      athlete_status:
        | "prospect"
        | "trial"
        | "active"
        | "paused"
        | "inactive"
        | "alumni"
      attendance_status:
        | "invited"
        | "confirmed"
        | "declined"
        | "present"
        | "absent"
        | "late"
        | "excused"
        | "no_show"
      group_member_status: "active" | "trial" | "waitlist" | "removed"
      invoice_status:
        | "draft"
        | "open"
        | "paid"
        | "void"
        | "refunded"
        | "uncollectible"
      org_role: "owner" | "admin" | "coach" | "staff" | "guardian" | "athlete"
      payment_method:
        | "card"
        | "us_bank_account"
        | "cash_app"
        | "link"
        | "apple_pay"
        | "google_pay"
        | "venmo"
        | "cash"
        | "check"
        | "zelle"
        | "account_credit"
        | "other"
      payment_provider: "stripe" | "offline"
      payment_status:
        | "pending"
        | "succeeded"
        | "failed"
        | "canceled"
        | "refunded"
        | "partially_refunded"
      program_type:
        | "camp"
        | "small_group"
        | "private_1on1"
        | "clinic"
        | "season"
        | "package"
      registration_status:
        | "pending"
        | "approved"
        | "waitlisted"
        | "rejected"
        | "canceled"
        | "completed"
      session_status: "scheduled" | "canceled" | "completed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      announcement_status: ["draft", "sent"],
      athlete_status: [
        "prospect",
        "trial",
        "active",
        "paused",
        "inactive",
        "alumni",
      ],
      attendance_status: [
        "invited",
        "confirmed",
        "declined",
        "present",
        "absent",
        "late",
        "excused",
        "no_show",
      ],
      group_member_status: ["active", "trial", "waitlist", "removed"],
      invoice_status: [
        "draft",
        "open",
        "paid",
        "void",
        "refunded",
        "uncollectible",
      ],
      org_role: ["owner", "admin", "coach", "staff", "guardian", "athlete"],
      payment_method: [
        "card",
        "us_bank_account",
        "cash_app",
        "link",
        "apple_pay",
        "google_pay",
        "venmo",
        "cash",
        "check",
        "zelle",
        "account_credit",
        "other",
      ],
      payment_provider: ["stripe", "offline"],
      payment_status: [
        "pending",
        "succeeded",
        "failed",
        "canceled",
        "refunded",
        "partially_refunded",
      ],
      program_type: [
        "camp",
        "small_group",
        "private_1on1",
        "clinic",
        "season",
        "package",
      ],
      registration_status: [
        "pending",
        "approved",
        "waitlisted",
        "rejected",
        "canceled",
        "completed",
      ],
      session_status: ["scheduled", "canceled", "completed"],
    },
  },
} as const

