"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import type {
  ExtractErrorResult,
  ExtractSuccessResult,
  ViewerState,
} from "@/lib/models";
import { extractBatchItems } from "@/lib/batch-input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

import styles from "./batch-extractor.module.css";

type ClientResult =
  | {
      source: string;
      status: "success";
      payload: ExtractSuccessResult;
    }
  | {
      source: string;
      status: "error";
      payload: ExtractErrorResult;
    };

interface BatchExtractorProps {
  viewer: ViewerState;
}

function copyText(text: string) {
  return navigator.clipboard.writeText(text);
}

function summarizeImages(result: ExtractSuccessResult) {
  if (!result.images || result.images.length === 0) {
    return [];
  }

  const preview = result.images.slice(0, 3);
  if (result.images.length > 3) {
    preview.push({
      index: result.images.length,
      width: null,
      height: null,
      url: `+${result.images.length - 3} more`,
    });
  }
  return preview;
}

function getLivePhotoImages(result: ExtractSuccessResult) {
  if (!result.images || result.images.length === 0) {
    return [];
  }

  return result.images.filter(
    (image) => image.livePhoto && typeof image.motionUrl === "string" && image.motionUrl.length > 0,
  );
}

function getAccessLabel(viewer: ViewerState) {
  if (viewer.authMode === "authenticated") {
    return "已登录";
  }

  if (viewer.authMode === "disabled") {
    return "未启用";
  }

  return "游客";
}

export function BatchExtractor({ viewer }: BatchExtractorProps) {
  const router = useRouter();
  const [rawInput, setRawInput] = useState("");
  const [results, setResults] = useState<ClientResult[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const batchItems = extractBatchItems(rawInput);
  const successCount = results.filter((result) => result.status === "success").length;
  const failureCount = results.filter((result) => result.status === "error").length;
  const blockedByQuota =
    viewer.authMode === "authenticated"
      ? viewer.dailyRemaining === 0 && (viewer.creditsBalance ?? 0) === 0
      : viewer.dailyRemaining === 0;

  async function runBatch(items: string[]) {
    setIsExtracting(true);
    setResults([]);

    try {
      const nextResults: ClientResult[] = [];

      for (const item of items) {
        try {
          const response = await fetch("/api/extract", {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              text: item,
              options: {
                preferUnwatermarked: true,
                preferHighestQuality: true,
              },
            }),
          });

          const body = (await response.json()) as
            | ExtractSuccessResult
            | ExtractErrorResult;

          if (!response.ok || !body.ok) {
            nextResults.push({
              source: item,
              status: "error" as const,
              payload: body as ExtractErrorResult,
            });
            continue;
          }

          nextResults.push({
            source: item,
            status: "success" as const,
            payload: body as ExtractSuccessResult,
          });
        } catch (error) {
          nextResults.push({
            source: item,
            status: "error",
            payload: {
              ok: false,
              code: "EXTRACT_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
          });
        }
      }

      startTransition(() => {
        setResults(nextResults);
        setIsExtracting(false);
        router.refresh();
      });
    } catch (error) {
      setIsExtracting(false);
      setResults([
        {
          source: "当前批量任务",
          status: "error",
          payload: {
            ok: false,
            code: "EXTRACT_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
        },
      ]);
    }
  }

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    setIsSigningOut(true);
    const { error } = await supabase.auth.signOut();
    setIsSigningOut(false);

    if (!error) {
      router.refresh();
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (batchItems.length === 0 || blockedByQuota) {
      setResults([]);
      return;
    }

    void runBatch(batchItems);
  }

  const summaryCards = [
    { label: "待解析", value: String(batchItems.length).padStart(2, "0") },
    { label: "成功", value: String(successCount).padStart(2, "0") },
    { label: "失败", value: String(failureCount).padStart(2, "0") },
    {
      label: "当前状态",
      value: getAccessLabel(viewer),
    },
    {
      label: viewer.authMode === "authenticated" ? "今日剩余" : "今日免费剩余",
      value: `${viewer.dailyRemaining}/${viewer.dailyLimit}`,
    },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroIntro}>
            <div className={styles.heroGlow} />
            <span className={styles.eyebrow}>社交媒体内容解析与下载</span>
            <h1 className={styles.heroTitle}>haodown</h1>
            <p className={styles.heroLead}>
              把分享文案、短链或长链批量贴进来，haodown 会自动识别内容，并整理出可直接使用的视频链接和原图地址。
            </p>
            <div className={styles.platformRow}>
              <span className={styles.platformLabel}>支持平台</span>
              <span className={styles.platformPill}>今日头条</span>
              <span className={styles.platformPill}>抖音</span>
              <span className={styles.platformPill}>小红书</span>
            </div>
            <div className={styles.heroMeta}>
              <span className={styles.metaPill}>支持整段分享文案识别</span>
              <span className={styles.metaPill}>批量解析后统一回显</span>
              <span className={styles.metaPill}>持续扩展更多平台</span>
            </div>
          </div>

          <section className={styles.heroPanel}>
            <div className={styles.panelTop}>
              <div>
                <h2 className={styles.panelTitle}>批量解析</h2>
                <p className={styles.panelCopy}>
                  支持直接粘贴多行链接，也支持整段分享文案。系统会优先识别其中的有效链接并批量处理。
                </p>
              </div>
              <div className={styles.countBadge}>
                <span className={styles.countNumber}>{batchItems.length}</span>
                <span className={styles.countLabel}>条待处理</span>
              </div>
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              <textarea
                className={styles.textarea}
                value={rawInput}
                onChange={(event) => setRawInput(event.target.value)}
                placeholder="每行一个短链/长链，或者直接批量粘贴多段分享文案。"
                spellCheck={false}
                disabled={isExtracting}
              />

              <div className={styles.actions}>
                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={batchItems.length === 0 || isExtracting || blockedByQuota}
                >
                  <span className={styles.buttonInner}>
                    {isExtracting ? <span className={styles.spinner} aria-hidden /> : null}
                    <span>
                      {isExtracting ? "解析中..." : `批量解析 ${batchItems.length || ""}`.trim()}
                    </span>
                  </span>
                </button>
                <button
                  className={styles.ghostButton}
                  type="button"
                  onClick={() => {
                    setRawInput("");
                    setResults([]);
                  }}
                  disabled={isExtracting}
                >
                  清空
                </button>
              </div>
              <p className={styles.helperText}>
                输入框中的链接会自动去重处理；如果没有直接链接，也会尝试从分享文案里提取可解析地址。
              </p>
            </form>
          </section>
        </section>

        <section className={styles.viewerStrip}>
          <article className={styles.viewerCard}>
            <div>
              <span className={styles.viewerLabel}>账户状态</span>
              <h2 className={styles.viewerTitle}>
                {viewer.authMode === "authenticated"
                  ? "账号已登录"
                  : viewer.authMode === "disabled"
                    ? "登录功能暂未启用"
                    : "当前为游客模式"}
              </h2>
              <p className={styles.viewerCopy}>{viewer.note}</p>
            </div>

            {viewer.authMode === "authenticated" ? (
              <div className={styles.viewerActions}>
                <div className={styles.viewerStat}>
                  <span className={styles.viewerStatLabel}>邮箱</span>
                  <span className={styles.viewerStatValue}>{viewer.email}</span>
                </div>
                <div className={styles.viewerStat}>
                  <span className={styles.viewerStatLabel}>今日剩余</span>
                  <span className={styles.viewerStatValue}>
                    {viewer.dailyRemaining}/{viewer.dailyLimit}
                  </span>
                </div>
                <div className={styles.viewerStat}>
                  <span className={styles.viewerStatLabel}>点数余额</span>
                  <span className={styles.viewerStatValue}>{viewer.creditsBalance ?? 0}</span>
                </div>
                <div className={styles.viewerStat}>
                  <span className={styles.viewerStatLabel}>已记录请求</span>
                  <span className={styles.viewerStatValue}>{viewer.recordedRequests}</span>
                </div>
                <button
                  className={styles.ghostButton}
                  type="button"
                  onClick={() => {
                    void handleSignOut();
                  }}
                  disabled={isSigningOut}
                >
                  {isSigningOut ? "退出中..." : "退出登录"}
                </button>
              </div>
            ) : (
              <div className={styles.viewerActions}>
                <div className={styles.viewerStat}>
                  <span className={styles.viewerStatLabel}>今日剩余 2 次</span>
                  <span className={styles.viewerStatValue}>
                    {viewer.dailyRemaining}/{viewer.dailyLimit}
                  </span>
                </div>
                {viewer.authAvailable ? (
                  <>
                    <Link className={styles.primaryLink} href="/auth?mode=sign-in">
                      登录
                    </Link>
                    <Link className={styles.ghostLink} href="/auth?mode=sign-up">
                      注册
                    </Link>
                  </>
                ) : null}
              </div>
            )}
          </article>

          <article className={styles.tokenCard}>
            <span className={styles.viewerLabel}>开发者凭证</span>
            <h3 className={styles.tokenTitle}>
              {viewer.apiToken ? "你的专属 API Token" : "登录后可查看专属 API Token"}
            </h3>
            <p className={styles.tokenCopy}>
              API Token 会和你的账号绑定，后续购买次数包或接入程序调用时都可以继续沿用。
            </p>

            {viewer.apiToken ? (
              <div className={styles.tokenRow}>
                <code className={styles.tokenValue}>{viewer.apiToken}</code>
                <button
                  className={styles.linkButton}
                  type="button"
                  onClick={() => {
                    void copyText(viewer.apiToken!);
                  }}
                >
                  复制凭证
                </button>
              </div>
            ) : (
              <div className={styles.tokenPlaceholder}>
                {viewer.authAvailable
                  ? "登录或注册后，这里会显示你的专属 API Token。"
                  : "完成账号系统配置后，这里会显示你的专属 API Token。"}
              </div>
            )}
          </article>
        </section>

        <section className={styles.summary}>
          {summaryCards.map((card) => (
            <article className={styles.summaryCard} key={card.label}>
              <span className={styles.summaryLabel}>{card.label}</span>
              <span className={styles.summaryValue}>{card.value}</span>
            </article>
          ))}
        </section>

        <section className={styles.results}>
          <div className={styles.resultsHeader}>
            <div>
              <h2 className={styles.resultsTitle}>解析结果</h2>
              <p className={styles.resultsCopy}>
                每条结果都会整理成卡片，方便你直接复制链接、下载素材或继续二次处理。
              </p>
            </div>
          </div>

          {isExtracting ? (
            <div className={styles.loadingPanel}>
              <span className={styles.loadingPulse} aria-hidden />
              <div>
                <p className={styles.loadingTitle}>正在批量解析</p>
                <p className={styles.loadingCopy}>
                  已提交 {batchItems.length} 条内容，请稍候，结果返回后会自动显示在这里。
                </p>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className={styles.empty}>
              输入分享文案或链接后点击“批量解析”，结果会展示在这里。
            </div>
          ) : (
            <div className={styles.resultGrid}>
              {results.map((result) => {
                if (result.status === "error") {
                  return (
                    <article className={styles.card} key={`${result.source}-error`}>
                      <div className={styles.badgeRow}>
                        <span className={styles.errorBadge}>{result.payload.code}</span>
                      </div>
                      <div className={styles.cardTop}>
                        <div>
                          <h3 className={styles.cardTitle}>解析失败</h3>
                          <p className={styles.cardSource}>{result.source}</p>
                        </div>
                      </div>
                      <p className={styles.statusText}>{result.payload.message}</p>
                    </article>
                  );
                }

                const previewImages = summarizeImages(result.payload);
                const livePhotoImages = getLivePhotoImages(result.payload);

                return (
                  <article className={styles.card} key={`${result.source}-${result.payload.id}`}>
                    <div className={styles.badgeRow}>
                      <span className={styles.badge}>{result.payload.platform}</span>
                      <span className={styles.badge}>{result.payload.contentType}</span>
                      {result.payload.video ? (
                        <span className={styles.badge}>
                          {result.payload.video.best.definition}
                        </span>
                      ) : null}
                    </div>

                    <div className={styles.cardTop}>
                      <div>
                        <h3 className={styles.cardTitle}>{result.payload.title}</h3>
                        <p className={styles.cardSource}>{result.payload.canonicalUrl}</p>
                      </div>
                      <button
                        className={styles.linkButton}
                        type="button"
                        onClick={() => {
                          void copyText(result.payload.canonicalUrl);
                        }}
                      >
                        复制页链
                      </button>
                    </div>

                    {result.payload.video ? (
                      <section className={styles.cardSection}>
                        <span className={styles.cardLabel}>视频链接</span>
                        <div className={styles.mediaGrid}>
                          <div className={styles.mediaRow}>
                            <div className={styles.mediaMeta}>
                              <span className={styles.mediaStrong}>
                                {result.payload.video.best.definition} ·{" "}
                                {result.payload.video.best.width}×
                                {result.payload.video.best.height}
                              </span>
                              <span className={styles.mediaSubtle}>
                                水印状态：{result.payload.video.watermark} · 共{" "}
                                {result.payload.video.formats.length} 个清晰度版本
                              </span>
                            </div>
                            <button
                              className={styles.linkButton}
                              type="button"
                              onClick={() => {
                                void copyText(result.payload.video!.best.url);
                              }}
                            >
                              复制直链
                            </button>
                          </div>
                        </div>
                      </section>
                    ) : null}

                    {result.payload.images ? (
                      <section className={styles.cardSection}>
                        <span className={styles.cardLabel}>
                          图片原图 · {result.payload.images.length}
                        </span>
                        <div className={styles.linkStack}>
                          {previewImages.map((image) => {
                            const isMore = image.url.startsWith("+");
                            return (
                              <div
                                className={styles.mediaRow}
                                key={`${result.payload.id}-${image.index}`}
                              >
                                <div className={styles.mediaMeta}>
                                  <span className={styles.mediaStrong}>
                                    {isMore
                                      ? image.url
                                      : `#${image.index} · ${image.width ?? "?"}×${image.height ?? "?"}`}
                                  </span>
                                  <span className={styles.mediaSubtle}>
                                    {isMore ? "其余图片" : image.url}
                                  </span>
                                </div>
                                {!isMore ? (
                                  <button
                                    className={styles.linkButton}
                                    type="button"
                                    onClick={() => {
                                      void copyText(image.url);
                                    }}
                                  >
                                    复制
                                  </button>
                                ) : null}
                              </div>
                            );
                          })}
                          <div className={styles.mediaRow}>
                            <div className={styles.mediaMeta}>
                              <span className={styles.mediaStrong}>全部原图链接</span>
                              <span className={styles.mediaSubtle}>
                                一次性复制当前卡片下的全部图片地址
                              </span>
                            </div>
                            <button
                              className={styles.linkButton}
                              type="button"
                              onClick={() => {
                                void copyText(
                                  result.payload.images!
                                    .map((image) => image.url)
                                    .join("\n"),
                                );
                              }}
                            >
                              全部复制
                            </button>
                          </div>
                        </div>

                        {livePhotoImages.length > 0 ? (
                          <>
                            <span className={styles.cardLabel}>
                              Live Photo 动图 · {livePhotoImages.length}
                            </span>
                            <div className={styles.linkStack}>
                              {livePhotoImages.map((image) => (
                                <div
                                  className={styles.mediaRow}
                                  key={`${result.payload.id}-motion-${image.index}`}
                                >
                                  <div className={styles.mediaMeta}>
                                    <span className={styles.mediaStrong}>
                                      #{image.index} 动态资源
                                    </span>
                                    <span className={styles.mediaSubtle}>{image.motionUrl}</span>
                                  </div>
                                  <button
                                    className={styles.linkButton}
                                    type="button"
                                    onClick={() => {
                                      void copyText(image.motionUrl!);
                                    }}
                                  >
                                    复制
                                  </button>
                                </div>
                              ))}
                              <div className={styles.mediaRow}>
                                <div className={styles.mediaMeta}>
                                  <span className={styles.mediaStrong}>全部动态图链接</span>
                                  <span className={styles.mediaSubtle}>
                                    一次性复制当前卡片下的全部动态资源地址
                                  </span>
                                </div>
                                <button
                                  className={styles.linkButton}
                                  type="button"
                                  onClick={() => {
                                    void copyText(
                                      livePhotoImages
                                        .map((image) => image.motionUrl)
                                        .filter((url): url is string => Boolean(url))
                                        .join("\n"),
                                    );
                                  }}
                                >
                                  全部复制
                                </button>
                              </div>
                            </div>
                          </>
                        ) : null}
                      </section>
                    ) : null}

                    <p className={styles.statusText}>
                      {result.payload.limitations.join(" ")}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
