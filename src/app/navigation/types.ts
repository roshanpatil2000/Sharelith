import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Welcome: undefined;
  SignUp: undefined;
  CheckEmail: { email: string };
  LogIn: { email?: string } | undefined;
  ForgotPassword: { email?: string } | undefined;
  ResetPassword: { email: string };
};

export type MainTabParamList = {
  Friends: undefined;
  Groups: undefined;
  Activity: undefined;
  Account: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  AddExpense: undefined;
  ComponentGallery: undefined;
  /** returnTo: a group member picker that should select the person added. */
  AddFriend:
    | {
        returnTo?:
          | { screen: 'CreateGroup' }
          | { screen: 'AddGroupMembers'; groupId: string };
      }
    | undefined;
  FriendDetail: { friendId: string };
  /** addedFriendId: set by AddFriend so the picker selects them. */
  CreateGroup: { addedFriendId?: string } | undefined;
  GroupDetail: { groupId: string };
  GroupSettings: { groupId: string };
  AddGroupMembers: { groupId: string; addedFriendId?: string };
  VerifyEmail: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  /** Forced after a reset or invite link. Its own name, so leaving it resets the stack. */
  SetPassword: undefined;
};

export type AuthScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
