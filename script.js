/* =========================================================
   フットケアサロン集客支援ツール
   - salon-config.json を読み込み、フォームへ反映
   - フォーム内容から4種のAIプロンプトを生成
   - 外部通信なし(config読込のみ同一オリジンのfetch)
   ========================================================= */

(() => {
  "use strict";

  const STORAGE_KEY = "footcare-salon-config-v1";
  const PASTE_STORAGE_KEY = "footcare-salon-pasted-v1";

  const EMPTY_CONFIG = {
    salonName: "",
    strengths: [],
    differentiators: [],
    targetArea: "",
    priceRange: "",
    lineAccountName: "",
    otherNotes: "",
  };

  /** salon-config.json の内容(リセット用に保持) */
  let fileConfig = { ...EMPTY_CONFIG };

  /* ---------- utilities ---------- */

  const $ = (id) => document.getElementById(id);

  const linesToArray = (text) =>
    text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

  const arrayToLines = (arr) => (Array.isArray(arr) ? arr.join("\n") : "");

  const orPlaceholder = (value, label) =>
    value && value.trim() ? value.trim() : `（${label}：未入力）`;

  const listOrPlaceholder = (arr, label) =>
    arr && arr.length
      ? arr.map((s) => `- ${s}`).join("\n")
      : `- （${label}：未入力）`;

  /* ---------- config load / save ---------- */

  function readForm() {
    return {
      salonName: $("salonName").value.trim(),
      strengths: linesToArray($("strengths").value),
      differentiators: linesToArray($("differentiators").value),
      targetArea: $("targetArea").value.trim(),
      priceRange: $("priceRange").value.trim(),
      lineAccountName: $("lineAccountName").value.trim(),
      otherNotes: $("otherNotes").value.trim(),
    };
  }

  function fillForm(cfg) {
    $("salonName").value = cfg.salonName || "";
    $("strengths").value = arrayToLines(cfg.strengths);
    $("differentiators").value = arrayToLines(cfg.differentiators);
    $("targetArea").value = cfg.targetArea || "";
    $("priceRange").value = cfg.priceRange || "";
    $("lineAccountName").value = cfg.lineAccountName || "";
    $("otherNotes").value = cfg.otherNotes || "";
  }

  function saveLocal(cfg) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch (_) {
      /* プライベートモード等では無視 */
    }
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function savePastedLocal() {
    try {
      localStorage.setItem(PASTE_STORAGE_KEY, JSON.stringify(readPasted()));
    } catch (_) {}
  }

  function loadPastedLocal() {
    try {
      const raw = localStorage.getItem(PASTE_STORAGE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      $("paste-research").value = p.research || "";
      $("paste-content").value = p.content || "";
      $("paste-marketing").value = p.marketing || "";
    } catch (_) {}
  }

  async function loadFileConfig() {
    try {
      const res = await fetch("salon-config.json", { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      const json = await res.json();
      return { ...EMPTY_CONFIG, ...json };
    } catch (_) {
      // file:// で直接開いた場合など。手入力で利用可能。
      return null;
    }
  }

  /* ---------- prompt templates ---------- */

  function readPasted() {
    return {
      research: $("paste-research").value.trim(),
      content: $("paste-content").value.trim(),
      marketing: $("paste-marketing").value.trim(),
    };
  }

  function pastedBlock(text, label) {
    return text ? text : `(まだ貼り付けられていません。${label}の回答をこのページの入力欄に貼り付けると、ここに自動で反映されます)`;
  }

  function buildPrompts(cfg, pasted) {
    pasted = pasted || { research: "", content: "", marketing: "" };
    const name = orPlaceholder(cfg.salonName, "サロン名");
    const area = orPlaceholder(cfg.targetArea, "対象エリア");
    const price = orPlaceholder(cfg.priceRange, "価格帯");
    const line = orPlaceholder(cfg.lineAccountName, "LINEアカウント名");
    const notes = orPlaceholder(cfg.otherNotes, "その他メモ");
    const strengths = listOrPlaceholder(cfg.strengths, "強み");
    const diffs = listOrPlaceholder(cfg.differentiators, "差別化ポイント");

    const salonBlock = `【サロン基本情報】
・サロン名:${name}
・対象エリア:${area}
・価格帯:${price}
・公式LINE:${line}
・サロンの強み:
${strengths}
・差別化ポイント:
${diffs}
・その他メモ:${notes}`;

    /* ---------- ① リサーチ ---------- */
    const research = `あなたはフットケア・美容ヘルスケア業界に精通したマーケティングリサーチャーです。以下のフットケアサロンについて、SNS集客の土台となるリサーチを行ってください。

${salonBlock}

【依頼内容】
以下の3つのタスクを順番に実行し、それぞれ指定の形式で出力してください。

■タスク1:ペルソナ設計(ペルソナシート形式)
このサロンの見込み客として最も有望なペルソナを3名設計してください。各ペルソナについて、次の項目を埋めたペルソナシートを作成してください。
・名前(仮名)/年齢/性別/職業/居住エリア(${area}を前提)
・足に関する悩み(具体的な症状・困りごと)
・その悩みが日常生活に与えている影響
・これまで試した対処法と、それが解決に至らなかった理由
・サロン利用への不安・ためらい(価格、痛み、恥ずかしさ等)
・情報収集に使うSNS・メディアと利用時間帯
・来店の決め手になりそうな一言・オファー

■タスク2:悩み・ニーズの言語化(悩みリスト形式)
上記ペルソナが検索・投稿しそうな「悩みの言葉」を、本人が実際に使う口語表現で30個リストアップしてください。
・「巻き爪 痛い 歩けない」のような検索キーワード型と、「サンダル履けないのがつらい」のような感情表現型の両方を含めること
・悩みの深さ(軽い違和感/日常に支障/医療が必要かも)で3段階に分類すること

■タスク3:地域競合分析と差別化ポジショニング
${area}における競合(フットケアサロン、ネイルサロンの角質ケアメニュー、皮膚科・フットケア外来、リフレクソロジー等)を想定し、以下を出力してください。
・競合タイプ別の強み・弱みの整理表
・このサロンの強み・差別化ポイントを踏まえた「ポジショニングマップ」(軸を2本設定し、テキストで図解)
・SNS発信で繰り返し打ち出すべき「差別化メッセージ」を3案(それぞれ30文字以内のコピー+補足説明)

【出力ルール】
・すべて日本語で、見出しを立てて整理すること
・推測で補った部分は「(仮説)」と明記すること
・最後に「このリサーチ結果をコンテンツ制作・マーケティング施策に渡す際の要約(300字以内)」を付けること`;

    /* ---------- ② コンテンツ制作 ---------- */
    const content = `あなたはフットケアサロン専門のSNSコンテンツプランナー兼コピーライターです。以下のサロンの、1週間分のSNS投稿コンテンツを制作してください。

${salonBlock}

【前提資料】
このプロンプトの直後に、リサーチチームが作成した「ペルソナシート」「悩みリスト」「差別化ポジショニング」を貼り付けます。制作するすべてのコンテンツは、そのペルソナの悩みの言葉と差別化メッセージを必ず反映させてください。

▼ここにリサーチ結果を貼り付け▼
${pastedBlock(pasted.research, "①リサーチ")}
▲貼り付けここまで▲

【依頼内容】
以下の2種類のコンテンツを制作し、最後に週次投稿カレンダーにまとめてください。

■タスク1:テキスト投稿案(Threads/note用)
・Threads用:短文投稿を5本。各投稿は「悩みへの共感 → 気づき・豆知識 → サロン視点のひとこと」の流れで、押し売り感のない専門家のトーンで書くこと。ハッシュタグ案も添えること。
・note用:記事案を1本。タイトル案3つ、リード文、見出し構成(H2/H3)、各見出しの要点、結びで公式LINE(${line})へ自然につなぐ一文まで作成すること。

■タスク2:リール等ショート動画の構成案
2本分を作成してください。各動画について:
・テーマとターゲットペルソナ(貼り付けたペルソナから指定)
・冒頭2秒のフック(セリフ・テロップ案)
・カット割り表(カット番号/秒数/映像内容/テロップ/ナレーションまたはセリフ)※15〜30秒想定
・キャプション文とハッシュタグ案
・撮影時の注意点(施術映像の見せ方、清潔感の演出など)

■タスク3:週次投稿カレンダー
上記コンテンツを月曜〜日曜に割り付けた表を作成してください。
列:曜日/媒体(Threads・note・リール)/投稿タイトルまたは冒頭文/狙い(認知・共感・教育・行動喚起のどれか)/CTA(公式LINE誘導の有無と文言)

【出力ルール】
・すべて日本語。医療行為と誤認される表現(「治る」「治療」等)は避け、薬機法・医療広告に配慮した言い回しにすること
・各投稿に「このペルソナのこの悩みに対応」という対応関係を1行で明記すること`;

    /* ---------- ③ マーケティング ---------- */
    const marketing = `あなたはサロン業態に強いマーケティングストラテジストです。以下のフットケアサロンについて、SNSから公式LINE、そして初回予約獲得までの営業戦略を設計してください。

${salonBlock}

【前提資料】
可能であれば、リサーチチームの出力(ペルソナ・悩みリスト・差別化ポジショニング)をこの下に貼り付けてください。貼り付けがない場合は、上記のサロン情報から妥当な仮説を置いて設計してください。

▼リサーチ結果があればここに貼り付け▼
${pasted.research ? pasted.research : "(任意。①の回答を貼り付けると、ここに自動で反映されます)"}
▲貼り付けここまで▲

【依頼内容】

■タスク1:SNS→LINE→予約のファネル設計
・「認知(SNS)→興味(プロフィール・固定投稿)→登録(公式LINE ${line})→信頼醸成(LINE配信)→初回予約→再来店」の各段階について、目的/主要施策/計測すべき指標(KPI)を表形式で整理すること
・各段階の想定離脱理由と、その対策を必ずセットで書くこと

■タスク2:LINE登録特典の設計
公式LINEへの登録を促す特典を3案設計してください。各案について:
・特典内容(例:足の健康セルフチェックシート、初回◯円オフ等。価格帯「${price}」と矛盾しない設計にすること)
・訴求コピー(SNSプロフィールや投稿末尾に使える1〜2行)
・原価・手間の目安と、値引きに頼りすぎないための工夫

■タスク3:初回予約のハードルを下げる施策
・予約前の不安(痛みへの不安、症状を見せる恥ずかしさ、価格不安、勧誘への警戒)それぞれに対応する施策を提案すること
・LINE登録から初回予約までのステップ配信シナリオ(登録直後/翌日/3日後/7日後の4通)を、実際の配信文面つきで作成すること
・予約導線の文言例(「まずはLINEで足の写真を送ってご相談ください」等、行動の心理的コストが低いCTA)を5つ提案すること

【出力ルール】
・すべて日本語。地域(${area})の生活動線・客層を考慮した現実的な施策にすること
・「今すぐ無料でできること」「少額の投資でできること」「余裕があればやること」の3段階に施策を分類して締めくくること`;

    /* ---------- ④ 統合ディレクター ---------- */
    const director = `あなたはフットケアサロン「${name}」の集客プロジェクトを統括するディレクターです。以下に、リサーチチーム(①)、コンテンツ制作チーム(②)、マーケティングチーム(③)の成果物を貼り付けます。これらを統合し、「今週やるべきこと」形式の実行プランに変換してください。

【サロン基本情報(再掲)】
・サロン名:${name} / エリア:${area} / 価格帯:${price} / 公式LINE:${line}
・補足:${notes}

▼①リサーチチームの出力▼
${pastedBlock(pasted.research, "①リサーチ")}
▲貼り付けここまで▲

▼②コンテンツ制作チームの出力▼
${pastedBlock(pasted.content, "②コンテンツ制作")}
▲貼り付けここまで▲

▼③マーケティングチームの出力▼
${pastedBlock(pasted.marketing, "③マーケティング")}
▲貼り付けここまで▲

【依頼内容】

■タスク1:統合レビュー
3チームの成果物を読み、以下を簡潔に出力してください。
・3つの成果物の間で一貫しているメッセージ(強み)
・矛盾・重複・抜け漏れ(あれば修正方針も)

■タスク2:今週の実行プラン
今週(月曜〜日曜)にやるべきことを、次の表形式で作成してください。
列:優先度(A:今週必須/B:できれば今週/C:来週以降でも可)/タスク内容/所要時間の目安/担当(自分/外注・ツール推奨/家族・スタッフ)/完了の定義(何ができたら完了か)

作成にあたっての条件:
・サロンワーク(施術)と並行できる現実的な作業量にすること。1日の集客作業は合計60〜90分以内を想定
・「外注・ツール推奨」とした項目には、外注先の探し方または使えるツール名の例を添えること
・投稿系タスクは②の週次カレンダーと整合させること
・LINE・予約導線系タスクは③の施策から優先度の高いものを選ぶこと

■タスク3:振り返りの仕組み
週末に10分でできる振り返りチェックリスト(5項目以内)と、翌週のプラン修正の判断基準(例:LINE登録が◯件未満なら特典を見直す)を作成してください。

【出力ルール】
・すべて日本語。抽象的なアドバイスではなく、そのまま着手できる粒度まで具体化すること
・最後に「今週これだけは外さない最重要タスク」を1つだけ選び、理由を添えること`;

    return { research, content, marketing, director };
  }

  /* ---------- render ---------- */

  function renderPrompts() {
    const cfg = readForm();
    const pasted = readPasted();
    const prompts = buildPrompts(cfg, pasted);

    for (const key of ["research", "content", "marketing", "director"]) {
      const pre = $(`prompt-${key}`);
      pre.textContent = prompts[key];
      const counter = document.querySelector(`[data-count-for="${key}"]`);
      if (counter) counter.textContent = `${prompts[key].length.toLocaleString()} 文字`;
    }
  }

  /* ---------- toast ---------- */

  let toastTimer = null;
  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  /* ---------- copy ---------- */

  async function copyPrompt(key, button) {
    const text = $(`prompt-${key}`).textContent;
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      // クリップボードAPIが使えない環境向けフォールバック
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    button.classList.add("is-copied");
    const original = button.textContent;
    button.textContent = "コピーしました";
    showToast("プロンプトをコピーしました");
    setTimeout(() => {
      button.classList.remove("is-copied");
      button.textContent = original;
    }, 1800);
  }

  /* ---------- tabs ---------- */

  function initTabs() {
    const tabs = Array.from(document.querySelectorAll(".tab"));
    const panels = {
      research: $("tab-research"),
      content: $("tab-content"),
      marketing: $("tab-marketing"),
      director: $("tab-director"),
    };

    function activate(tab) {
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", String(active));
        t.tabIndex = active ? 0 : -1;
      });
      Object.entries(panels).forEach(([key, panel]) => {
        const active = key === tab.dataset.tab;
        panel.hidden = !active;
        panel.classList.toggle("is-active", active);
      });
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => activate(tab));
      tab.addEventListener("keydown", (e) => {
        let next = null;
        if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
        if (next) {
          e.preventDefault();
          next.focus();
          activate(next);
        }
      });
    });
  }

  /* ---------- init ---------- */

  async function init() {
    initTabs();

    fileConfig = (await loadFileConfig()) || { ...EMPTY_CONFIG };
    const local = loadLocal();
    fillForm(local || fileConfig);
    loadPastedLocal();
    renderPrompts();

    ["paste-research", "paste-content", "paste-marketing"].forEach((id) => {
      $(id).addEventListener("input", () => {
        savePastedLocal();
        renderPrompts();
      });
    });

    if (local) {
      $("save-status").textContent = "このブラウザに保存された内容を読み込みました";
    } else if (fileConfig.salonName) {
      $("save-status").textContent = "salon-config.json を読み込みました";
    }

    $("apply-btn").addEventListener("click", () => {
      const cfg = readForm();
      saveLocal(cfg);
      renderPrompts();
      $("save-status").textContent = "プロンプトを更新しました(このブラウザに一時保存)";
      showToast("プロンプトを更新しました");
    });

    $("reset-btn").addEventListener("click", () => {
      fillForm(fileConfig);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
      renderPrompts();
      $("save-status").textContent = "salon-config.json の内容に戻しました";
      showToast("設定ファイルの内容に戻しました");
    });

    document.querySelectorAll(".btn-copy").forEach((btn) => {
      btn.addEventListener("click", () => copyPrompt(btn.dataset.copy, btn));
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
