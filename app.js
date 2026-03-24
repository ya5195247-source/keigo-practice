// ========== State ==========
let currentCategory = null;
let currentLevel = "normal"; // easy / normal / hard
let questions = [];
let currentIndex = 0;
let score = 0;
let answered = false;
let wrongInSession = [];
let timerId = null;
const TIME_LIMIT = 15; // 秒

// ========== DOM ==========
const $ = (sel) => document.querySelector(sel);

// ========== Difficulty Config ==========
const LEVELS = {
  easy:   { name: "初級", emoji: "🟢", count: 5,  description: "基本の敬語から出題" },
  normal: { name: "中級", emoji: "🟡", count: 10, description: "実践レベルの敬語" },
  hard:   { name: "上級", emoji: "🔴", count: 15, description: "社会人ガチ勝負" }
};

// ========== LocalStorage ==========
const Storage = {
  _get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
  },
  _set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },

  // 最高スコア（カテゴリ+レベル別）
  _bestKey(category, level) { return `${category}_${level}`; },
  getBestScore(category, level) {
    const key = this._bestKey(category, level || "normal");
    return this._get("keigo_best", {})[key] || 0;
  },
  getBestScoreAny(category) {
    // 全レベルの最高を返す（カテゴリカード表示用）
    const best = this._get("keigo_best", {});
    let max = 0;
    for (const lvl of ["easy","normal","hard"]) {
      const v = best[this._bestKey(category, lvl)] || 0;
      if (v > max) max = v;
    }
    return max;
  },
  saveBestScore(category, level, pct) {
    const best = this._get("keigo_best", {});
    const key = this._bestKey(category, level);
    if (pct > (best[key] || 0)) {
      best[key] = pct;
      this._set("keigo_best", best);
      return true;
    }
    return false;
  },

  // 苦手問題
  addWrong(questionText) {
    const weak = this._get("keigo_weak", {});
    weak[questionText] = (weak[questionText] || 0) + 1;
    this._set("keigo_weak", weak);
  },
  getWeakList() {
    const weak = this._get("keigo_weak", {});
    return Object.entries(weak).sort((a, b) => b[1] - a[1]).slice(0, 10);
  },
  clearWeak() {
    this._set("keigo_weak", {});
  },

  // スコアランキング（カテゴリ+レベル別、直近10件）
  addRankEntry(category, level, pct) {
    const key = "keigo_rank";
    const ranks = this._get(key, []);
    ranks.unshift({
      category, level, pct,
      date: new Date().toLocaleDateString("ja-JP", { month: "short", day: "numeric" }),
      catName: CATEGORY_INFO[category]?.name || "ランダム",
      lvlName: LEVELS[level]?.name || "中級"
    });
    this._set(key, ranks.slice(0, 20));
  },
  getRanking() {
    return this._get("keigo_rank", []);
  }
};

// ========== Confetti ==========
function spawnConfetti() {
  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = Array.from({ length: 60 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 40,
    w: 6 + Math.random() * 6,
    h: 4 + Math.random() * 4,
    color: ["#6C63FF","#FF6B6B","#4CAF50","#FFD93D","#FF9800","#E91E63"][Math.floor(Math.random()*6)],
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 3,
    rot: Math.random() * 360,
    vr: (Math.random() - 0.5) * 10
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.rot += p.vr;
      if (p.y < canvas.height + 20) alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - frame / 120);
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    }
    frame++;
    if (alive && frame < 120) requestAnimationFrame(draw);
    else canvas.remove();
  }
  draw();
}

// ========== Theme ==========
function initTheme() {
  const saved = localStorage.getItem("keigo_theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeBtn(saved);
}

function updateThemeBtn(theme) {
  const btn = $("#themeToggle");
  if (!btn) return;
  const isDark = theme === "dark";
  btn.classList.toggle("is-dark", isDark);
  btn.setAttribute("aria-pressed", String(isDark));

  // Update theme-color meta tags for browser UI
  const themeColor = isDark ? "#1A1A2E" : "#6C63FF";
  document.querySelectorAll('meta[name="theme-color"]').forEach(function(meta) {
    meta.setAttribute("content", themeColor);
  });
}

// ========== Init ==========
function init() {
  initTheme();

  // Hide SEO fallback (keep in DOM for crawlers), remove skeleton & loading
  var el;
  el = $("#seo-content"); if (el) el.classList.add("visually-hidden");
  el = $("#skeleton"); if (el) el.remove();
  el = $("#loading-region"); if (el) el.remove();

  showSplash();

  // Theme toggle
  const themeBtn = $("#themeToggle");
  themeBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("keigo_theme", next);
    updateThemeBtn(next);
  });

  // Sound toggle
  const soundBtn = $("#soundToggle");
  soundBtn.addEventListener("click", () => {
    const on = SoundManager.toggle();
    soundBtn.classList.toggle("is-muted", !on);
    soundBtn.classList.toggle("toggled-off", !on);
    soundBtn.setAttribute("aria-pressed", String(on));
  });
}

// ========== Splash Screen ==========
function showSplash() {
  const main = $("#main");
  main.innerHTML = `
    <div class="splash-screen">
      <div class="splash-icon">敬</div>
      <h2 class="splash-title">ケイゴマスター</h2>
      <p class="splash-sub">新社会人のための敬語練習クイズ</p>
      <button class="splash-start-btn" id="splashStart">はじめる</button>
      <div class="splash-stats">
        <span>全${Object.values(QUESTIONS).reduce((a, b) => a + b.length, 0)}問収録</span>
        <span>4カテゴリ</span>
        <span>3つの難易度</span>
      </div>
    </div>
  `;
  $("#splashStart").addEventListener("click", () => {
    main.querySelector(".splash-screen").classList.add("splash-exit");
    setTimeout(showCategorySelect, 300);
  });
}

// ========== Category Select ==========
function showCategorySelect() {
  currentCategory = null;
  questions = [];
  currentIndex = 0;
  score = 0;
  answered = false;
  wrongInSession = [];

  const weakList = Storage.getWeakList();
  const ranking = Storage.getRanking();

  const main = $("#main");
  main.innerHTML = `
    <div class="category-screen">
      <h2 class="section-title">カテゴリを選んでね</h2>
      <p class="section-sub">気になるジャンルをタップしてスタート！</p>
      <div class="category-grid">
        ${Object.entries(CATEGORY_INFO).map(([key, info]) => {
          const best = Storage.getBestScoreAny(key);
          return `
          <button class="category-card" data-category="${key}">
            <span class="category-emoji">${info.emoji}</span>
            <span class="category-name">${info.name}</span>
            <span class="category-desc">${info.description}</span>
            ${best > 0 ? `<span class="category-best">Best: ${best}%</span>` : ""}
          </button>`;
        }).join("")}
      </div>

      ${ranking.length > 0 ? `
        <div class="ranking-section">
          <h3 class="ranking-title">スコア履歴</h3>
          <div class="ranking-list">
            ${ranking.slice(0, 8).map((r, i) => `
              <div class="ranking-item">
                <span class="ranking-num">${i + 1}</span>
                <span class="ranking-info">${r.catName}（${r.lvlName}）</span>
                <span class="ranking-pct">${r.pct}%</span>
                <span class="ranking-date">${r.date}</span>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      ${weakList.length > 0 ? `
        <div class="weak-section">
          <h3 class="weak-title">苦手な問題 TOP${weakList.length}</h3>
          <ul class="weak-list">
            ${weakList.map(([q, count]) => `
              <li class="weak-item">
                <span class="weak-q">${q}</span>
                <span class="weak-count">${count}回ミス</span>
              </li>
            `).join("")}
          </ul>
          <button class="weak-clear-btn" id="clearWeakBtn">苦手リストをリセット</button>
        </div>
      ` : ""}
    </div>
  `;

  main.querySelectorAll(".category-card").forEach(btn => {
    btn.addEventListener("click", () => showLevelSelect(btn.dataset.category));
  });

  const clearBtn = $("#clearWeakBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      Storage.clearWeak();
      showCategorySelect();
    });
  }
}

// ========== Level Select ==========
function showLevelSelect(category) {
  currentCategory = category;
  const catInfo = CATEGORY_INFO[category];
  const main = $("#main");

  main.innerHTML = `
    <div class="level-screen">
      <button class="back-btn level-back" id="levelBack">← カテゴリに戻る</button>
      <div class="level-header">
        <span class="level-header-emoji">${catInfo.emoji}</span>
        <h2 class="level-header-name">${catInfo.name}</h2>
      </div>
      <p class="section-sub">難易度を選んでね</p>
      <div class="level-grid">
        ${Object.entries(LEVELS).map(([key, lvl]) => {
          const best = Storage.getBestScore(category, key);
          return `
          <button class="level-card" data-level="${key}">
            <span class="level-emoji">${lvl.emoji}</span>
            <span class="level-name">${lvl.name}</span>
            <span class="level-desc">${lvl.description}（${lvl.count}問）</span>
            ${best > 0 ? `<span class="level-best">Best: ${best}%</span>` : ""}
          </button>`;
        }).join("")}
      </div>
    </div>
  `;

  main.querySelectorAll(".level-card").forEach(btn => {
    btn.addEventListener("click", () => {
      currentLevel = btn.dataset.level;
      startQuiz(currentCategory);
    });
  });

  $("#levelBack").addEventListener("click", showCategorySelect);
}

// ========== Countdown ==========
function showCountdown() {
  const main = $("#main");
  const catInfo = CATEGORY_INFO[currentCategory];
  const lvl = LEVELS[currentLevel];

  main.innerHTML = `
    <div class="countdown-screen">
      <div class="countdown-info">${catInfo.emoji} ${catInfo.name}（${lvl.name}）</div>
      <div class="countdown-number" id="countNum">3</div>
    </div>
  `;

  const el = $("#countNum");
  let count = 3;

  const interval = setInterval(() => {
    count--;
    if (count > 0) {
      el.textContent = count;
      el.classList.remove("countdown-pop");
      void el.offsetWidth; // reflow
      el.classList.add("countdown-pop");
    } else {
      clearInterval(interval);
      el.textContent = "GO!";
      el.classList.remove("countdown-pop");
      void el.offsetWidth;
      el.classList.add("countdown-pop");
      setTimeout(() => startQuiz(currentCategory), 400);
    }
  }, 700);
}

// ========== Quiz ==========
function startQuiz(category) {
  currentCategory = category;
  currentIndex = 0;
  score = 0;
  answered = false;
  wrongInSession = [];

  const count = LEVELS[currentLevel].count;

  if (category === "random") {
    const all = [];
    for (const [cat, qs] of Object.entries(QUESTIONS)) {
      qs.forEach(q => all.push({ ...q, category: cat }));
    }
    questions = shuffle(all).slice(0, count);
  } else {
    questions = shuffle([...QUESTIONS[category]]).slice(0, count);
  }

  renderQuestion();
}

function renderQuestion() {
  answered = false;
  const q = questions[currentIndex];
  const main = $("#main");

  main.innerHTML = `
    <div class="quiz-screen">
      <div class="quiz-progress">
        <button class="back-btn" id="backBtn" aria-label="メニューに戻る">← 戻る</button>
        <div class="progress-bar">
          <div class="progress-fill" id="progressFill"></div>
        </div>
        <span class="progress-text">${currentIndex + 1} / ${questions.length}</span>
      </div>
      <div class="quiz-timer">
        <div class="timer-bar" id="timerBar"></div>
      </div>
      <div class="timer-text" id="timerText">${TIME_LIMIT}</div>
      <div class="quiz-card slide-in">
        <div class="quiz-question">${q.question}</div>
        <div class="quiz-choices">
          ${q.choices.map((c, i) => `
            <button class="choice-btn choice-stagger choice-delay-${i}" data-index="${i}">${c}</button>
          `).join("")}
        </div>
        <div class="quiz-feedback hidden" id="feedback" aria-live="assertive" role="status"></div>
      </div>
    </div>
  `;

  main.querySelectorAll(".choice-btn").forEach(btn => {
    btn.addEventListener("click", () => handleAnswer(parseInt(btn.dataset.index)));
  });

  $("#backBtn").addEventListener("click", () => {
    clearTimer();
    if (confirm("メニューに戻りますか？（進捗はリセットされます）")) {
      showCategorySelect();
    } else {
      startTimer();
    }
  });

  // Set progress width via CSS custom property
  const pFill = $("#progressFill");
  if (pFill) pFill.style.setProperty("--progress-w", (currentIndex / questions.length * 100) + "%");

  startTimer();
}

function startTimer() {
  clearTimer();
  let remaining = TIME_LIMIT;
  const bar = $("#timerBar");
  const text = $("#timerText");
  if (!bar || !text) return;

  bar.classList.remove("timer-danger", "timer-running");
  text.classList.remove("timer-danger-text");

  // Reset then animate via class
  requestAnimationFrame(() => {
    bar.classList.add("timer-running");
  });

  timerId = setInterval(() => {
    remaining--;
    if (text) text.textContent = remaining;

    if (remaining <= 5) {
      bar.classList.add("timer-danger");
      text.classList.add("timer-danger-text");
    }

    if (remaining <= 0) {
      clearTimer();
      handleTimeout();
    }
  }, 1000);
}

function clearTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  var el;
  el = document.querySelector(".quiz-timer"); if (el) el.classList.add("timer-hidden");
  el = document.querySelector(".timer-text"); if (el) el.classList.add("timer-hidden");
}

function handleTimeout() {
  if (answered) return;
  answered = true;

  SoundManager.wrong();
  const q = questions[currentIndex];
  Storage.addWrong(q.question);
  wrongInSession.push(q);

  const buttons = document.querySelectorAll(".choice-btn");
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answer) btn.classList.add("correct");
  });

  const feedback = $("#feedback");
  feedback.classList.remove("hidden");
  feedback.innerHTML = `
    <div class="feedback-result feedback-wrong">⏰ 時間切れ！</div>
    <div class="feedback-explanation">${q.explanation}</div>
    <button class="next-btn" id="nextBtn">
      ${currentIndex < questions.length - 1 ? "次の問題へ →" : "結果を見る 📊"}
    </button>
  `;

  $("#nextBtn").addEventListener("click", () => {
    currentIndex++;
    if (currentIndex < questions.length) {
      renderQuestion();
    } else {
      showResult();
    }
  });
}

function handleAnswer(selectedIndex) {
  if (answered) return;
  answered = true;
  clearTimer();

  const q = questions[currentIndex];
  const isCorrect = selectedIndex === q.answer;
  if (isCorrect) {
    score++;
    SoundManager.correct();
    spawnConfetti();
  } else {
    SoundManager.wrong();
    Storage.addWrong(q.question);
    wrongInSession.push(q);
  }

  const buttons = document.querySelectorAll(".choice-btn");
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.answer) {
      btn.classList.add("correct");
    } else if (i === selectedIndex && !isCorrect) {
      btn.classList.add("wrong");
    }
  });

  const feedback = $("#feedback");
  feedback.classList.remove("hidden");
  feedback.innerHTML = `
    <div class="feedback-result ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}">
      ${isCorrect ? "⭕ 正解！" : "❌ 不正解..."}
    </div>
    <div class="feedback-explanation">${q.explanation}</div>
    <button class="next-btn" id="nextBtn">
      ${currentIndex < questions.length - 1 ? "次の問題へ →" : "結果を見る 📊"}
    </button>
  `;

  $("#nextBtn").addEventListener("click", () => {
    currentIndex++;
    if (currentIndex < questions.length) {
      renderQuestion();
    } else {
      showResult();
    }
  });
}

// ========== Result ==========
function showResult() {
  const percentage = Math.round((score / questions.length) * 100);
  const isNewBest = Storage.saveBestScore(currentCategory, currentLevel, percentage);
  Storage.addRankEntry(currentCategory, currentLevel, percentage);
  const { level, message, emoji } = getLevel(percentage);
  const catName = CATEGORY_INFO[currentCategory]?.name || "ランダム";
  const lvlName = LEVELS[currentLevel]?.name || "中級";
  const siteUrl = location.href.split("?")[0];

  const answerMarks = questions.map(q => wrongInSession.includes(q) ? "❌" : "⭕").join("");

  const shareText = `【ケイゴマスター】${catName}編（${lvlName}）\n${emoji} ${level}（${percentage}%）\n${answerMarks}\n${score}/${questions.length}問正解！\n\nあなたも挑戦してみよう！\n${siteUrl}`;

  if (percentage === 100) spawnConfetti();

  const main = $("#main");
  main.innerHTML = `
    <div class="result-screen">
      <div class="result-card">
        <div class="result-emoji">${emoji}</div>
        <div class="result-score">${score} / ${questions.length} 問正解</div>
        <div class="result-percentage">${percentage}%</div>
        ${isNewBest ? `<div class="new-best">🎉 ベストスコア更新！</div>` : ""}
        <div class="result-level">${level}</div>
        <div class="result-badge">${catName} ／ ${lvlName}</div>
        <div class="result-message">${message}</div>
        <div class="result-bar">
          <div class="result-bar-fill" id="resultBarFill" data-target="${percentage}"></div>
        </div>
        <div class="result-marks">${answerMarks}</div>
      </div>

      <div class="share-section">
        <p class="share-label">結果をシェアしよう！</p>
        <div class="share-buttons">
          <button class="share-btn share-x" id="shareX">𝕏 でシェア</button>
          <button class="share-btn share-line" id="shareLine">LINE でシェア</button>
          <button class="share-btn share-copy" id="shareCopy">📋 コピー</button>
        </div>
      </div>

      ${wrongInSession.length > 0 ? `
        <div class="wrong-review">
          <h3 class="wrong-review-title">今回間違えた問題（${wrongInSession.length}問）</h3>
          ${wrongInSession.map(q => `
            <div class="wrong-review-item">
              <div class="wrong-review-q">${q.question}</div>
              <div class="wrong-review-a">正解: ${q.choices[q.answer]}</div>
              <div class="wrong-review-exp">${q.explanation}</div>
            </div>
          `).join("")}
        </div>
      ` : ""}

      <!-- 広告ユニット: 結果画面（AdSense実装時にad-slotを差し替え） -->
      <div class="ad-unit" id="ad-result"></div>
      <div class="result-actions">
        ${wrongInSession.length > 0 ? `<button class="action-btn primary" id="retryWrongBtn">間違えた問題だけやり直す 🔥</button>` : ""}
        <button class="action-btn ${wrongInSession.length > 0 ? 'secondary' : 'primary'}" id="retryBtn">もう一度挑戦する 🔄</button>
        <button class="action-btn secondary" id="categoryBtn">カテゴリ選択に戻る 📚</button>
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    setTimeout(() => {
      const fill = $("#resultBarFill");
      if (fill) {
        fill.style.setProperty("--result-w", fill.dataset.target + "%");
        fill.classList.add("result-bar-animate");
      }
    }, 100);
  });

  $("#shareX").addEventListener("click", () => {
    window.open("https://x.com/intent/tweet?text=" + encodeURIComponent(shareText), "_blank");
  });
  $("#shareLine").addEventListener("click", () => {
    window.open("https://social-plugins.line.me/lineit/share?url=" + encodeURIComponent(siteUrl) + "&text=" + encodeURIComponent(shareText), "_blank");
  });
  $("#shareCopy").addEventListener("click", () => {
    navigator.clipboard.writeText(shareText).then(() => {
      const btn = $("#shareCopy");
      btn.textContent = "✅ コピーしました！";
      setTimeout(() => { btn.textContent = "📋 コピー"; }, 2000);
    });
  });

  const retryWrongBtn = $("#retryWrongBtn");
  if (retryWrongBtn) {
    retryWrongBtn.addEventListener("click", () => {
      questions = shuffle([...wrongInSession]);
      currentIndex = 0;
      score = 0;
      answered = false;
      wrongInSession = [];
      renderQuestion();
    });
  }

  $("#retryBtn").addEventListener("click", () => startQuiz(currentCategory));
  $("#categoryBtn").addEventListener("click", showCategorySelect);
}

function getLevel(percentage) {
  if (percentage >= 90) return { level: "敬語マスター", message: "素晴らしい！即戦力レベルです！", emoji: "🏆" };
  if (percentage >= 70) return { level: "敬語上級者", message: "あと少しで完璧！実践で磨きましょう。", emoji: "🌟" };
  if (percentage >= 50) return { level: "敬語中級者", message: "基本はOK！苦手分野を復習しよう。", emoji: "📖" };
  if (percentage >= 30) return { level: "敬語初級者", message: "まだまだ伸びしろあり！繰り返し練習しよう。", emoji: "🌱" };
  return { level: "敬語ビギナー", message: "大丈夫！ここから一緒に学んでいこう！", emoji: "💪" };
}

// ========== Utils ==========
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ========== Service Worker ==========
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(function(e) {
    console.warn("SW registration failed:", e);
  });
}

// ========== Start ==========
document.addEventListener("DOMContentLoaded", init);
