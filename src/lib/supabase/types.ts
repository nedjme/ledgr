// Hand-authored to match supabase/migrations/0001_init.sql.
// Once the project is linked, regenerate with:
//   npx supabase gen types typescript --linked > src/lib/supabase/types.ts

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      households: {
        Row: {
          id: string;
          name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      household_members: {
        Row: {
          household_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          household_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: {
          household_id?: string;
          user_id?: string;
          joined_at?: string;
        };
        Relationships: [];
      };
      invites: {
        Row: {
          id: string;
          household_id: string;
          token: string;
          created_by: string;
          expires_at: string | null;
          accepted_by: string | null;
        };
        Insert: {
          id?: string;
          household_id: string;
          token: string;
          created_by: string;
          expires_at?: string | null;
          accepted_by?: string | null;
        };
        Update: {
          id?: string;
          household_id?: string;
          token?: string;
          created_by?: string;
          expires_at?: string | null;
          accepted_by?: string | null;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          currency: string;
          starting_balance: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          currency?: string;
          starting_balance?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          currency?: string;
          starting_balance?: number;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          household_id: string | null;
          name: string;
          icon: string | null;
        };
        Insert: {
          id?: string;
          household_id?: string | null;
          name: string;
          icon?: string | null;
        };
        Update: {
          id?: string;
          household_id?: string | null;
          name?: string;
          icon?: string | null;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          account_id: string;
          user_id: string;
          household_id: string | null;
          category_id: string | null;
          amount: number;
          currency: string;
          description: string | null;
          occurred_at: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          user_id: string;
          household_id?: string | null;
          category_id?: string | null;
          amount: number;
          currency?: string;
          description?: string | null;
          occurred_at: string;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          user_id?: string;
          household_id?: string | null;
          category_id?: string | null;
          amount?: number;
          currency?: string;
          description?: string | null;
          occurred_at?: string;
          source?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_household: {
        Args: { household_name?: string | null };
        Returns: string;
      };
      accept_invite: {
        Args: { invite_token: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Household = Database["public"]["Tables"]["households"]["Row"];
export type HouseholdMember =
  Database["public"]["Tables"]["household_members"]["Row"];
export type Invite = Database["public"]["Tables"]["invites"]["Row"];
export type Account = Database["public"]["Tables"]["accounts"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
