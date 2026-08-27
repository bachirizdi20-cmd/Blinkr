import React from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { trpc } from "@/lib/trpc";
import * as Auth from "@/lib/_core/auth";
import { startOAuthLogin } from "@/constants/oauth";
import { colors, fontSizes, radius, spacing } from "@/lib/theme";

type Props = { onAuthenticated: () => Promise<void> | void };
type AuthMode = "login" | "register" | "forgot";
type FieldName = "name" | "email" | "password" | "confirmPassword";
type FieldErrors = Partial<Record<FieldName, string>>;

function friendlyAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("network") || normalized.includes("fetch") || normalized.includes("timeout") || normalized.includes("connect")) {
    return "We couldn't connect right now. Check your internet connection and try again.";
  }
  if (normalized.includes("invalid") || normalized.includes("incorrect") || normalized.includes("password") || normalized.includes("credential")) {
    return "The email or password is incorrect. Check your details and try again.";
  }
  if (normalized.includes("already") || normalized.includes("exists")) {
    return "This email is already registered. Try signing in instead.";
  }
  return "Something went wrong. Please try again in a moment.";
}

function FieldError({ message }: { message?: string }) {
  return message ? <Text style={styles.fieldError} accessibilityRole="alert"><Ionicons name="alert-circle-outline" size={13} color={colors.danger} /> {message}</Text> : null;
}

export function AuthPanel({ onAuthenticated }: Props) {
  const [mode, setMode] = React.useState<AuthMode>("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = React.useState(false);

  const complete = React.useCallback(async (result: { sessionToken: string; user: Auth.User }) => {
    await Auth.setSessionToken(result.sessionToken);
    await Auth.setUserInfo({ ...result.user, lastSignedIn: new Date(result.user.lastSignedIn) });
    await onAuthenticated();
  }, [onAuthenticated]);

  const onMutationError = (mutationError: { message: string }) => setError(friendlyAuthError(mutationError.message));
  const login = trpc.auth.login.useMutation({ onSuccess: complete, onError: onMutationError });
  const register = trpc.auth.register.useMutation({ onSuccess: complete, onError: onMutationError });
  const forgotPassword = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => { setNotice("If an account exists for this email, a reset link has been sent."); setError(null); },
    onError: onMutationError,
  });
  const busy = login.isPending || register.isPending || forgotPassword.isPending || oauthLoading;

  const clearFeedback = () => { setFieldErrors({}); setError(null); setNotice(null); };
  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    clearFeedback();
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const submit = () => {
    clearFeedback();
    const errors: FieldErrors = {};
    const normalizedEmail = email.trim().toLowerCase();
    if (mode === "register" && name.trim().length < 2) errors.name = "Enter at least 2 characters for your name.";
    if (!normalizedEmail) errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) errors.email = "Enter a valid email address.";
    if (mode !== "forgot" && password.length < 8) errors.password = "Use at least 8 characters.";
    if (mode === "register" && password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";
    if (Object.keys(errors).length) { setFieldErrors(errors); setError("Please check the highlighted fields."); return; }
    if (mode === "forgot") { forgotPassword.mutate({ email: normalizedEmail }); return; }
    if (mode === "register") register.mutate({ email: normalizedEmail, password, name: name.trim() });
    else login.mutate({ email: normalizedEmail, password });
  };

  const oauth = async () => {
    clearFeedback();
    setOauthLoading(true);
    try { await startOAuthLogin(); }
    catch (oauthError) { setError(friendlyAuthError(oauthError instanceof Error ? oauthError.message : "OAuth sign in failed")); }
    finally { setOauthLoading(false); }
  };

  const isForgot = mode === "forgot";
  const submitLabel = mode === "register" ? "Create account" : isForgot ? "Send reset link" : "Sign in";
  const inputStyle = (field: FieldName) => [styles.input, fieldErrors[field] && styles.inputInvalid];

  return (
    <View style={styles.container}>
      {mode === "register" ? <>
        <Text style={styles.label}>Name</Text>
        <TextInput value={name} onChangeText={(value) => { setName(value); setFieldErrors((current) => ({ ...current, name: undefined })); }} placeholder="Your name" placeholderTextColor={colors.textFaint} autoCapitalize="words" style={inputStyle("name")} editable={!busy} />
        <FieldError message={fieldErrors.name} />
      </> : null}
      <Text style={styles.label}>Email</Text>
      <TextInput value={email} onChangeText={(value) => { setEmail(value); setFieldErrors((current) => ({ ...current, email: undefined })); }} placeholder="you@example.com" placeholderTextColor={colors.textFaint} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" style={inputStyle("email")} editable={!busy} />
      <FieldError message={fieldErrors.email} />
      {!isForgot ? <>
        <Text style={styles.label}>Password</Text>
        <View style={[styles.passwordRow, fieldErrors.password && styles.inputInvalid]}>
          <TextInput value={password} onChangeText={(value) => { setPassword(value); setFieldErrors((current) => ({ ...current, password: undefined })); }} placeholder="At least 8 characters" placeholderTextColor={colors.textFaint} secureTextEntry={!showPassword} textContentType={mode === "register" ? "newPassword" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} style={styles.passwordInput} editable={!busy} returnKeyType={mode === "register" ? "next" : "done"} onSubmitEditing={mode === "login" ? submit : undefined} />
          <Pressable onPress={() => setShowPassword((value) => !value)} disabled={busy} style={styles.eyeButton} accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"}><Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textDim} /></Pressable>
        </View>
        <FieldError message={fieldErrors.password} />
        {mode === "register" ? <>
          <Text style={styles.label}>Confirm password</Text>
          <View style={[styles.passwordRow, fieldErrors.confirmPassword && styles.inputInvalid]}>
            <TextInput value={confirmPassword} onChangeText={(value) => { setConfirmPassword(value); setFieldErrors((current) => ({ ...current, confirmPassword: undefined })); }} placeholder="Repeat your password" placeholderTextColor={colors.textFaint} secureTextEntry={!showConfirmPassword} textContentType="newPassword" autoComplete="new-password" style={styles.passwordInput} editable={!busy} returnKeyType="done" onSubmitEditing={submit} />
            <Pressable onPress={() => setShowConfirmPassword((value) => !value)} disabled={busy} style={styles.eyeButton} accessibilityRole="button" accessibilityLabel={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}><Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textDim} /></Pressable>
          </View>
          <FieldError message={fieldErrors.confirmPassword} />
        </> : null}
      </> : null}
      {error ? <View style={styles.errorBox} accessibilityRole="alert"><Ionicons name="warning-outline" size={18} color={colors.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}
      {notice ? <View style={styles.noticeBox} accessibilityRole="alert"><Ionicons name="checkmark-circle-outline" size={18} color={colors.accent} /><Text style={styles.noticeText}>{notice}</Text></View> : null}
      <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy && styles.disabled]} accessibilityRole="button">
        {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.primaryText}>{submitLabel}</Text>}
      </Pressable>
      {mode === "login" ? <Pressable onPress={() => changeMode("forgot")} disabled={busy} style={styles.switch}><Text style={styles.switchText}>Forgot password?</Text></Pressable> : null}
      {mode === "forgot" ? <Pressable onPress={() => changeMode("login")} disabled={busy} style={styles.switch}><Text style={styles.switchText}>Back to sign in</Text></Pressable> : null}
      <Pressable onPress={() => changeMode(mode === "register" ? "login" : "register")} disabled={busy} style={styles.switch}><Text style={styles.switchText}>{mode === "login" || mode === "forgot" ? "New to Blinkr? Create an account" : "Already have an account? Sign in"}</Text></Pressable>
      {mode !== "forgot" ? <>
        <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>OR</Text><View style={styles.line} /></View>
        <Pressable onPress={oauth} disabled={busy} style={({ pressed }) => [styles.oauth, pressed && styles.pressed, busy && styles.disabled]}>
          {oauthLoading ? <ActivityIndicator color={colors.text} /> : <><Ionicons name="globe-outline" size={18} color={colors.text} /><Text style={styles.oauthText}>Continue with OAuth</Text></>}
        </Pressable>
      </> : null}
    </View>
  );
}

const styles = {
  container: { width: "100%" as const, maxWidth: 380 },
  label: { color: colors.textDim, fontSize: 12, fontWeight: "800" as const, marginTop: spacing.sm + 2, marginBottom: 2 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: 13, fontSize: fontSizes.md },
  inputInvalid: { borderColor: colors.danger, borderWidth: 1.5 },
  passwordRow: { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  passwordInput: { flex: 1, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: 13, fontSize: fontSizes.md },
  eyeButton: { minWidth: 48, alignItems: "center" as const, justifyContent: "center" as const, alignSelf: "stretch" as const },
  fieldError: { color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: 4 },
  errorBox: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 8, backgroundColor: "rgba(248, 113, 113, 0.12)", borderWidth: 1, borderColor: "rgba(248, 113, 113, 0.32)", borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.md },
  errorText: { flex: 1, color: colors.danger, fontSize: fontSizes.sm, lineHeight: 20 },
  noticeBox: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 8, backgroundColor: "rgba(53, 211, 153, 0.10)", borderWidth: 1, borderColor: "rgba(53, 211, 153, 0.30)", borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.md },
  noticeText: { flex: 1, color: colors.accent, fontSize: fontSizes.sm, lineHeight: 20 },
  primary: { marginTop: spacing.md, backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 14, alignItems: "center" as const, justifyContent: "center" as const, minHeight: 48 },
  primaryText: { color: colors.bg, fontSize: fontSizes.md, fontWeight: "900" as const },
  switch: { alignItems: "center" as const, paddingVertical: spacing.md },
  switchText: { color: colors.accent, fontSize: fontSizes.sm, fontWeight: "700" as const },
  divider: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm, marginVertical: spacing.sm },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { color: colors.textFaint, fontSize: 11, fontWeight: "800" as const },
  oauth: { minHeight: 46, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: spacing.sm },
  oauthText: { color: colors.text, fontSize: fontSizes.sm, fontWeight: "800" as const },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.65 },
};
