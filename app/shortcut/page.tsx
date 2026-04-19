import type { CSSProperties } from "react";
import Link from "next/link";

import {
  SHORTCUT_ID,
  SHORTCUT_INSTALL_PATH,
  SHORTCUT_LATEST_VERSION,
  SHORTCUT_SOURCE_SPEC_PATH,
} from "@/lib/shortcut/config";

const cardStyle: CSSProperties = {
  border: "1px solid rgba(15, 23, 42, 0.12)",
  borderRadius: "20px",
  padding: "24px",
  background: "rgba(255, 255, 255, 0.92)",
  boxShadow: "0 18px 48px rgba(15, 23, 42, 0.08)",
};

const sectionTitleStyle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: "1.1rem",
  fontWeight: 700,
};

export default function ShortcutPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "48px 20px 72px",
        background:
          "radial-gradient(circle at top, rgba(253, 224, 71, 0.24), transparent 38%), linear-gradient(180deg, #fffdf6 0%, #ffffff 100%)",
      }}
    >
      <div
        style={{
          maxWidth: "820px",
          margin: "0 auto",
          display: "grid",
          gap: "20px",
        }}
      >
        <section style={cardStyle}>
          <p
            style={{
              margin: "0 0 10px",
              fontSize: "0.9rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#b45309",
            }}
          >
            haodown iOS Shortcut
          </p>
          <h1 style={{ margin: 0, fontSize: "2.2rem", lineHeight: 1.1 }}>
            iOS 快捷指令安装与更新说明
          </h1>
          <p
            style={{
              margin: "16px 0 0",
              color: "#475569",
              fontSize: "1rem",
              lineHeight: 1.7,
            }}
          >
            当前快捷指令 ID 为 <code>{SHORTCUT_ID}</code>，推荐版本为{" "}
            <code>{SHORTCUT_LATEST_VERSION}</code>。快捷指令会优先读取分享输入，其次读取剪贴板，最后让用户手动输入，并在首次使用时引导录入 Token。
          </p>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>首次使用怎么配</h2>
          <ol style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.8 }}>
            <li>先登录 haodown 首页，在首页卡片里复制你的专属 API Token。</li>
            <li>
              按照仓库文档{" "}
              <code>doc/ios-shortcuts.md</code>{" "}
              在快捷指令里配置 <code>baseUrl</code>、<code>shortcutVersion</code> 和本地配置文件。
            </li>
            <li>首次运行时输入 Token；校验成功后，快捷指令会写入本地配置，后续自动复用。</li>
            <li>如果暂时不想输入 Token，也可以跳过，改走匿名模式。</li>
          </ol>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>源文件与接口</h2>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.8 }}>
            <li>
              快捷指令 source spec：{" "}
              <a href={SHORTCUT_SOURCE_SPEC_PATH}>{SHORTCUT_SOURCE_SPEC_PATH}</a>
            </li>
            <li>
              版本检查接口：<code>/api/shortcut/meta</code>
            </li>
            <li>
              Token 校验接口：<code>/api/shortcut/verify-token</code>
            </li>
            <li>
              提取接口：<code>/api/extract</code>
            </li>
          </ul>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>更新策略</h2>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.8 }}>
            快捷指令每次启动都会检查版本。如果检测到不是最新版本，会提示“继续使用当前版本”或“查看更新”。选择查看更新时，建议直接打开本页对应的安装说明与 source spec 页面重新同步。
          </p>
          <p style={{ margin: "12px 0 0", color: "#64748b", fontSize: "0.95rem" }}>
            安装页路径：<code>{SHORTCUT_INSTALL_PATH}</code>
          </p>
        </section>
      </div>
    </main>
  );
}
