import React from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Svg, { Path } from "react-native-svg";
import { AuthTextInput, type AuthTextInputHandle } from "@/components/AuthTextInput";
import { createUserWithEmailAndPassword, GoogleAuthProvider, reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, updateProfile, type User } from "firebase/auth";
import { trpc } from "@/lib/trpc";
import * as Auth from "@/lib/_core/auth";
import { firebaseAuth } from "@/lib/firebaseAuth";
import { colors, fontSizes, radius, spacing } from "@/lib/theme";

type Props = { onAuthenticated: () => Promise<void> | void };
type AuthMode = "login" | "register" | "forgot";
type FieldName = "name" | "email" | "password" | "confirmPassword";
type FieldErrors = Partial<Record<FieldName, string>>;

type GoogleFailureStage = "popup" | "session";

function friendlyAuthError(error: unknown, stage?: GoogleFailureStage) {
  const details = typeof error === "object" && error !== null ? error as {
    code?: unknown;
    data?: { code?: unknown };
    shape?: { data?: { code?: unknown } };
  } : {};
  const code = typeof details.code === "string" ? details.code : "";
  const rawTrpcCode = details.data?.code ?? details.shape?.data?.code;
  const trpcCode = typeof rawTrpcCode === "string" || typeof rawTrpcCode === "number" ? String(rawTrpcCode) : "";
  const message = error instanceof Error ? error.message : String(error);
  const normalized = `${code} ${trpcCode} ${message}`.toLowerCase();
  if (code === "auth/operation-not-allowed") return "طريقة تسجيل الدخول هذه غير مفعّلة في Firebase. فعّل المزوّد المطلوب من Authentication ثم Sign-in method.";
  if (code === "auth/unauthorized-domain") return "نطاق التطبيق غير مسموح في Firebase. أضف bachirizdi20-cmd.github.io إلى Authentication ثم Settings ثم Authorized domains.";
  if (code === "auth/invalid-api-key") return "إعداد Firebase غير صالح. راجع إعدادات تطبيق الويب في مشروع Firebase.";
  if (code === "auth/email-already-in-use") return "هذا البريد لديه حساب بالفعل. اختر تسجيل الدخول؛ إذا لم يكن موثقًا سنعيد إرسال رابط التحقق.";
  if (code === "auth/account-exists-with-different-credential") return "هذا البريد مرتبط بطريقة دخول أخرى. استخدم طريقة الدخول الأصلية أولًا؛ لا تنشئ حسابًا جديدًا كي لا تفصل بياناتك.";
  if (stage === "popup" && code === "auth/invalid-credential") return "تعذر التحقق من حساب Google. أغلق نافذة الاختيار وحاول مجددًا.";
  if (code === "auth/popup-blocked") return "منع المتصفح نافذة تسجيل الدخول. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "أُغلقت نافذة تسجيل الدخول قبل اكتمال العملية. حاول مرة أخرى.";
  if (code === "auth/invalid-email") return "صيغة البريد الإلكتروني غير صحيحة.";
  if (code === "auth/weak-password") return "كلمة المرور ضعيفة؛ اختر كلمة مرور أقوى من 8 أحرف.";
  if (normalized.includes("too many") || normalized.includes("too-many-requests")) return "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.";
  if (normalized.includes("verify") || normalized.includes("verified")) return "تحقق من بريدك الإلكتروني أولًا، ثم سجّل الدخول مجددًا.";
  if (normalized.includes("network") || normalized.includes("fetch") || normalized.includes("timeout") || normalized.includes("connect")) {
    if (stage === "session") return "تم اختيار حساب Google، لكن تعذر الاتصال بخادم Blinkr لإكمال الدخول. أعد تحميل الصفحة ثم حاول مجددًا. (G-NET)";
    return "تعذّر الاتصال الآن. تحقق من الإنترنت وحاول مرة أخرى.";
  }
  if (stage === "session" && (trpcCode === "PRECONDITION_FAILED" || normalized.includes("firebase authentication is not configured"))) {
    return "تم اختيار الحساب، لكن إعداد تسجيل Google في خادم Blinkr غير مكتمل. (G-CONFIG)";
  }
  if (stage === "session" && (trpcCode === "UNAUTHORIZED" || trpcCode === "-32001" || normalized.includes("firebase sign-in is invalid"))) {
    return "تم اختيار الحساب، لكن تعذر التحقق من جلسة Firebase. تأكد من اختيار حساب Google الصحيح ثم أعد المحاولة. (G-VERIFY)";
  }
  if (stage === "session" && (trpcCode === "INTERNAL_SERVER_ERROR" || trpcCode === "-32603")) {
    return "تم التحقق من Google، لكن خادم Blinkr تعذر عليه إنشاء جلستك. أعد المحاولة بعد قليل. (G-SERVER)";
  }
  if (normalized.includes("already") || normalized.includes("exists") || normalized.includes("conflict")) {
    return "هذا البريد مسجّل بالفعل. سجّل الدخول بدلًا من ذلك.";
  }
  if (normalized.includes("invalid") || normalized.includes("incorrect") || normalized.includes("password") || normalized.includes("credential") || normalized.includes("unauthorized")) {
    return "البريد أو كلمة المرور غير صحيحين. إذا كان هذا حساب Blinkr قديمًا، اختر إنشاء حساب بالبريد نفسه وأكّد البريد لربط بياناتك القديمة.";
  }
  if (stage === "session") return "تم اختيار حساب Google، لكن تعذر إكمال جلسة Blinkr. أعد تحميل الصفحة ثم حاول مرة أخرى. (G-SESSION)";
  if (stage === "popup" && code.startsWith("auth/")) return `تعذر إكمال تسجيل Google. رمز الخطأ: ${code}`;
  return "تعذّر إكمال العملية. حاول مرة أخرى بعد قليل.";
}

function GoogleGMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.14-3.07-.4-4.52H24v9.06h12.92c-.57 3-2.29 5.54-4.87 7.24l7.62 5.91c4.45-4.11 7.31-10.16 7.31-17.69z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.92-2.15 15.89-5.76l-7.62-5.91c-2.12 1.42-4.83 2.27-8.27 2.27-6.35 0-11.72-4.29-13.64-10.04l-7.87 6.08C6.38 42.98 14.52 48 24 48z" />
      <Path fill="#FBBC05" d="M10.36 28.56A14.47 14.47 0 0 1 9.6 24c0-1.58.27-3.1.76-4.56l-7.87-6.08a23.98 23.98 0 0 0 0 21.28l7.87-6.08z" />
      <Path fill="#EA4335" d="M24 9.4c3.53 0 6.7 1.21 9.2 3.59l6.87-6.87C35.91 2.31 30.48 0 24 0 14.52 0 6.38 5.02 2.49 13.36l7.87 6.08C12.28 13.69 17.65 9.4 24 9.4z" />
    </Svg>
  );
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
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = React.useState(false);
  const nameRef = React.useRef<AuthTextInputHandle>(null);
  const emailRef = React.useRef<AuthTextInputHandle>(null);
  const passwordRef = React.useRef<AuthTextInputHandle>(null);
  const confirmPasswordRef = React.useRef<AuthTextInputHandle>(null);

  const complete = React.useCallback(async (result: { sessionToken: string; user: Auth.User }) => {
    await Auth.setSessionToken(result.sessionToken);
    await Auth.setUserInfo({ ...result.user, lastSignedIn: new Date(result.user.lastSignedIn) });
    await onAuthenticated();
  }, [onAuthenticated]);

  const firebaseSession = trpc.auth.firebaseSession.useMutation();
  const busy = isSubmitting || firebaseSession.isPending;

  const completeFederatedSignIn = React.useCallback(async (user: User) => {
    const idToken = await user.getIdToken(true);
    const result = await firebaseSession.mutateAsync({
      idToken,
      name: user.displayName || undefined,
    });
    await complete(result);
  }, [complete, firebaseSession]);

  const handleGoogleSignIn = async () => {
    clearFeedback();
    if (Platform.OS !== "web") {
      setError("تسجيل Google متاح حاليًا عبر نسخة Blinkr على الويب.");
      return;
    }

    setIsSubmitting(true);
    setIsGoogleSubmitting(true);
    let stage: GoogleFailureStage = "popup";
    try {
      firebaseAuth.languageCode = "ar";
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      // GitHub Pages and Firebase authDomain are cross-site; popup avoids redirect storage workarounds.
      const result = await signInWithPopup(firebaseAuth, provider);
      stage = "session";
      await completeFederatedSignIn(result.user);
    } catch (signInError) {
      const code = typeof signInError === "object" && signInError !== null && "code" in signInError && typeof signInError.code === "string"
        ? signInError.code
        : "unknown";
      console.warn("[Auth] Google sign-in failed", { stage, code });
      setError(friendlyAuthError(signInError, stage));
    } finally {
      setIsSubmitting(false);
      setIsGoogleSubmitting(false);
    }
  };

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

  const submit = async () => {
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

    setIsSubmitting(true);
    try {
      if (mode === "forgot") {
        await sendPasswordResetEmail(firebaseAuth, normalizedEmail);
        setNotice("إذا كان البريد مرتبطًا بحساب، فسيصلك رابط إعادة تعيين كلمة المرور من Firebase.");
        return;
      }

      if (mode === "register") {
        const credential = await createUserWithEmailAndPassword(firebaseAuth, normalizedEmail, password);
        if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() });
        await sendEmailVerification(credential.user);
        setNotice("أرسل Firebase رابط تحقق إلى بريدك، وليس رمزًا رقميًا. افحص الوارد والرسائل غير المرغوب فيها؛ ثم ارجع وسجّل الدخول بعد فتح الرابط.");
        return;
      }

      const credential = await signInWithEmailAndPassword(firebaseAuth, normalizedEmail, password);
      await reload(credential.user);
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user);
        setNotice("يجب تأكيد بريدك قبل المتابعة. أرسلنا لك رسالة تحقق جديدة؛ افتحها ثم سجّل الدخول مجددًا.");
        return;
      }

      const idToken = await credential.user.getIdToken(true);
      const result = await firebaseSession.mutateAsync({
        idToken,
        name: credential.user.displayName || (isRegister ? name.trim() : undefined),
      });
      await complete(result);
    } catch (submitError) {
      setError(friendlyAuthError(submitError));
    } finally {
      setIsSubmitting(false);
    }
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

      {Platform.OS === "web" && !isForgot ? <>
        <View style={styles.socialButtons}>
          <Pressable
            onPress={handleGoogleSignIn}
            disabled={busy}
            style={({ pressed }) => [styles.socialButton, pressed && styles.pressed, busy && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel={isRegister ? "إنشاء حساب باستخدام Google" : "تسجيل الدخول باستخدام Google"}
          >
            {isGoogleSubmitting ? <ActivityIndicator size="small" color="#4285F4" /> : <GoogleGMark />}
            <Text style={styles.socialButtonText}>{isGoogleSubmitting ? "جارٍ إكمال تسجيل Google…" : "المتابعة باستخدام Google"}</Text>
          </Pressable>
        </View>
        <View style={styles.socialDivider}>
          <View style={styles.socialDividerLine} />
          <Text style={styles.socialDividerText}>أو بالبريد الإلكتروني</Text>
          <View style={styles.socialDividerLine} />
        </View>
      </> : null}

      {isRegister ? <>
        <Text style={styles.label}>الاسم</Text>
        <AuthTextInput
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
          blurOnSubmit={false}
          onSubmitEditing={() => emailRef.current?.focus()}
          maxLength={80}
          accessibilityLabel="الاسم"
          style={[styles.input, styles.rtlInput, fieldErrors.name && styles.inputInvalid]}
          editable={!busy}
        />
        <FieldError message={fieldErrors.name} />
      </> : null}

      <Text style={styles.label}>البريد الإلكتروني</Text>
      <AuthTextInput
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
        blurOnSubmit={false}
        onSubmitEditing={() => isForgot ? submit() : passwordRef.current?.focus()}
        accessibilityLabel="البريد الإلكتروني"
        style={[styles.input, styles.ltrInput, fieldErrors.email && styles.inputInvalid]}
        editable={!busy}
      />
      <FieldError message={fieldErrors.email} />

      {!isForgot ? <>
        <Text style={styles.label}>كلمة المرور</Text>
        <View style={[styles.passwordRow, fieldErrors.password && styles.inputInvalid]}>
          <AuthTextInput
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
            blurOnSubmit={false}
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
            <AuthTextInput
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
  socialButtons: { flexDirection: "row" as const, gap: spacing.sm, marginTop: spacing.md },
  socialButton: { flex: 1, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 10, minHeight: 56, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: "#DADCE0", borderRadius: 14, backgroundColor: "#FFFFFF", shadowColor: "#000000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 5, elevation: 2 },
  socialButtonText: { color: "#202124", fontSize: fontSizes.sm, fontWeight: "800" as const, writingDirection: "rtl" as const },
  socialDivider: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xs },
  socialDividerLine: { flex: 1, height: 1, backgroundColor: colors.borderLight },
  socialDividerText: { color: colors.textFaint, fontSize: 12, writingDirection: "rtl" as const },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.65 },
};
