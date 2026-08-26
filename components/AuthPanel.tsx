import React from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { trpc } from "@/lib/trpc";
import * as Auth from "@/lib/_core/auth";
import { startOAuthLogin } from "@/constants/oauth";
import { colors, fontSizes, radius, spacing } from "@/lib/theme";

type Props = { onAuthenticated: () => Promise<void> | void };

export function AuthPanel({ onAuthenticated }: Props) {
  const [mode, setMode] = React.useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
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
    onSuccess: () => setError("If an account exists for this email, a reset link has been sent."),
    onError: (mutationError) => setError(mutationError.message),
  });
  const busy = login.isPending || register.isPending || forgotPassword.isPending || oauthLoading;

  const submit = () => {
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
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
      register.mutate({ email: normalizedEmail, password, name: name.trim() });
    } else {
      login.mutate({ email: normalizedEmail, password });
    }
  };

  const oauth = async () => {
    setError(null);
    setOauthLoading(true);
    try {
      await startOAuthLogin();
    } catch (oauthError) {
      setError(oauthError instanceof Error ? oauthError.message : "Unable to start OAuth sign in.");
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <View style={{ width: "100%", maxWidth: 380 }}>
      {mode === "register" ? (
        <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.textFaint} autoCapitalize="words" style={styles.input} editable={!busy} />
      ) : null}
      <TextInput value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor={colors.textFaint} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={styles.input} editable={!busy} />
      {mode !== "forgot" ? <TextInput value={password} onChangeText={setPassword} placeholder="Password (8+ characters)" placeholderTextColor={colors.textFaint} secureTextEntry style={styles.input} editable={!busy} returnKeyType="done" onSubmitEditing={submit} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.82 }, busy && { opacity: 0.65 }]}>
        {login.isPending || register.isPending || forgotPassword.isPending ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.primaryText}>{mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}</Text>}
      </Pressable>
      {mode === "login" ? <Pressable onPress={() => { setMode("forgot"); setError(null); }} disabled={busy} style={styles.switch}><Text style={styles.switchText}>Forgot password?</Text></Pressable> : null}
      <Pressable onPress={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }} disabled={busy} style={styles.switch}>
        <Text style={styles.switchText}>{mode === "login" || mode === "forgot" ? "New to Reelog? Create an account" : "Already have an account? Sign in"}</Text>
      </Pressable>
      <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>OR</Text><View style={styles.line} /></View>
      <Pressable onPress={oauth} disabled={busy} style={({ pressed }) => [styles.oauth, pressed && { opacity: 0.82 }, busy && { opacity: 0.65 }]}>
        {oauthLoading ? <ActivityIndicator color={colors.text} /> : <><Ionicons name="globe-outline" size={18} color={colors.text} /><Text style={styles.oauthText}>Continue with OAuth</Text></>}
      </Pressable>
    </View>
  );
}

const styles = {
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: 13, marginTop: spacing.sm, fontSize: fontSizes.md },
  error: { color: colors.danger, textAlign: "center" as const, fontSize: fontSizes.sm, lineHeight: 20, marginTop: spacing.sm },
  primary: { marginTop: spacing.md, backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 14, alignItems: "center" as const, justifyContent: "center" as const, minHeight: 48 },
  primaryText: { color: colors.bg, fontSize: fontSizes.md, fontWeight: "900" as const },
  switch: { alignItems: "center" as const, paddingVertical: spacing.md },
  switchText: { color: colors.accent, fontSize: fontSizes.sm, fontWeight: "700" as const },
  divider: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm, marginVertical: spacing.sm },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { color: colors.textFaint, fontSize: 11, fontWeight: "800" as const },
  oauth: { minHeight: 46, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: spacing.sm },
  oauthText: { color: colors.text, fontSize: fontSizes.sm, fontWeight: "800" as const },
};
