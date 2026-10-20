import React from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { trpc } from "@/lib/trpc";
import * as Auth from "@/lib/_core/auth";
import { colors, fontSizes, radius, spacing } from "@/lib/theme";

type Props = { onAuthenticated: () => Promise<void> | void };
type AuthMode = "login" | "register" | "forgot";
type FieldName = "name" | "email" | "password" | "confirmPassword";
type FieldErrors = Partial<Record<FieldName, string>>;

function friendlyAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("too many")) return "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.";
  if (normalized.includes("network") || normalized.includes("fetch") || normalized.includes("timeout") || normalized.includes("connect")) {
    return "تعذّر الاتصال الآن. تحقق من الإنترنت وحاول مرة أخرى.";
  }
  if (normalized.includes("already") || normalized.includes("exists") || normalized.includes("conflict")) {
    return "هذا البريد مسجّل بالفعل. سجّل الدخول بدلًا من ذلك.";
  }
  if (normalized.includes("invalid") || normalized.includes("incorrect") || normalized.includes("password") || normalized.includes("credential") || normalized.includes("unauthorized")) {
    return "البريد الإلكتروني أو كلمة المرور غير صحيحة. تحقق منهما وحاول مجددًا.";
  }
  return "تعذّر إكمال العملية. حاول مرة أخرى بعد قليل.";
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text style={styles.fieldError} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={14} color={colors.danger} /> {message}
    </Text>
  );
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
  const nameRef = React.useRef<TextInput>(null);
  const emailRef = React.useRef<TextInput>(null);
  const passwordRef = React.useRef<TextInput>(null);
  const confirmPasswordRef = React.useRef<TextInput>(null);

  const complete = React.useCallback(async (result: { sessionToken: string; user: Auth.User }) => {
    await Auth.setSessionToken(result.sessionToken);
    await Auth.setUserInfo({ ...result.user, lastSignedIn: new Date(result.user.lastSignedIn) });
    await onAuthenticated();
  }, [onAuthenticated]);

  const onMutationError = (mutationError: { message: string }) => setError(friendlyAuthError(mutationError.message));
  const login = trpc.auth.login.useMutation({ onSuccess: complete, onError: onMutationError });
  const register = trpc.auth.register.useMutation({ onSuccess: complete, onError: onMutationError });
  const forgotPassword = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => {
      setNotice("إذا كان البريد مرتبطًا بحساب، فسيصلك رابط إعادة التعيين.");
      setError(null);
    },
    onError: onMutationError,
  });
  const busy = login.isPending || register.isPending || forgotPassword.isPending;

  const clearFeedback = () => {
    setFieldErrors({});
    setError(null);
    setNotice(null);
  };

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
    if (mode === "register" && name.trim().length < 2) errors.name = "اكتب اسمًا من حرفين على الأقل.";
    if (!normalizedEmail) errors.email = "البريد الإلكتروني مطلوب.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) errors.email = "اكتب بريدًا إلكترونيًا صحيحًا.";
    if (mode !== "forgot" && password.length < 8) errors.password = "استخدم 8 أحرف على الأقل.";
    if (mode === "register" && password !== confirmPassword) errors.confirmPassword = "كلمتا المرور غير متطابقتين.";

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setError("راجع الحقول المحددة ثم حاول مرة أخرى.");
      return;
    }

    if (mode === "forgot") {
      forgotPassword.mutate({ email: normalizedEmail });
      return;
    }
    if (mode === "register") {
      register.mutate({ email: normalizedEmail, password, name: name.trim() });
      return;
    }
    login.mutate({ email: normalizedEmail, password });
  };

  const isForgot = mode === "forgot";
  const isRegister = mode === "register";
  const submitLabel = isRegister ? "إنشاء حساب" : isForgot ? "إرسال رابط الاستعادة" : "تسجيل الدخول";

  return (
    <View style={styles.container}>
      <Text style={styles.modeTitle}>{isRegister ? "إنشاء حساب" : isForgot ? "استعادة كلمة المرور" : "تسجيل الدخول"}</Text>
      <Text style={styles.modeSubtitle}>
        {isForgot
          ? "أدخل بريدك الإلكتروني وسنرسل لك رابطًا آمنًا لإعادة تعيين كلمة المرور."
          : isRegister
            ? "أنشئ حسابك وابدأ بمشاركة عالمك السينمائي."
            : "أدخل بيانات حسابك للمتابعة إلى Blinkr."}
      </Text>

      {isRegister ? <>
        <Text style={styles.label}>الاسم</Text>
        <TextInput
          ref={nameRef}
          value={name}
          onChangeText={(value) => { setName(value); setFieldErrors((current) => ({ ...current, name: undefined })); }}
          placeholder="اكتب اسمك"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="words"
          autoCorrect={false}
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          maxLength={80}
          accessibilityLabel="الاسم"
          style={[styles.input, styles.rtlInput, fieldErrors.name && styles.inputInvalid]}
          editable={!busy}
        />
        <FieldError message={fieldErrors.name} />
      </> : null}

      <Text style={styles.label}>البريد الإلكتروني</Text>
      <TextInput
        ref={emailRef}
        value={email}
        onChangeText={(value) => { setEmail(value); setFieldErrors((current) => ({ ...current, email: undefined })); }}
        placeholder="name@example.com"
        placeholderTextColor={colors.textFaint}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType={isForgot ? "go" : "next"}
        onSubmitEditing={() => isForgot ? submit() : passwordRef.current?.focus()}
        accessibilityLabel="البريد الإلكتروني"
        style={[styles.input, styles.ltrInput, fieldErrors.email && styles.inputInvalid]}
        editable={!busy}
      />
      <FieldError message={fieldErrors.email} />

      {!isForgot ? <>
        <Text style={styles.label}>كلمة المرور</Text>
        <View style={[styles.passwordRow, fieldErrors.password && styles.inputInvalid]}>
          <TextInput
            ref={passwordRef}
            value={password}
            onChangeText={(value) => { setPassword(value); setFieldErrors((current) => ({ ...current, password: undefined })); }}
            placeholder="8 أحرف على الأقل"
            placeholderTextColor={colors.textFaint}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={isRegister ? "new-password" : "current-password"}
            textContentType={isRegister ? "newPassword" : "password"}
            returnKeyType={isRegister ? "next" : "go"}
            onSubmitEditing={() => isRegister ? confirmPasswordRef.current?.focus() : submit()}
            accessibilityLabel="كلمة المرور"
            style={[styles.passwordInput, styles.ltrInput]}
            editable={!busy}
          />
          <Pressable
            onPress={() => setShowPassword((value) => !value)}
            disabled={busy}
            style={styles.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          >
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color={colors.textDim} />
          </Pressable>
        </View>
        <FieldError message={fieldErrors.password} />

        {isRegister ? <>
          <Text style={styles.label}>تأكيد كلمة المرور</Text>
          <View style={[styles.passwordRow, fieldErrors.confirmPassword && styles.inputInvalid]}>
            <TextInput
              ref={confirmPasswordRef}
              value={confirmPassword}
              onChangeText={(value) => { setConfirmPassword(value); setFieldErrors((current) => ({ ...current, confirmPassword: undefined })); }}
              placeholder="أعد كتابة كلمة المرور"
              placeholderTextColor={colors.textFaint}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={submit}
              accessibilityLabel="تأكيد كلمة المرور"
              style={[styles.passwordInput, styles.ltrInput]}
              editable={!busy}
            />
            <Pressable
              onPress={() => setShowConfirmPassword((value) => !value)}
              disabled={busy}
              style={styles.eyeButton}
              accessibilityRole="button"
              accessibilityLabel={showConfirmPassword ? "إخفاء كلمة التأكيد" : "إظهار كلمة التأكيد"}
            >
              <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={22} color={colors.textDim} />
            </Pressable>
          </View>
          <FieldError message={fieldErrors.confirmPassword} />
        </> : null}
      </> : null}

      {error ? <View style={styles.errorBox} accessibilityRole="alert"><Ionicons name="warning-outline" size={19} color={colors.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}
      {notice ? <View style={styles.noticeBox} accessibilityRole="alert"><Ionicons name="checkmark-circle-outline" size={19} color={colors.accent} /><Text style={styles.noticeText}>{notice}</Text></View> : null}

      <Pressable
        onPress={submit}
        disabled={busy}
        style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy && styles.disabled]}
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
      >
        {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.primaryText}>{submitLabel}</Text>}
      </Pressable>

      {mode === "login" ? <Pressable onPress={() => changeMode("forgot")} disabled={busy} style={styles.switch}><Text style={styles.switchText}>نسيت كلمة المرور؟</Text></Pressable> : null}
      {isForgot ? <Pressable onPress={() => changeMode("login")} disabled={busy} style={styles.switch}><Text style={styles.switchText}>العودة إلى تسجيل الدخول</Text></Pressable> : null}
      <Pressable onPress={() => changeMode(isRegister ? "login" : "register")} disabled={busy} style={styles.switch}>
        <Text style={styles.switchText}>{isRegister ? "لديك حساب بالفعل؟ سجّل الدخول" : "مستخدم جديد؟ أنشئ حسابًا"}</Text>
      </Pressable>
      <Text style={styles.passwordHint}>كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل.</Text>
    </View>
  );
}

const styles = {
  container: { width: "100%" as const, maxWidth: 420, alignSelf: "center" as const, direction: "rtl" as const },
  modeTitle: { color: colors.text, fontSize: fontSizes.xl, fontWeight: "900" as const, textAlign: "center" as const, marginBottom: 5 },
  modeSubtitle: { color: colors.textDim, fontSize: fontSizes.sm, lineHeight: 22, textAlign: "center" as const, marginBottom: spacing.md, writingDirection: "rtl" as const },
  label: { color: colors.text, fontSize: fontSizes.sm, fontWeight: "800" as const, textAlign: "right" as const, marginTop: spacing.sm, marginBottom: 6, writingDirection: "rtl" as const },
  input: { backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.borderLight, borderRadius: 12, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 16, lineHeight: 22, minHeight: 56 },
  rtlInput: { textAlign: "right" as const, writingDirection: "rtl" as const },
  ltrInput: { textAlign: "left" as const, writingDirection: "ltr" as const },
  inputInvalid: { borderColor: colors.danger, borderWidth: 1.5 },
  passwordRow: { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.borderLight, borderRadius: 12, minHeight: 56 },
  passwordInput: { flex: 1, minWidth: 0, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 16, lineHeight: 22, minHeight: 56 },
  eyeButton: { minWidth: 54, minHeight: 54, alignItems: "center" as const, justifyContent: "center" as const, alignSelf: "stretch" as const },
  fieldError: { color: colors.danger, fontSize: 13, lineHeight: 19, textAlign: "right" as const, marginTop: 5, writingDirection: "rtl" as const },
  errorBox: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 9, backgroundColor: "rgba(248, 113, 113, 0.12)", borderWidth: 1, borderColor: "rgba(248, 113, 113, 0.32)", borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  errorText: { flex: 1, color: colors.danger, fontSize: fontSizes.sm, lineHeight: 22, textAlign: "right" as const, writingDirection: "rtl" as const },
  noticeBox: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 9, backgroundColor: "rgba(53, 211, 153, 0.10)", borderWidth: 1, borderColor: "rgba(53, 211, 153, 0.30)", borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  noticeText: { flex: 1, color: colors.accent, fontSize: fontSizes.sm, lineHeight: 22, textAlign: "right" as const, writingDirection: "rtl" as const },
  primary: { marginTop: spacing.lg, backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 15, alignItems: "center" as const, justifyContent: "center" as const, minHeight: 56 },
  primaryText: { color: colors.bg, fontSize: fontSizes.md, fontWeight: "900" as const },
  switch: { alignItems: "center" as const, justifyContent: "center" as const, minHeight: 48, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  switchText: { color: colors.accent, fontSize: fontSizes.sm, fontWeight: "700" as const, textAlign: "center" as const, writingDirection: "rtl" as const },
  passwordHint: { color: colors.textFaint, fontSize: 12, lineHeight: 18, textAlign: "center" as const, marginTop: spacing.xs, writingDirection: "rtl" as const },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.65 },
};
