// View geometry and labels only. Runtime-equivalent budgets stay in budget.mjs.
import { initialDialogLimit, predictVolume } from "./budget.mjs";
const format = (n) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
export const triggerLabels = {
  summary_resize: "摘要缩容需求",
  history_gap: "历史缺口／需投影",
  soft_threshold: "达到软触发线",
};
const NS = "http://www.w3.org/2000/svg";
function node(tag, className, text, children = []) {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  element.append(...children);
  return element;
}
function svgNode(tag, attributes = {}, text = "") {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes))
    element.setAttribute(key, value);
  if (text) element.textContent = text;
  return element;
}
function size(bytes) {
  if (bytes >= 1048576) return `${format(bytes / 1048576)} MiB`;
  if (bytes >= 1024) return `${format(bytes / 1024)} KiB`;
  return `${format(bytes)} B`;
}

// A_i = h_i(w_i + w_(i+1))/2 = scale * value_i; zero remains zero.
export function funnelGeometry(values, width = 320, height = 280) {
  if (
    !values.length ||
    values.some(
      (v, j) => !Number.isFinite(v) || v < 0 || (j && v > values[j - 1]),
    ) ||
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0
  )
    throw Error(
      "Funnel requires descending nonnegative values and positive dimensions",
    );
  const maximum = values[0];
  const widths = [
    ...values.map((v) => (maximum ? width * Math.sqrt(v / maximum) : 0)),
    0,
  ];
  const heights = values.map((value, j) =>
    value ? value / ((widths[j] + widths[j + 1]) / 2) : 0,
  );
  const scale = height / (heights.reduce((sum, h) => sum + h, 0) || 1);
  let y = 0;
  return values.map((value, j) => {
    const top = widths[j],
      bottom = widths[j + 1],
      h = heights[j] * scale;
    const points = [
      [-top / 2, y],
      [top / 2, y],
      [bottom / 2, y + h],
      [-bottom / 2, y + h],
    ];
    const center =
      y + (top + bottom ? (h * (top + 2 * bottom)) / (3 * (top + bottom)) : 0);
    const rightEdge = h ? (top + ((bottom - top) * (center - y)) / h) / 2 : 0;
    y += h;
    return {
      value,
      points,
      center,
      height: h,
      width: (top + bottom) / 2,
      rightEdge,
      area: (h * (top + bottom)) / 2,
    };
  });
}

function funnel(stages, summary, mobile = false) {
  const center = mobile ? 80 : 185,
    labelX = mobile ? 174 : 405;
  const width = mobile ? 140 : 320,
    height = 250;
  const svg = svgNode("svg", {
    viewBox: mobile ? "0 0 360 430" : "0 0 760 430",
    class: mobile ? "funnel-mobile" : "funnel-desktop",
    role: "img",
  });
  const shapes = funnelGeometry(
    stages.map((stage) => stage.value),
    width,
    height,
  );
  svg.append(
    svgNode(
      "title",
      {},
      `原文额度漏斗：${stages.map((s) => `${s.owner} ${format(s.value)} tokens`).join(" → ")}。摘要分支：Loader 预留 ${format(summary.reserved)}，Engine 采用 ${format(summary.adopted)} tokens。漏斗层面积与 token 值成正比，分支节点不按面积计量。`,
    ),
  );
  shapes.forEach((shape, j) => {
    const stage = stages[j],
      points = shape.points.map(([x, y]) => `${x + center},${y + 8}`).join(" ");
    const polygon = svgNode("polygon", {
      points,
      class: `funnel-layer layer-${j}`,
      "data-tokens": shape.value,
      "data-area": shape.area,
    });
    polygon.append(
      svgNode(
        "title",
        {},
        `${stage.name}：${format(shape.value)} tokens；首层的 ${format((shape.value / Math.max(1, stages[0].value)) * 100)}%`,
      ),
    );
    svg.append(polygon);
    if (shape.height > 30 && shape.width > 40)
      svg.append(
        svgNode(
          "text",
          {
            x: center,
            y: shape.center + 15,
            class: "funnel-number",
            "text-anchor": "middle",
          },
          format(shape.value),
        ),
      );
    if (!shape.value)
      svg.append(
        svgNode("path", {
          d: `M${center - 8},${shape.center + 2}l16,12m0,-12l-16,12`,
          class: "funnel-zero",
        }),
      );
    const labelY = 18 + j * 90;
    svg.append(
      svgNode("path", {
        d: `M${center + shape.rightEdge + 6},${shape.center + 8}H${labelX - 16}V${labelY + 13}H${labelX - 6}`,
        class: "funnel-leader",
      }),
    );
    svg.append(
      svgNode(
        "text",
        { x: labelX, y: labelY, class: "funnel-owner" },
        `${stage.owner} · ${stage.name}`,
      ),
    );
    svg.append(
      svgNode(
        "text",
        {
          x: labelX,
          y: labelY + 25,
          class: `funnel-value ${!shape.value ? "zero" : ""}`,
        },
        `${format(stage.value)} tokens`,
      ),
    );
    svg.append(
      svgNode(
        "text",
        { x: labelX, y: labelY + 46, class: "funnel-function" },
        mobile ? (stage.mobileFn ?? stage.fn) : stage.fn,
      ),
    );
    svg.append(
      svgNode(
        "text",
        { x: labelX, y: labelY + 64, class: "funnel-calculation" },
        mobile
          ? (stage.mobileCalculation ?? stage.calculation)
          : stage.calculation,
      ),
    );
  });
  const sourceX = mobile ? 0 : 25,
    sourceWidth = mobile ? 150 : 300,
    mergeX = mobile ? 200 : 405,
    mergeWidth = mobile ? 160 : 330,
    mergeCenter = mergeX + mergeWidth / 2;
  svg.append(
    svgNode("path", {
      d: `M${center},258V285H${mergeCenter}V304`,
      class: "funnel-leader",
    }),
    svgNode("polygon", {
      points: `${mergeCenter - 4},303 ${mergeCenter},310 ${mergeCenter + 4},303`,
      class: "funnel-merge-arrow",
    }),
    svgNode("path", {
      d: `M${sourceX + sourceWidth},365H${mergeX - 6}`,
      class: "funnel-summary-link",
    }),
    svgNode("polygon", {
      points: `${mergeX - 7},361 ${mergeX},365 ${mergeX - 7},369`,
      class: "funnel-summary-arrow",
    }),
  );
  for (const card of [
    {
      x: sourceX,
      width: sourceWidth,
      kind: "summary",
      title: "摘要分支 A · 已计入 M",
      value: summary.adopted,
      hint: `Loader 预留 ${format(summary.reserved)}`,
      note: summary.adopted > 0 ? "Engine 本轮采用" : "Engine 本轮未采用摘要",
    },
    {
      x: mergeX,
      width: mergeWidth,
      kind: "merge",
      title: "Engine 组装额度上界",
      value: summary.assembled,
      hint: "必需 F + 摘要 A + 原文 R",
      note: "实际发送仍按完整输入校验",
    },
  ]) {
    const group = svgNode("g", { class: `funnel-branch ${card.kind}` });
    group.append(
      svgNode("rect", {
        x: card.x,
        y: 310,
        width: card.width,
        height: 110,
        rx: 8,
      }),
    );
    for (const [offset, text, className] of [
      [21, card.title, "funnel-branch-title"],
      [49, `${format(card.value)} tokens`, "funnel-branch-value"],
      [73, card.hint, "funnel-branch-note"],
      [94, card.note, "funnel-branch-note"],
    ])
      group.append(
        svgNode(
          "text",
          {
            x: card.x + 10,
            y: 310 + offset,
            class: className,
          },
          text,
        ),
      );
    svg.append(group);
  }
  return svg;
}
function volume(tokens, w) {
  const values = [];
  if (w.bson_ratio)
    values.push(`≈ ${size(predictVolume(tokens, w.bson_ratio))} BSON`);
  if (w.message_tokens)
    values.push(`≈ ${format(tokens / w.message_tokens)} 消息`);
  if (w.dialog_tokens)
    values.push(`≈ ${format(tokens / w.dialog_tokens)} Dialog`);
  return values.join(" · ");
}
function stack(parts, total, className = "") {
  const el = node("div", `model-stack ${className}`);
  for (const [label, value, color] of parts) {
    if (!value) continue;
    const segment = node("span", color, "");
    segment.style.flexBasis = `${Math.min((value / Math.max(1, total)) * 100, 100)}%`;
    segment.title = `${label}：${format(value)} tokens`;
    if (value / total >= 0.11)
      segment.textContent = `${label} ${format(value)}`;
    el.append(segment);
  }
  return el;
}
function legend(parts) {
  return node(
    "div",
    "model-legend",
    "",
    parts.map(([name, value, color]) =>
      node("span", color, `${name} ${format(value)}`),
    ),
  );
}
function stat(label, value, hint, className = "") {
  return node("div", `model-stat ${className}`, "", [
    node("span", "", label),
    node("strong", "", value),
    node("small", "", hint),
  ]);
}
function safetyExplanation(i, w, p, r) {
  const reserve = i.main.shared_window ? i.reply_generation : 0;
  return node("div", "safety-explanation", "", [
    node("strong", "", "安全容量怎么算？"),
    node(
      "code",
      "",
      `M = ⌊(1 − m) × max(0, I − q × o)⌋ = ⌊(1 − ${p.input_safety_margin_ratio}) × max(0, ${format(i.main.input_limit)} − ${i.main.shared_window ? 1 : 0} × ${format(i.reply_generation)})⌋ = ${format(r.model_input)}`,
    ),
    node(
      "p",
      "model-note",
      "⌊x⌋ 是标准数学符号，表示向下取整 floor(x)，例如 ⌊3.8⌋=3。这里把安全容量取为整数 token，不做四舍五入。",
    ),
    node(
      "p",
      "model-note",
      `I 是模型输入上限；o 是本次主回复生成预留；q=1 时先预留 ${format(reserve)}，q=0 时不预留；m=${format(p.input_safety_margin_ratio * 100)}% 是再扣的本地安全余量。这两层保护不是 Gemini 官方额外要求。`,
    ),
    node("p", "mandatory-explanation", "", [
      node("strong", "", `F=${format(w.mandatory)} 是可调场景值。`),
      node(
        "span",
        "",
        " F=系统指令+工具定义+本轮必需输入的成本。示例 20k 用于比较不同输入规模；真实 F 每轮变化，无法仅由 M 推出。",
      ),
      node("a", "", "到左侧“工作负载”调整 F"),
    ]),
  ]);
}

function summaryBudget(i, w, p, r, a) {
  return node("section", "summary-budget", "", [
    node("strong", "", "摘要正文与触发阈值独立配置"),
    node("div", "summary-budget-path", "", [
      stat(
        "触发阈值",
        `${format(r.trigger_tokens)} tokens`,
        "缺口/缩容也可触发",
      ),
      stat(
        "正文 S = 总生成 G",
        `${format(r.summary_tokens)} tokens`,
        "生成含思考；实际正文可能更短",
        "summary",
      ),
    ]),
    node(
      "p",
      "summary-actual-note",
      `已有摘要 ${format(w.summary_actual)}，本次采用 ${format(a.adopted_summary)}。缩小 S 保留旧摘要作为压缩材料；成功后替换，覆盖点不变。调大不自动扩写。`,
    ),
  ]);
}
function formulaReference(i, w, p, r, a) {
  const rows = [
    ["主模型输入 M", "floor((1−m) × max(0,I−q×o))", r.input_tokens],
    ["原文预取", "max(0,M−已采用摘要−包装)", a.prefetch_tokens],
    [
      "主调用原文余量",
      "min(已预取,max(0,M−必需输入−已采用摘要−包装))",
      a.raw_tokens,
    ],
    [
      "新摘要 S / 总生成 G",
      "min(配置摘要上限,摘要模型输出上限)",
      r.summary_tokens,
    ],
    ["摘要输入容量 C", "Safe(摘要模型,S)", r.chunk_tokens],
    ["新增原文", "max(0,min(64000,C−旧摘要−指令))", a.new_prefix_tokens],
    [
      "软触发",
      "usage＋新增估算 ≥ 独立触发线；缺口或缩容也可触发",
      r.trigger_tokens,
    ],
  ];
  return node("details", "formula-reference", "", [
    node("summary", "", "全部数学函数与参数释义"),
    node(
      "div",
      "function-table",
      "",
      rows.map(([name, fn, value]) =>
        node("div", "function-row", "", [
          node("span", "", name),
          node("code", "", fn),
          node("strong", "", format(value)),
        ]),
      ),
    ),
    node(
      "p",
      "model-note",
      "I/o/q/m：模型输入能力、主回复生成预留、共享窗口标记、安全余量。F：本轮必需输入；A：实际摘要。模型容量来自代码登记；场景修改不改变运行配置。包装成本运行时计入；体量预测直接 token × bytes/token，平均消息/Dialog 不决定覆盖边界。",
    ),
  ]);
}

export function renderFlow(
  container,
  { input: i, workload: w, policy: p, allocation: r, analysis: a },
) {
  const rejected = w.mandatory > r.input_tokens,
    projected = a.projection_needed;
  const stages = [
    {
      name: "主输入 M",
      owner: "API",
      value: r.input_tokens,
      fn: "M = Safe(I,o,m,q)",
      calculation: `${format(r.model_input)}（自动）`,
    },
    {
      name: "原文预取 L⁺",
      owner: "Loader",
      value: a.prefetch_tokens,
      fn: "L⁺ = Prefetch(M,Aₗ,0)",
      calculation: `${format(r.input_tokens)} − 摘要 ${format(a.loader_summary)} = ${format(a.prefetch_tokens)}`,
      mobileCalculation: `M − Aₗ = ${format(a.prefetch_tokens)}`,
    },
    {
      name: "原文可用 R⁺",
      owner: "Engine",
      value: a.raw_tokens,
      fn: "R⁺ = min(L⁺, Raw(M,F,A,0))",
      calculation: `min(${format(a.prefetch_tokens)}, ${format(r.input_tokens)} − ${format(w.mandatory)} − ${format(a.adopted_summary)})`,
      mobileFn: "R⁺ = min(L⁺, 剩余额度)",
      mobileCalculation: `本次上界 = ${format(a.raw_tokens)}`,
    },
  ];
  const limit = initialDialogLimit(i.initial_dialog_limit);
  const mainParts = [
    ["必需 F", w.mandatory, "mandatory"],
    ["当前摘要 A", a.adopted_summary, "summary"],
    ["原文 R", a.raw_tokens, "raw"],
  ];
  const summaryFlow = {
    reserved: a.loader_summary,
    adopted: a.adopted_summary,
    assembled: mainParts.reduce((total, [, value]) => total + value, 0),
  };
  const main = node("div", "request-model", "", [
    safetyExplanation(i, w, p, r),
    node("div", "model-constraints", "", [
      stat("安全输入 M", format(r.model_input), "自动计算，无 H 配置"),
    ]),
    summaryBudget(i, w, p, r, a),
    node("div", "funnel-figure", "", [
      funnel(stages, summaryFlow),
      funnel(stages, summaryFlow, true),
    ]),
    node("div", "model-volume", "", [
      node(
        "span",
        "",
        `预取 ${volume(a.prefetch_tokens, w) || "未填写体量系数"}`,
      ),
      node(
        "strong",
        "",
        `最终原文 ${volume(a.raw_tokens, w) || `${format(a.raw_tokens)} tokens`}`,
      ),
    ]),
    node(
      "div",
      "model-fences",
      "",
      [
        `${size(p.read_max_bytes)} BSON`,
        `${format(i.max_dialogs)} Dialog`,
        `${format(i.max_messages)} 消息`,
        `${format(p.read_timeout_seconds)} 秒`,
        limit == null ? "首次 auto" : `首次 ≤${limit} Dialog`,
      ].map((v) => node("span", "", v)),
    ),
    node("div", "assembly-heading", "", [
      node("span", "", "Engine 输入额度分配"),
      node("code", "", `F + A + R ≤ M = ${format(r.input_tokens)}`),
    ]),
    stack(mainParts, r.input_tokens),
    legend(mainParts),
  ]);
  main.append(
    node("div", "input-estimate", "", [
      node("strong", "", "本次主模型输入预估 T"),
      node(
        "p",
        "model-note",
        "T 是调用前、裁剪前的完整输入本地估算：必需输入 F（系统提示、工具定义、本轮必需输入）+ 采用摘要 A + 待选原文尾部。回复生成额度单独预留。",
      ),
      node(
        "code",
        "",
        `T = 必需输入 ${format(w.mandatory)} + 摘要 ${format(a.adopted_summary)} + 原文尾部 ${format(w.tail_tokens)} = ${format(a.local_input_tokens)} tokens`,
      ),
      node(
        "p",
        "model-note",
        "原文尾部使用左侧场景填写的估算值；R⁺ 表示能容纳原文的上限，不会自动填满 T。本页未计摘要包装 W，运行时会计入。",
      ),
    ]),
  );
  const status = rejected
    ? "拒绝：必需输入超预算"
    : projected
      ? "需投影；必需输入仍超限则拒绝"
      : a.guard_state === "bytes_unverified"
        ? "token 预算内；待字节校验"
        : "场景 token 与字节均在预算内";
  const decision = node(
    "div",
    `model-decision ${rejected ? "rejected" : projected ? "projected" : ""}`,
    "",
    [
      node("strong", "", status),
      node("span", "", `完整输入预估 T=${format(a.local_input_tokens)} tokens`),
      node("span", "", `主输入容量 M=${format(r.input_tokens)} tokens`),
      node(
        "span",
        "",
        `字节上界 ${w.input_byte_bound == null ? "未填写" : format(w.input_byte_bound)} / ${format(r.model_input)} bytes`,
      ),
      node("span", "", `回复总生成 ≤ ${format(i.reply_generation)}`),
    ],
  );
  const trigger = node("div", "trigger-gauge", "", [
    node("div", "trigger-label", "", [
      node("span", "", `摘要触发用输入估计 U=${format(a.soft_input_tokens)}`),
      node(
        "strong",
        "",
        `触发线 ${format(r.trigger_tokens)} tokens · ${triggerLabels[a.trigger_reason] ?? "未触发"}`,
      ),
    ]),
  ]);
  const gauge = node("div", "gauge-track");
  const fill = node("span", "gauge-fill");
  fill.style.width = `${Math.min(100, (a.soft_input_tokens / r.trigger_tokens) * 100)}%`;
  const marker = node("span", "gauge-marker");
  marker.style.left = "100%";
  gauge.append(fill, marker);
  trigger.append(gauge);
  main.append(decision, trigger);
  if (w.summary_actual > 0 && !a.adopted_summary)
    main.append(node("p", "model-warning", "摘要与必需输入放不下：本次不用。"));
  main.append(
    node(
      "p",
      "model-note",
      "层间不相加；⁺ 为未扣只读包装 W 的上界，Engine 不补读。字节上界需包含完整序列化输入及媒体计量；体量预测不代替实际校验。",
    ),
  );

  const bgParts = [
    ["指令", w.overhead, "mandatory"],
    ["旧摘要", a.adopted_previous, "summary"],
    ["新增", a.new_prefix_tokens, "raw"],
  ];
  const bodyVolume = w.body_ratio
    ? size(predictVolume(r.summary_tokens, w.body_ratio))
    : "本地正文预算";
  const background = node(
    "section",
    `compact-model ${rejected ? "inactive" : ""}`,
    "",
    [
      node("div", "compact-heading", "", [
        node("h3", "", "后台摘要 · 交付后独立调用"),
        node(
          "span",
          `model-pill ${rejected ? "blocked" : a.triggered ? "active" : ""}`,
          rejected
            ? "本轮不执行"
            : (triggerLabels[a.trigger_reason] ?? "无摘要需求"),
        ),
      ]),
      node("div", "compact-layout", "", [
        node("div", "compact-input", "", [
          node("div", "assembly-heading", "", [
            node("span", "", "本块工作输入上界（预算口径）"),
            node("strong", "", `${format(a.summary_input_tokens)} tokens`),
          ]),
          stack(bgParts, a.summary_input_tokens),
          legend(bgParts),
          node(
            "p",
            "model-note",
            `另受模型安全容量 C=${format(r.chunk_tokens)} 限制，不代表每次用满 C。`,
          ),
        ]),
        node("span", "model-arrow", "→"),
        stat(
          "生成额度 G",
          `${format(r.generation_tokens)} tokens`,
          "包含思考 · provider 口径",
          "generation",
        ),
        node("span", "model-arrow", "→"),
        stat(
          "新摘要正文上限 S",
          `${format(r.summary_tokens)} tokens`,
          bodyVolume,
          "summary",
        ),
      ]),
      node("div", "compact-equations", "", [
        node("code", "", `G = S = ${format(r.summary_tokens)}`),
        node(
          "code",
          "",
          w.previous > r.summary_tokens
            ? "缩容：仅重压旧摘要，新增原文 = 0"
            : `新增原文 = min(64k, C − 旧摘要 − 指令) = ${format(a.new_prefix_tokens)}`,
        ),
      ]),
      node(
        "p",
        "model-note",
        `输入估算 + 生成额度 = ${format(a.summary_input_tokens)} + ${format(r.generation_tokens)} = ${format(a.summary_total_tokens)}；混合计量口径，仅示意规模，账单以 provider usage 为准。`,
      ),
      node("div", "compact-bottom", "", [
        node(
          "span",
          "",
          `模型 ${format(p.model_timeout_seconds)}s · 执行 ${format(p.execution_timeout_seconds)}s · 并发 ${p.compaction_concurrency}/进程`,
        ),
        node("span", "", "更新摘要/覆盖点 → 下一请求复用"),
      ]),
    ],
  );
  if (
    (!r.summary_tokens || !a.new_prefix_tokens) &&
    w.previous <= r.summary_tokens
  )
    background.append(
      node("p", "model-warning", "无新增完整前缀/正文空间，不推进覆盖点。"),
    );
  if (w.previous > r.summary_tokens)
    background.append(
      node(
        "p",
        "model-warning",
        "旧摘要超过新上限：先仅重压旧摘要，成功后替换，不回读已覆盖原文。",
      ),
    );
  if (a.summary_input_tokens > r.chunk_tokens)
    background.append(
      node(
        "p",
        "model-warning",
        "旧摘要与指令已超过摘要模型输入容量，本次无法生成；保留原摘要。",
      ),
    );
  main.querySelector(".mandatory-explanation a").href = "#workloads";
  container.replaceChildren(main, background, formulaReference(i, w, p, r, a));
}
