import Link from "next/link";

import { AuthCard } from "@/app/auth/auth-card";
import { isSupabaseConfigured } from "@/lib/supabase/env";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

interface AuthPageProps {
  searchParams: Promise<{
    mode?: string;
  }>;
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;
  const initialMode = params.mode === "sign-up" ? "sign-up" : "sign-in";
  const authEnabled = isSupabaseConfigured();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>账号中心</span>
          <h1 className={styles.title}>登录 haodown</h1>
          <p className={styles.copy}>
            登录后可以查看专属 API Token，并同步你的解析记录。后续购买次数包也会继续使用这套账号体系。
          </p>
          <Link className={styles.backLink} href="/">
            返回首页
          </Link>
        </section>

        <section className={styles.panel}>
          {authEnabled ? (
            <AuthCard initialMode={initialMode} />
          ) : (
            <div className={styles.disabledState}>
              <h2 className={styles.disabledTitle}>登录功能暂未启用</h2>
              <p className={styles.disabledCopy}>
                账号系统还在初始化，请稍后再试。
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
