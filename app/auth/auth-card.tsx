"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

import styles from "./page.module.css";

type AuthMode = "sign-in" | "sign-up";

interface AuthCardProps {
  initialMode: AuthMode;
}

export function AuthCard({ initialMode }: AuthCardProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setNotice(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setErrorMessage("登录服务暂时不可用，请稍后再试。");
      return;
    }

    setIsSubmitting(true);

    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setIsSubmitting(false);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.push("/");
      router.refresh();
      return;
    }

    const emailRedirectTo = `${window.location.origin}/auth/callback?next=/`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
      },
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }

    setNotice("注册成功，请查收确认邮件，完成验证后会自动回到首页。");
  }

  return (
    <div className={styles.formShell}>
      <div className={styles.tabRow}>
        <button
          className={mode === "sign-in" ? styles.activeTab : styles.tab}
          type="button"
          onClick={() => {
            setMode("sign-in");
            setErrorMessage(null);
            setNotice(null);
          }}
        >
          登录
        </button>
        <button
          className={mode === "sign-up" ? styles.activeTab : styles.tab}
          type="button"
          onClick={() => {
            setMode("sign-up");
            setErrorMessage(null);
            setNotice(null);
          }}
        >
          注册
        </button>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>邮箱</span>
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>密码</span>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="至少 6 位"
            minLength={6}
            required
          />
        </label>

        <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "提交中..." : mode === "sign-in" ? "登录" : "注册"}
        </button>
      </form>

      {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
      {notice ? <p className={styles.noticeText}>{notice}</p> : null}
    </div>
  );
}
