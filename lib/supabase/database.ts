export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          api_token: string;
          credits_balance: number;
          billing_status: string;
          stripe_customer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          api_token?: string;
          credits_balance?: number;
          billing_status?: string;
          stripe_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          api_token?: string;
          credits_balance?: number;
          billing_status?: string;
          stripe_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      request_logs: {
        Row: {
          id: string;
          profile_id: string | null;
          anonymous_session_id: string | null;
          source_text: string | null;
          source_url: string | null;
          metadata: Json | null;
          requested_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          anonymous_session_id?: string | null;
          source_text?: string | null;
          source_url?: string | null;
          metadata?: Json | null;
          requested_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          anonymous_session_id?: string | null;
          source_text?: string | null;
          source_url?: string | null;
          metadata?: Json | null;
          requested_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      count_requests_today: {
        Args: {
          p_profile_id?: string | null;
          p_anonymous_session_id?: string | null;
          p_timezone?: string;
        };
        Returns: number;
      };
      generate_api_token: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      record_anonymous_request_usage: {
        Args: {
          p_anonymous_session_id: string;
          p_source_text?: string | null;
          p_source_url?: string | null;
          p_metadata?: Json | null;
          p_daily_limit?: number;
          p_timezone?: string;
        };
        Returns: {
          used_today: number;
          daily_limit: number;
          daily_remaining: number;
        }[];
      };
      record_profile_request_usage: {
        Args: {
          p_profile_id: string;
          p_source_text?: string | null;
          p_source_url?: string | null;
          p_metadata?: Json | null;
          p_daily_limit?: number;
          p_timezone?: string;
        };
        Returns: {
          used_today: number;
          daily_limit: number;
          daily_remaining: number;
          credits_balance: number;
          consumed_credit: boolean;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
