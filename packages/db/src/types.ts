export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type OrgRole = 'owner' | 'admin' | 'coach' | 'staff' | 'guardian' | 'athlete';
export type AthleteStatus = 'prospect' | 'trial' | 'active' | 'paused' | 'inactive' | 'alumni';

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          slug: string;
          name: string;
          legal_name: string | null;
          timezone: string;
          currency: string;
          locale: string;
          logo_url: string | null;
          brand_colors: Json | null;
          contact_email: string | null;
          contact_phone: string | null;
          address: Json | null;
          settings: Json;
          stripe_account_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          legal_name?: string | null;
          timezone?: string;
          currency?: string;
          locale?: string;
          logo_url?: string | null;
          brand_colors?: Json | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          address?: Json | null;
          settings?: Json;
          stripe_account_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          legal_name?: string | null;
          timezone?: string;
          currency?: string;
          locale?: string;
          logo_url?: string | null;
          brand_colors?: Json | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          address?: Json | null;
          settings?: Json;
          stripe_account_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          locale: string | null;
          timezone: string | null;
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          locale?: string | null;
          timezone?: string | null;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          locale?: string | null;
          timezone?: string | null;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: OrgRole;
          status: string;
          invited_by: string | null;
          invited_at: string | null;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role: OrgRole;
          status?: string;
          invited_by?: string | null;
          invited_at?: string | null;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: OrgRole;
          status?: string;
          invited_by?: string | null;
          invited_at?: string | null;
          accepted_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      athletes: {
        Row: {
          id: string;
          organization_id: string;
          household_id: string | null;
          user_id: string | null;
          first_name: string;
          last_name: string;
          preferred_name: string | null;
          date_of_birth: string;
          gender: string | null;
          photo_url: string | null;
          status: AthleteStatus;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          household_id?: string | null;
          user_id?: string | null;
          first_name: string;
          last_name: string;
          preferred_name?: string | null;
          date_of_birth: string;
          gender?: string | null;
          photo_url?: string | null;
          status?: AthleteStatus;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          household_id?: string | null;
          user_id?: string | null;
          first_name?: string;
          last_name?: string;
          preferred_name?: string | null;
          date_of_birth?: string;
          gender?: string | null;
          photo_url?: string | null;
          status?: AthleteStatus;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      org_settings: {
        Row: {
          organization_id: string;
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          key: string;
          value?: Json;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          key?: string;
          value?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      org_role: OrgRole;
      athlete_status: AthleteStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
