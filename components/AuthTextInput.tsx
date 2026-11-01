import React from "react";
import {
  Platform,
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from "react-native";

type AuthTextInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  keyboardType?: TextInputProps["keyboardType"];
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoCorrect?: boolean;
  autoComplete?: TextInputProps["autoComplete"];
  textContentType?: TextInputProps["textContentType"];
  returnKeyType?: TextInputProps["returnKeyType"];
  blurOnSubmit?: boolean;
  onSubmitEditing?: () => void;
  maxLength?: number;
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
  editable?: boolean;
};

export type AuthTextInputHandle = {
  focus: () => void;
};

export const AuthTextInput = React.forwardRef<AuthTextInputHandle, AuthTextInputProps>(function AuthTextInput(
  props,
  forwardedRef,
) {
  const nativeRef = React.useRef<TextInput>(null);
  const webRef = React.useRef<HTMLInputElement>(null);

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      focus: () => {
        if (Platform.OS === "web") {
          webRef.current?.focus({ preventScroll: true });
        } else {
          nativeRef.current?.focus();
        }
      },
    }),
    [],
  );

  if (Platform.OS === "web") {
    const flattenedStyle = StyleSheet.flatten(props.style) ?? {};
    const { writingDirection, ...textStyle } = flattenedStyle;
    const inputStyle = {
      ...textStyle,
      boxSizing: "border-box",
      direction: writingDirection,
      fontFamily: "inherit",
      outline: "none",
      touchAction: "manipulation",
      userSelect: "text",
      WebkitAppearance: "none",
      WebkitUserSelect: "text",
    } as React.CSSProperties;

    const inputMode = props.keyboardType === "email-address" ? "email" : "text";
    const inputType = props.secureTextEntry ? "password" : props.keyboardType === "email-address" ? "email" : "text";

    return React.createElement("input", {
      ref: webRef,
      type: inputType,
      inputMode,
      value: props.value,
      placeholder: props.placeholder,
      autoCapitalize: props.autoCapitalize,
      autoCorrect: props.autoCorrect ? "on" : "off",
      autoComplete: props.autoComplete,
      spellCheck: props.autoCorrect ?? false,
      enterKeyHint: props.returnKeyType,
      maxLength: props.maxLength,
      disabled: props.editable === false,
      "aria-label": props.accessibilityLabel,
      dir: writingDirection,
      style: inputStyle,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => props.onChangeText(event.currentTarget.value),
      onPointerDownCapture: (event: React.PointerEvent<HTMLInputElement>) => event.stopPropagation(),
      onTouchStartCapture: (event: React.TouchEvent<HTMLInputElement>) => event.stopPropagation(),
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter" && props.onSubmitEditing) {
          event.preventDefault();
          props.onSubmitEditing();
          if (props.blurOnSubmit) webRef.current?.blur();
        }
      },
    });
  }

  return (
    <TextInput
      ref={nativeRef}
      value={props.value}
      onChangeText={props.onChangeText}
      placeholder={props.placeholder}
      placeholderTextColor={props.placeholderTextColor}
      keyboardType={props.keyboardType}
      secureTextEntry={props.secureTextEntry}
      autoCapitalize={props.autoCapitalize}
      autoCorrect={props.autoCorrect}
      autoComplete={props.autoComplete}
      textContentType={props.textContentType}
      returnKeyType={props.returnKeyType}
      blurOnSubmit={props.blurOnSubmit}
      onSubmitEditing={props.onSubmitEditing}
      maxLength={props.maxLength}
      accessibilityLabel={props.accessibilityLabel}
      style={props.style}
      editable={props.editable}
    />
  );
});
