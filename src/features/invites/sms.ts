import { Linking, Platform } from 'react-native';
import Share from 'react-native-share';

/** What an invite says, wherever it is sent. */
export function inviteMessage(url: string, groupName?: string): string {
  return groupName !== undefined
    ? `Join ${groupName || 'my group'} on Sharelith to split expenses: ${url}`
    : `Add me on Sharelith so we can split expenses: ${url}`;
}

/** Opens the SMS app at this number with the body typed in. */
export function smsUrl(
  phone: string,
  body: string,
  os: string = Platform.OS,
): string {
  // iOS reads the body after "&", Android after "?".
  return `sms:${phone}${os === 'ios' ? '&' : '?'}body=${encodeURIComponent(
    body,
  )}`;
}

/** Opens a WhatsApp chat with this number, the text typed in. */
export function whatsappUrl(phone: string, body: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(
    body,
  )}`;
}

/**
 * Opens the URL; if nothing can (a tablet without SMS, say), offers the
 * share sheet with the message instead.
 */
export async function openOrShare(url: string, message: string) {
  try {
    await Linking.openURL(url);
  } catch {
    await Share.open({ message, failOnCancel: false }).catch(() => {});
  }
}
