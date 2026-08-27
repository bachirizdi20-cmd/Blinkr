import React from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { trpc } from "@/lib/trpc";
import * as Auth from "@/lib/_core/auth";
import { startOAuthLogin } from "@/constants/oauth";
import { colors, fontSizes, radius, spacing } from "@/lib/theme";

type Props = { onAuthenticated: () => Promise<void> | void };

type AuthMode = "login" | "register" | "forgot";

export function AuthPanel({ onAuthenticated }: Props) {
  const [mode, setMode] = React.useState<AuthMode>("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = React.useState(false);

  const complete = React.useCallback(async (result: { sessionToken: string; user: Auth.User }) => {
    await Auth.setSessionToken(result.sessionToken);
    await Auth.setUserInfo({ ...result.user, lastSignedIn: new Date(result.user.lastSignedIn) });
    await onAuthenticated();
  }, [onAuthenticated]);

  const login = trpc.auth.login.useMutation({
    onSuccess: complete,
    onError: (mutationError) => setError(mutationError.message),
  });
  const register = trpc.auth.register.useMutation({
    onSuccess: complete,
    onError: (mutationError) => setError(mutationError.message),
  });
  const forgotPassword = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => {
      setNotice("If an account exists for this email, a reset link has been sent.");
      setError(null);
    },
    onError: (mutationError) => setError(mutationError.message),
  });
  const busy = login.isPending || register.isPending || forgotPassword.isPending || oauthLoading;

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setNotice(null);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const submit = () => {
    setError(null);
    setNotice(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@") || !normalizedEmail.includes(".")) {
      setError("Enter a valid email address.");
      return;
    }
    if (mode === "forgot") {
      forgotPassword.mutate({ email: normalizedEmail });
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (mode === "register") {
      if (name.trim().length < 2) {
        setError("Enter your name to create an account.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      register.mutate({ email: normalizedEmail, password, name: name.trim() });
    } else {
      login.mutate({ email: normalizedEmail, password });
    }
  };

  const oauth = async () => {
    setError(null);
    setNotice(null);
    setOauthLoading(true);
    try {
      await startOAuthLogin();
    } catch (oauthError) {
      setError(oauthError instanceof Error ? oauthError.message : "Unable to start OAuth sign in.");
    } finally {
      setOauthLoading(false);
    }
  };

  const isForgot = mode === "forgot";
  const submitLabel = mode === "register" ? "Create account" : isForgot ? "Send reset link" : "Sign in";

  return (
    <View style={styles.container}>
      {mode === "register" ? <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.textFaint} autoCapitalize="words" style={styles.input} editable={!busy} /> : null}
      <TextInput value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor={colors.textFaint} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" style={styles.input} editable={!busy} />
      {!isForgot ? <>
        <View style={styles.passwordRow}>
          <TextInput value={password} onChangeText={setPassword} placeholder="Password (8+ characters)" placeholderTextColor={colors.textFaint} secureTextEntry={!showPassword} textContentType={mode === "register" ? "newPassword" : "password"} style={styles.passwordInput} editable={!busy} returnKeyType={mode === "register" ? "next" : "done"} onSubmitEditing={mode === "login" ? submit : undefined} />
          <Pressable onPress={() => setShowPassword((value) => !value)} disabled={busy} style={styles.eyeButton} accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"}><Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textDim} /></Pressable>
        </View>
        {mode === "register" ? <View style={styles.passwordRow}>
          <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" placeholderTextColor={colors.textFaint} secureTextEntry={!showConfirmPassword} textContentType="newPassword" style={styles.passwordInput} editable={!busy} returnKeyType="done" onSubmitEditing={submit} />
          <Pressable onPress={() => setShowConfirmPassword((value) => !value)} disabled={busy} style={styles.eyeButton} accessibilityRole="button" accessibilityLabel={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}><Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textDim} /></Pressable>
        </View> : null}
      </> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy && styles.disabled]}>
        {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.primaryText}>{submitLabel}</Text>}
      </Pressable>
      {mode === "login" ? <Pressable onPress={() => changeMode("forgot")} disabled={busy} style={styles.switch}><Text style={styles.switchText}>Forgot password?</Text></Pressable> : null}
      {mode === "forgot" ? <Pressable onPress={() => changeMode("login")} disabled={busy} style={styles.switch}><Text style={styles.switchText}>Back to sign in</Text></Pressable> : null}
      <Pressable onPress={() => changeMode(mode === "register" ? "login" : "register")} disabled={busy} style={styles.switch}>
        <Text style={styles.switchText}>{mode === "login" || mode === "forgot" ? "New to Blinkr? Create an account" : "Already have an account? Sign in"}</Text>
      </Pressable>
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
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: 13, marginTop: spacing.sm, fontSize: fontSizes.md },
  passwordRow: { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginTop: spacing.sm },
  passwordInput: { flex: 1, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: 13, fontSize: fontSizes.md },
  eyeButton: { minWidth: 48, alignItems: "center" as const, justifyContent: "center" as const, alignSelf: "stretch" as const },
  error: { color: colors.danger, textAlign: "center" as const, fontSize: fontSizes.sm, lineHeight: 20, marginTop: spacing.sm },
  notice: { color: colors.accent, textAlign: "center" as const, fontSize: fontSizes.sm, lineHeight: 20, marginTop: spacing.sm },
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
