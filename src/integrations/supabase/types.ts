export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      blocks: {
        Row: {
          blocked: string;
          blocker: string;
          created_at: string;
        };
        Insert: {
          blocked: string;
          blocker: string;
          created_at?: string;
        };
        Update: {
          blocked?: string;
          blocker?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          created_at: string;
          id: string;
          user_a: string;
          user_b: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          user_a: string;
          user_b: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          user_a?: string;
          user_b?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          match_id: string;
          sender_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          match_id: string;
          sender_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          match_id?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          bio: string | null;
          birthdate: string | null;
          course: string | null;
          created_at: string;
          display_name: string | null;
          email: string | null;
          gender: string | null;
          hidden_at: string | null;
          id: string;
          interested_in: string | null;
          interests: string[];
          onboarded: boolean;
          photo_path: string | null;
          photo_paths: string[];
          prompts: Json;
          suspended_at: string | null;
          year: string | null;
        };
        Insert: {
          bio?: string | null;
          birthdate?: string | null;
          course?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          gender?: string | null;
          hidden_at?: string | null;
          id: string;
          interested_in?: string | null;
          interests?: string[];
          onboarded?: boolean;
          photo_path?: string | null;
          photo_paths?: string[];
          prompts?: Json;
          suspended_at?: string | null;
          year?: string | null;
        };
        Update: {
          bio?: string | null;
          birthdate?: string | null;
          course?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          gender?: string | null;
          hidden_at?: string | null;
          id?: string;
          interested_in?: string | null;
          interests?: string[];
          onboarded?: boolean;
          photo_path?: string | null;
          photo_paths?: string[];
          prompts?: Json;
          suspended_at?: string | null;
          year?: string | null;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          created_at: string;
          id: string;
          reason: string;
          reported: string;
          reporter: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          reason: string;
          reported: string;
          reporter: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          reason?: string;
          reported?: string;
          reporter?: string;
          status?: string;
        };
        Relationships: [];
      };
      super_likes: {
        Row: {
          created_at: string;
          id: string;
          message: string;
          sender_id: string;
          sent_on: string;
          target_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          message: string;
          sender_id: string;
          sent_on?: string;
          target_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string;
          sender_id?: string;
          sent_on?: string;
          target_id?: string;
        };
        Relationships: [];
      };
      swipes: {
        Row: {
          created_at: string;
          liked: boolean;
          swiper: string;
          target: string;
        };
        Insert: {
          created_at?: string;
          liked: boolean;
          swiper: string;
          target: string;
        };
        Update: {
          created_at?: string;
          liked?: boolean;
          swiper?: string;
          target?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      verifications: {
        Row: {
          id_card_path: string;
          note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          submitted_at: string;
          user_id: string;
        };
        Insert: {
          id_card_path: string;
          note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          submitted_at?: string;
          user_id: string;
        };
        Update: {
          id_card_path?: string;
          note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          submitted_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_hidden_profiles: {
        Args: Record<PropertyKey, never>;
        Returns: {
          display_name: string | null;
          email: string | null;
          hidden_at: string;
          user_id: string;
        }[];
      };
      admin_set_profile_hidden: {
        Args: { _user_id: string; _hidden: boolean };
        Returns: undefined;
      };
      admin_open_reports: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          id: string;
          reason: string;
          reported: string;
          reported_name: string | null;
          reported_suspended: boolean;
          reporter: string;
          reporter_name: string | null;
          status: string;
        }[];
      };
      admin_set_suspended: {
        Args: { _user_id: string; _suspended: boolean };
        Returns: undefined;
      };
      admin_suspended_users: {
        Args: Record<PropertyKey, never>;
        Returns: {
          display_name: string | null;
          email: string | null;
          suspended_at: string;
          user_id: string;
        }[];
      };
      admin_pending_verifications: {
        Args: Record<PropertyKey, never>;
        Returns: {
          birthdate: string | null;
          course: string | null;
          display_name: string | null;
          email: string | null;
          id_card_path: string;
          note: string | null;
          status: string;
          submitted_at: string;
          user_id: string;
        }[];
      };
      discover_profiles: {
        Args: { _limit?: number };
        Returns: {
          birthdate: string | null;
          bio: string | null;
          course: string | null;
          display_name: string | null;
          gender: string | null;
          id: string;
          interested_in: string | null;
          interests: string[];
          photo_paths: string[];
          prompts: Json;
          year: string | null;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_approved: { Args: { _uid: string }; Returns: boolean };
      is_approved_folder: { Args: { _folder: string }; Returns: boolean };
      is_blocked_between: { Args: { _a: string; _b: string }; Returns: boolean };
      respond_to_super_like: {
        Args: { _super_like_id: string; _liked: boolean };
        Returns: string | null;
      };
      match_overview: {
        Args: Record<PropertyKey, never>;
        Returns: {
          course: string | null;
          display_name: string | null;
          last_message: string | null;
          last_message_at: string;
          match_id: string;
          other_id: string;
          photo_path: string | null;
        }[];
      };
    };
    Enums: {
      app_role: "admin" | "moderator" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const;
