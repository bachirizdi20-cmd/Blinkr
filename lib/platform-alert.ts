import { Alert, Platform, type AlertButton, type AlertOptions } from 'react-native';

type AlertLike = {
  alert: (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => void;
};

function runBrowserAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (typeof window === 'undefined') return;
  const body = [title, message].filter(Boolean).join('\n\n');
  if (!buttons?.length) {
    window.alert(body);
    return;
  }

  if (buttons.length === 1) {
    window.alert(body);
    buttons[0].onPress?.();
    return;
  }

  const cancelIndex = buttons.findIndex((button) => button.style === 'cancel');
  const cancelButton = cancelIndex >= 0 ? buttons[cancelIndex] : undefined;
  const actions = buttons.filter((_, index) => index !== cancelIndex);

  if (buttons.length === 2 && actions.length === 1) {
    if (window.confirm(body)) actions[0].onPress?.();
    else cancelButton?.onPress?.();
    return;
  }

  const choices = buttons.map((button, index) => `${index + 1}. ${button.text}`).join('\n');
  const defaultChoice = String(cancelIndex >= 0 ? cancelIndex + 1 : 1);
  const answer = window.prompt(`${body}\n\n${choices}\n\nأدخل رقم الخيار:`, defaultChoice);
  if (answer === null) {
    cancelButton?.onPress?.();
    return;
  }

  const choice = Number.parseInt(answer.trim(), 10);
  if (!Number.isInteger(choice) || choice < 1 || choice > buttons.length) {
    window.alert('اختر رقمًا صحيحًا من الخيارات المعروضة.');
    return;
  }
  buttons[choice - 1].onPress?.();
}

export const PlatformAlert: AlertLike = {
  alert(title, message, buttons, options) {
    if (Platform.OS === 'web') {
      runBrowserAlert(title, message, buttons);
      return;
    }
    Alert.alert(title, message, buttons, options);
  },
};
