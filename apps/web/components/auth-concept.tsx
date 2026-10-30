"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, MailCheck } from "lucide-react";
import { authClient } from "@/src/lib/auth-client";
import { t } from "@/messages/en";
import styles from "./auth-concept.module.css";

type AuthMode = "signup" | "login" | "forgot" | "reset";
type Role = "learner" | "mentor";
type Field = "name" | "email" | "password" | "confirmPassword";
type Errors = Partial<Record<Field, string>>;

export function AuthConcept({
  mode,
  initialRole = "learner",
  token,
}: {
  mode: AuthMode;
  initialRole?: Role;
  token?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<Role>(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [requestError, setRequestError] = useState("");
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [resendStatus, setResendStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);

  const title = {
    signup: t("onboardingSignupTitle"),
    login: t("onboardingLoginTitle"),
    forgot: t("authForgotTitle"),
    reset: t("authResetTitle"),
  }[mode];

  function validate(): boolean {
    const next: Errors = {};
    if (mode === "signup" && !name.trim())
      next.name = t("onboardingNameRequired");
    if (mode !== "reset") {
      if (!email.trim()) next.email = t("onboardingEmailRequired");
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        next.email = t("onboardingEmailInvalid");
      }
    }
    if (mode === "signup" || mode === "login" || mode === "reset") {
      if (!password) next.password = t("onboardingPasswordRequired");
      else if (password.length < 8)
        next.password = t("onboardingPasswordInvalid");
    }
    if (mode === "reset" && password !== confirmPassword) {
      next.confirmPassword = t("authPasswordMismatch");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError("");
    setResendStatus("");
    setVerificationRequired(false);
    if (!validate()) return;

    if (mode === "reset" && !token) {
      setRequestError(t("authResetLinkInvalid"));
      return;
    }

    setPending(true);
    try {
      let result: {
        data?: { token?: string | null; status?: boolean; message?: string } | null;
        error?: { message?: string; status?: number; code?: string } | null;
      };
      if (mode === "signup") {
        result = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
          activeRole: role,
          callbackURL: "/prototype",
        });
      } else if (mode === "login") {
        result = await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: "/prototype",
        });
      } else if (mode === "forgot") {
        result = await authClient.requestPasswordReset({
          email: email.trim(),
          redirectTo: "/reset-password",
        });
      } else {
        result = await authClient.resetPassword({
          newPassword: password,
          token: token!,
        });
      }

      if (result.error) {
        const message = result.error.message?.toLowerCase() ?? "";
        if (
          mode === "login" &&
          (result.error.code?.toUpperCase() === "EMAIL_NOT_VERIFIED" ||
            message.includes("email not verified"))
        ) {
          setVerificationRequired(true);
          return;
        }
        setRequestError(
          /resend|email.*(config|setup)|not configured/.test(message)
            ? t("authEmailSetupError")
            : mode === "login"
              ? t("authLoginError")
              : mode === "reset"
                ? t("authResetError")
                : t("authRequestError"),
        );
        return;
      }

      if (mode === "login" || (mode === "signup" && result.data?.token)) {
        router.push("/prototype");
        return;
      }
      setPassword("");
      setConfirmPassword("");
      setComplete(true);
    } catch {
      setRequestError(
        mode === "login" ? t("authLoginError") : t("authRequestError"),
      );
    } finally {
      setPending(false);
    }
  }

  async function resendVerification() {
    setResendPending(true);
    setResendStatus("");
    try {
      const result = await authClient.sendVerificationEmail({
        email: email.trim(),
        callbackURL: "/prototype",
      });
      setResendStatus(
        result.error ? t("authVerificationResendError") : t("authVerificationResent"),
      );
    } catch {
      setResendStatus(t("authVerificationResendError"));
    } finally {
      setResendPending(false);
    }
  }

  const isConfirmation = complete && mode !== "reset";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} aria-label={t("brand")}>
          <span className={styles.brandMark} aria-hidden="true">
            s
          </span>
          <span>{t("brand")}</span>
        </Link>
        <Link className={styles.backLink} href="/">
          <ArrowLeft aria-hidden="true" /> {t("onboardingBackHome")}
        </Link>
      </header>

      <section
        className={`${styles.layout} ${mode === "signup" ? styles.signupLayout : styles.compactLayout}`}
        aria-labelledby="auth-title"
      >
        <div className={styles.context}>
          <h1 id="auth-title">
            {isConfirmation
              ? mode === "signup"
                ? t("authCheckEmailTitle")
                : t("authRequestSentTitle")
              : complete
                ? t("authPasswordChangedTitle")
                : title}
          </h1>
          <p>
            {isConfirmation
              ? mode === "signup"
                ? t("authCheckEmailText")
                : t("authRequestSentText")
              : complete
                ? t("authPasswordChangedText")
                : mode === "signup"
                  ? t("onboardingSignupText")
                  : mode === "login"
                    ? t("onboardingLoginText")
                    : mode === "forgot"
                      ? t("authForgotText")
                      : t("authResetText")}
          </p>
          {mode === "signup" && !complete && (
            <p className={styles.disclosure}>{t("onboardingEligibility")}</p>
          )}
        </div>

        <div className={styles.formPanel}>
          {complete ? (
            <div
              className={styles.successState}
              role="status"
              aria-live="polite"
            >
              {isConfirmation && <MailCheck aria-hidden="true" />}
              {mode === "signup" && (
                <>
                  <strong>{email}</strong>
                  <button
                    className={styles.secondaryAction}
                    type="button"
                    onClick={() => void resendVerification()}
                    disabled={resendPending}
                  >
                    {resendPending
                      ? t("authSubmitting")
                      : t("authResendVerification")}
                  </button>
                  {resendStatus && (
                    <p role={resendStatus === t("authVerificationResendError") ? "alert" : "status"}>
                      {resendStatus}
                    </p>
                  )}
                </>
              )}
              {mode === "reset" ? (
                <Link className={styles.primaryAction} href="/login">
                  {t("authBackToLogin")} <ArrowRight aria-hidden="true" />
                </Link>
              ) : mode === "signup" ? (
                <Link className={styles.primaryAction} href="/login">
                  {t("authBackToLogin")} <ArrowRight aria-hidden="true" />
                </Link>
              ) : (
                <Link className={styles.primaryAction} href="/login">
                  {t("authBackToLogin")} <ArrowRight aria-hidden="true" />
                </Link>
              )}
            </div>
          ) : (
            <form noValidate onSubmit={submit}>
              {mode === "signup" && (
                <>
                  <fieldset className={styles.roleFieldset}>
                    <legend>{t("onboardingRolePrompt")}</legend>
                    <div className={styles.roleOptions}>
                      <button
                        type="button"
                        aria-pressed={role === "learner"}
                        className={
                          role === "learner" ? styles.roleSelected : ""
                        }
                        onClick={() => setRole("learner")}
                      >
                        {t("onboardingLearnerChoice")}
                      </button>
                      <button
                        type="button"
                        aria-pressed={role === "mentor"}
                        className={role === "mentor" ? styles.roleSelected : ""}
                        onClick={() => setRole("mentor")}
                      >
                        {t("onboardingMentorChoice")}
                      </button>
                    </div>
                  </fieldset>
                  <div className={styles.field}>
                    <label htmlFor="signup-name">{t("onboardingName")}</label>
                    <input
                      id="signup-name"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={
                        errors.name ? "name-error" : "name-hint"
                      }
                    />
                    {errors.name && (
                      <small id="name-error" className={styles.error}>
                        {errors.name}
                      </small>
                    )}
                    {!errors.name && (
                      <small id="name-hint" className={styles.hint}>
                        {t("onboardingNameHint")}
                      </small>
                    )}
                  </div>
                </>
              )}

              {mode !== "reset" && (
                <label className={styles.field}>
                  <span>{t("onboardingEmail")}</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                  {errors.email && (
                    <small id="email-error" className={styles.error}>
                      {errors.email}
                    </small>
                  )}
                </label>
              )}

              {mode !== "forgot" && (
                <PasswordInput
                  id="password"
                  label={
                    mode === "reset"
                      ? t("authNewPassword")
                      : t("onboardingPassword")
                  }
                  value={password}
                  onChange={setPassword}
                  visible={showPassword}
                  setVisible={setShowPassword}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  error={errors.password}
                  hint={mode === "reset" ? "" : t("onboardingPasswordHint")}
                />
              )}

              {mode === "reset" && (
                <PasswordInput
                  id="confirm-password"
                  label={t("authConfirmPassword")}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  visible={showConfirmPassword}
                  setVisible={setShowConfirmPassword}
                  autoComplete="new-password"
                  error={errors.confirmPassword}
                  hint=""
                />
              )}

              {requestError && (
                <p className={styles.formError} role="alert">
                  {requestError}
                </p>
              )}

              {verificationRequired && mode === "login" && (
                <div className={styles.verificationNotice} role="status">
                  <MailCheck aria-hidden="true" />
                  <p>{t("authLoginNeedsVerification")}</p>
                  <strong>{email}</strong>
                  <button
                    className={styles.secondaryAction}
                    type="button"
                    onClick={() => void resendVerification()}
                    disabled={resendPending}
                  >
                    {resendPending
                      ? t("authSubmitting")
                      : t("authResendVerification")}
                  </button>
                  {resendStatus && (
                    <p role={resendStatus === t("authVerificationResendError") ? "alert" : "status"}>
                      {resendStatus}
                    </p>
                  )}
                </div>
              )}

              {mode === "login" && (
                <p className={styles.forgotLink}>
                  <Link href="/forgot-password">{t("authForgotLink")}</Link>
                </p>
              )}

              <button
                className={styles.primaryAction}
                type="submit"
                disabled={pending}
              >
                {pending
                  ? t("authSubmitting")
                  : {
                      signup: t("onboardingSignupSubmit"),
                      login: t("onboardingLoginSubmit"),
                      forgot: t("authSendResetLink"),
                      reset: t("authSavePassword"),
                    }[mode]}
                {!pending && <ArrowRight aria-hidden="true" />}
              </button>

              {(mode === "signup" || mode === "login") && (
                <p className={styles.switchLine}>
                  <Link href={mode === "signup" ? "/login" : "/signup"}>
                    {mode === "signup"
                      ? t("onboardingHaveAccount")
                      : t("onboardingNewHere")}{" "}
                    {mode === "signup"
                      ? t("onboardingLogIn")
                      : t("onboardingCreateAccount")}
                  </Link>
                </p>
              )}
              {mode === "reset" && (
                <p className={styles.switchLine}>
                  <Link href="/forgot-password">
                    {t("authRequestNewReset")}
                  </Link>
                </p>
              )}
              {mode === "forgot" && (
                <p className={styles.switchLine}>
                  <Link href="/login">{t("authBackToLogin")}</Link>
                </p>
              )}
              {mode === "signup" && (
                <p className={styles.existingFlow}>
                  {role === "mentor" ? (
                    <Link href="/mentor/join">
                      {t("onboardingMentorExistingFlow")}
                    </Link>
                  ) : (
                    <Link href="/request">
                      {t("onboardingUseExistingFlow")}
                    </Link>
                  )}
                </p>
              )}
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  visible,
  setVisible,
  autoComplete,
  error,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  setVisible: (value: boolean) => void;
  autoComplete: string;
  error?: string;
  hint: string;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <span className={styles.passwordField}>
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
        />
        <button
          type="button"
          className={styles.passwordToggle}
          aria-label={
            visible ? t("onboardingHidePassword") : t("onboardingShowPassword")
          }
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </span>
      {error ? (
        <small id={`${id}-error`} className={styles.error}>
          {error}
        </small>
      ) : hint ? (
        <small id={`${id}-hint`} className={styles.hint}>
          {hint}
        </small>
      ) : null}
    </div>
  );
}
