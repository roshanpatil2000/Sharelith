export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      expense_debts: {
        Row: {
          amount_minor: number;
          creditor_id: string;
          debtor_id: string;
          expense_id: string;
        };
        Insert: {
          amount_minor: number;
          creditor_id: string;
          debtor_id: string;
          expense_id: string;
        };
        Update: {
          amount_minor?: number;
          creditor_id?: string;
          debtor_id?: string;
          expense_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_debts_creditor_id_fkey';
            columns: ['creditor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_debts_debtor_id_fkey';
            columns: ['debtor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_debts_expense_id_fkey';
            columns: ['expense_id'];
            isOneToOne: false;
            referencedRelation: 'expenses';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_payers: {
        Row: {
          expense_id: string;
          paid_minor: number;
          user_id: string;
        };
        Insert: {
          expense_id: string;
          paid_minor: number;
          user_id: string;
        };
        Update: {
          expense_id?: string;
          paid_minor?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_payers_expense_id_fkey';
            columns: ['expense_id'];
            isOneToOne: false;
            referencedRelation: 'expenses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_payers_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_shares: {
        Row: {
          expense_id: string;
          owed_minor: number;
          raw_value: number | null;
          split_type: string;
          user_id: string;
        };
        Insert: {
          expense_id: string;
          owed_minor: number;
          raw_value?: number | null;
          split_type?: string;
          user_id: string;
        };
        Update: {
          expense_id?: string;
          owed_minor?: number;
          raw_value?: number | null;
          split_type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_shares_expense_id_fkey';
            columns: ['expense_id'];
            isOneToOne: false;
            referencedRelation: 'expenses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_shares_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expenses: {
        Row: {
          amount_minor: number;
          category: string;
          created_at: string;
          created_by: string;
          currency: string;
          deleted_at: string | null;
          description: string;
          expense_date: string;
          group_id: string | null;
          id: string;
          is_payment: boolean;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          category?: string;
          created_at?: string;
          created_by: string;
          currency: string;
          deleted_at?: string | null;
          description: string;
          expense_date?: string;
          group_id?: string | null;
          id?: string;
          is_payment?: boolean;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          category?: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          deleted_at?: string | null;
          description?: string;
          expense_date?: string;
          group_id?: string | null;
          id?: string;
          is_payment?: boolean;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
        ];
      };
      friend_add_attempts: {
        Row: {
          created_at: string;
          id: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: never;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'friend_add_attempts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      friendships: {
        Row: {
          created_at: string;
          created_by: string | null;
          user_a: string;
          user_b: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          user_a: string;
          user_b: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          user_a?: string;
          user_b?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'friendships_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'friendships_user_a_fkey';
            columns: ['user_a'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'friendships_user_b_fkey';
            columns: ['user_b'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      group_members: {
        Row: {
          added_by: string | null;
          group_id: string;
          joined_at: string;
          left_at: string | null;
          user_id: string;
        };
        Insert: {
          added_by?: string | null;
          group_id: string;
          joined_at?: string;
          left_at?: string | null;
          user_id: string;
        };
        Update: {
          added_by?: string | null;
          group_id?: string;
          joined_at?: string;
          left_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'group_members_added_by_fkey';
            columns: ['added_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_members_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      groups: {
        Row: {
          archived_at: string | null;
          cover_url: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          description: string | null;
          id: string;
          name: string;
          simplify_debts: boolean;
          type: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          cover_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string | null;
          id?: string;
          name: string;
          simplify_debts?: boolean;
          type?: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          cover_url?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string | null;
          id?: string;
          name?: string;
          simplify_debts?: boolean;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'groups_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          default_currency: string;
          deleted_at: string | null;
          email: string | null;
          email_verified_at: string | null;
          full_name: string;
          id: string;
          invited_by: string | null;
          joined_at: string | null;
          phone: string | null;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          default_currency?: string;
          deleted_at?: string | null;
          email?: string | null;
          email_verified_at?: string | null;
          full_name: string;
          id: string;
          invited_by?: string | null;
          joined_at?: string | null;
          phone?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          default_currency?: string;
          deleted_at?: string | null;
          email?: string | null;
          email_verified_at?: string | null;
          full_name?: string;
          id?: string;
          invited_by?: string | null;
          joined_at?: string | null;
          phone?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_group_members: {
        Args: { gid: string; member_ids: string[] };
        Returns: undefined;
      };
      assert_all_friends: {
        Args: { member_ids: string[] };
        Returns: undefined;
      };
      assert_expense_creator: { Args: { eid: string }; Returns: undefined };
      assert_group_admin: { Args: { gid: string }; Returns: undefined };
      befriend_group_members: {
        Args: { gid: string; new_ids: string[] };
        Returns: undefined;
      };
      can_see_expense: { Args: { eid: string }; Returns: boolean };
      can_write_group_cover: {
        Args: { object_name: string };
        Returns: boolean;
      };
      claim_friend_add_attempt: {
        Args: { daily_limit: number; uid: string };
        Returns: boolean;
      };
      close_group: { Args: { gid: string }; Returns: undefined };
      compute_expense_debts: { Args: { eid: string }; Returns: undefined };
      create_expense: {
        Args: {
          amount_minor: number;
          category?: string;
          currency: string;
          description: string;
          expense_date?: string;
          group_id?: string;
          notes?: string;
          payers: Json;
          shares: Json;
        };
        Returns: string;
      };
      create_group: {
        Args: {
          description?: string;
          member_ids?: string[];
          name: string;
          type?: string;
        };
        Returns: string;
      };
      delete_account: { Args: never; Returns: undefined };
      delete_group: { Args: { gid: string }; Returns: undefined };
      get_my_profile: {
        Args: never;
        Returns: {
          avatar_url: string | null;
          created_at: string;
          default_currency: string;
          deleted_at: string | null;
          email: string | null;
          email_verified_at: string | null;
          full_name: string;
          id: string;
          invited_by: string | null;
          joined_at: string | null;
          phone: string | null;
          timezone: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      is_group_member: { Args: { gid: string }; Returns: boolean };
      is_orphan_group_cover: {
        Args: { object_name: string };
        Returns: boolean;
      };
      is_settled_in_group: {
        Args: { gid: string; person: string };
        Returns: boolean;
      };
      leave_group: { Args: { gid: string }; Returns: undefined };
      list_expenses: {
        Args: { friend?: string; gid?: string };
        Returns: {
          amount_minor: number;
          category: string;
          created_by: string;
          currency: string;
          description: string;
          expense_date: string;
          group_id: string;
          id: string;
          is_payment: boolean;
          my_net_minor: number;
          paid_by: string;
          paid_to: string;
          payer_count: number;
        }[];
      };
      list_friends: {
        Args: never;
        Returns: {
          avatar_url: string;
          email: string;
          friends_since: string;
          full_name: string;
          id: string;
          invited: boolean;
        }[];
      };
      list_group_balances: {
        Args: { gid: string };
        Returns: {
          currency: string;
          net_minor: number;
          user_id: string;
        }[];
      };
      list_my_balances: {
        Args: never;
        Returns: {
          currency: string;
          friend_id: string;
          group_id: string;
          net_minor: number;
        }[];
      };
      mark_email_verified: { Args: never; Returns: undefined };
      record_payment: {
        Args: {
          amount_minor: number;
          currency: string;
          expense_date?: string;
          group_id?: string;
          payee: string;
          payer: string;
        };
        Returns: string;
      };
      remove_friend: { Args: { friend: string }; Returns: undefined };
      remove_group_member: {
        Args: { gid: string; member: string };
        Returns: undefined;
      };
      rename_expense: {
        Args: { description: string; eid: string };
        Returns: undefined;
      };
      save_expense_people: {
        Args: {
          eid: string;
          gid: string;
          payers: Json;
          shares: Json;
          total: number;
        };
        Returns: undefined;
      };
      set_expense_deleted: {
        Args: { deleted: boolean; eid: string };
        Returns: undefined;
      };
      update_expense: {
        Args: {
          amount_minor: number;
          category?: string;
          currency: string;
          description: string;
          eid: string;
          expense_date?: string;
          notes?: string;
          payers: Json;
          shares: Json;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
      DefaultSchema['Views'])
  ? (DefaultSchema['Tables'] &
      DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
  ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
  ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
