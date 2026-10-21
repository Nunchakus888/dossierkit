import {
  allocate,
  predictVolume,
  analyzeWorkload,
  exportApollo,
  initialDialogLimit,
} from "./budget.mjs";
import { renderFlow, triggerLabels } from "./flow.mjs";
const $ = (id) => document.getElementById(id),
  fmt = (n) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
const defs = await fetch("./policy-defaults.json").then((r) => {
  if (!r.ok) throw Error("无法加载策略默认值");
  return r.json();
});
const profile = {
  input_limit: 1048576,
  output_limit: 65536,
  shared_window: true,
};
const initial = {
  input: {
    trigger_tokens: 32000,
    initial_dialog_limit: null,
    max_dialogs: 200,
    max_messages: 2000,
    dialog_page_size: 50,
    reply_generation: 8192,
    summary_max_tokens: 8192,
    main: { ...profile },
    summary: { ...profile },
    policy: {},
  },
  workload: {
    mandatory: 20000,
    summary_actual: 8192,
    previous: 8192,
    overhead: 2000,
    bson_ratio: null,
    body_ratio: null,
    message_tokens: null,
    dialog_tokens: null,
    codepoint_ratio: null,
    tail_tokens: 0,
    input_byte_bound: null,
    recoverable_gap: false,
    usage_prompt_tokens: null,
    replay_new_tokens: 0,
    instances: 1,
    body_bytes_per_native_token: null,
    thinking_fraction: null,
    output_tokens_per_second: null,
    first_token_latency_seconds: null,
  },
};
let scenario = structuredClone(initial),
  baseline = null,
  result;
const labels = {
  reply_generation: "主回复总生成额度",
  summary_max_tokens: "摘要正文绝对上限",
  input_safety_margin_ratio: "安全余量（比例）",
  message_page_size: "消息分页条数",
  bson_batch_size: "原始 BSON 批量",
  read_max_bytes: "累计接纳 BSON 字节",
  read_timeout_seconds: "总读取时限（秒）",
  query_timeout_seconds: "单查询时限（秒）",
  model_timeout_seconds: "摘要模型时限（秒）",
  execution_timeout_seconds: "摘要执行时限（秒）",
  lease_seconds: "摘要租约（秒）",
  compaction_concurrency: "每进程摘要并发",
  read_history_max_calls: "每请求历史查回次数",
  read_history_max_tokens: "每次查回 token 上限",
  read_history_fragment_codepoints: "查回片段 Unicode 码点",
  read_history_dialog_page_size: "查回目录页量",
  read_history_message_page_size: "查回消息页量",
};
const workloadLabels = {
  mandatory: "必需输入 F · tokens（可调）",
  summary_actual: "当前已有摘要 tokens（场景值）",
  previous: "后台输入的旧摘要 tokens（场景值）",
  overhead: "摘要包装 tokens",
  bson_ratio: "BSON bytes / 预算 token",
  body_ratio: "正文 UTF-8 bytes / 预算 token",
  message_tokens: "平均每消息 tokens",
  dialog_tokens: "平均每 Dialog tokens",
  codepoint_ratio: "可选：Unicode 码点 / token",
  tail_tokens: "原文尾部本地估算 tokens",
  input_byte_bound: "完整输入字节上界（可选）",
  recoverable_gap: "存在可恢复历史缺口",
  usage_prompt_tokens: "有效主调用 prompt usage",
  replay_new_tokens: "usage 之后重放/新增 tokens",
  instances: "Agent 进程数假设",
  body_bytes_per_native_token: "正文 bytes / 原生输出 token",
  thinking_fraction: "总生成中思考占比假设",
  output_tokens_per_second: "总生成速度 tokens/秒",
  first_token_latency_seconds: "首 token 延迟（秒）",
};
const workloadHints = {
  mandatory:
    "系统指令 + 工具定义 + 本轮必需输入；20k 是示例，不随模型容量自动变化",
  summary_actual:
    "填写已有正文长度；新摘要上限 S 独立配置，此值不会自动填满上限",
  previous: "本次后台摘要调用要合并的已有正文长度，不是新摘要上限 S",
  input_byte_bound:
    "完整模型 payload 的 UTF-8 字节 + 媒体计量；不是 BSON 或 bytes/token 预测。留空表示待校验",
  recoverable_gap:
    "例如历史受读取额度限制而未加载；未达 token 触发线也有摘要需求",
};
const primaryWorkload = [
  ...Object.keys(initial.workload).slice(0, 9),
  "tail_tokens",
  "input_byte_bound",
  "recoverable_gap",
];
function field(
  parent,
  label,
  value,
  change,
  hint = "",
  slider = null,
  policyKey = null,
  allowAuto = false,
) {
  const row = document.createElement("div");
  row.className = "field";
  const lab = document.createElement("label"),
    id = `field-${parent}-${$(parent).children.length}`;
  lab.htmlFor = id;
  lab.textContent = label;
  if (hint) {
    const small = document.createElement("small");
    small.textContent = hint;
    if (policyKey) small.dataset.policy = policyKey;
    lab.append(small);
  }
  const input = document.createElement("input");
  const boolean = typeof value === "boolean";
  input.type = boolean ? "checkbox" : allowAuto ? "text" : "number";
  input.id = id;
  input.step = "any";
  input.min = "0";
  input.value = value ?? (allowAuto ? "auto" : "");
  if (boolean) input.checked = value;
  input.placeholder = "未校准";
  input.addEventListener(boolean ? "change" : "input", () => {
    const raw = input.value.trim();
    change(
      boolean
        ? input.checked
        : raw === "" || (allowAuto && raw.toLowerCase() === "auto")
          ? null
          : Number(raw),
    );
    if (range) range.value = input.value;
    update();
  });
  row.append(lab, input);
  let range = null;
  if (slider) {
    range = document.createElement("input");
    range.type = "range";
    range.min = slider[0];
    range.max = slider[1];
    range.step = slider[2];
    range.value = value;
    range.setAttribute("aria-label", `${label}滑杆`);
    range.addEventListener("input", () => {
      input.value = range.value;
      change(Number(range.value));
      update();
    });
    row.append(range);
  }
  $(parent).append(row);
}
function validateScenario(value) {
  const keys = (object, allowed) => {
    if (
      !object ||
      typeof object !== "object" ||
      Array.isArray(object) ||
      Object.keys(object).some((k) => !allowed.includes(k))
    )
      throw Error("场景包含未知字段或无效对象");
  };
  keys(value, ["schema", "input", "workload"]);
  keys(value.input, Object.keys(initial.input));
  for (const key of Object.keys(initial.input))
    if (!Object.hasOwn(value.input, key)) throw Error(`缺少输入字段 ${key}`);
  for (const key of ["max_dialogs", "max_messages", "dialog_page_size"])
    if (!Number.isSafeInteger(value.input[key]) || value.input[key] <= 0)
      throw Error(`${key} 必须为正整数`);
  initialDialogLimit(value.input.initial_dialog_limit);
  for (const name of ["main", "summary"])
    keys(value.input[name], Object.keys(profile));
  keys(value.workload, Object.keys(workloadLabels));
  for (const key of Object.keys(workloadLabels))
    if (!Object.hasOwn(value.workload, key))
      throw Error(`缺少工作负载字段 ${key}`);
  for (const [key, v] of Object.entries(value.workload)) {
    if (key === "recoverable_gap") {
      if (typeof v !== "boolean") throw Error("历史缺口标记必须为布尔值");
      continue;
    }
    const integral = [
      "mandatory",
      "summary_actual",
      "previous",
      "overhead",
      "tail_tokens",
      "replay_new_tokens",
      "instances",
      "usage_prompt_tokens",
      "input_byte_bound",
    ].includes(key);
    const optional = ![
      "mandatory",
      "summary_actual",
      "previous",
      "overhead",
      "tail_tokens",
      "replay_new_tokens",
      "instances",
    ].includes(key);
    if (optional && v === null) continue;
    if (
      typeof v !== "number" ||
      !Number.isFinite(v) ||
      v < 0 ||
      (integral && !Number.isSafeInteger(v)) ||
      ((key === "instances" ||
        (optional &&
          ![
            "thinking_fraction",
            "first_token_latency_seconds",
            "input_byte_bound",
          ].includes(key))) &&
        v === 0) ||
      (key === "thinking_fraction" && v > 1)
    )
      throw Error(`工作负载 ${key} 的值不合法`);
  }
  allocate(value.input, defs);
}
function forms() {
  for (const id of [
    "strategy",
    "resources",
    "profiles",
    "workloads",
    "performance",
  ])
    $(id).replaceChildren();
  $("budget").value = scenario.input.trigger_tokens;
  $("budget-slider").value = scenario.input.trigger_tokens;
  for (const key of ["reply_generation", "summary_max_tokens"])
    field(
      "strategy",
      labels[key],
      scenario.input[key],
      (v) => (scenario.input[key] = v),
    );
  const primary = ["input_safety_margin_ratio"];
  for (const [key, value] of Object.entries(defs)) {
    const effective = scenario.input.policy[key] ?? value;
    field(
      primary.includes(key) ? "strategy" : "resources",
      labels[key] ?? key,
      effective,
      (v) => (scenario.input.policy[key] = v),
      `默认 ${value}${effective !== value ? " · 已覆盖" : ""}`,
      primary.includes(key)
        ? [
            key === "input_safety_margin_ratio" ? 0 : 0.01,
            key.endsWith("_ratio") ? 1 : 8,
            0.01,
          ]
        : null,
      key,
    );
  }
  for (const [key, label] of Object.entries({
    initial_dialog_limit: "无摘要 Dialog 上限",
    max_dialogs: "目录总数上限",
    max_messages: "消息总数上限",
    dialog_page_size: "目录分页条数",
  }))
    field(
      "resources",
      label,
      scenario.input[key],
      (v) => (scenario.input[key] = v),
      key === "initial_dialog_limit"
        ? "默认 auto：按实际轮次成本停止；正整数仅作额外上限"
        : "",
      null,
      null,
      key === "initial_dialog_limit",
    );
  for (const which of ["main", "summary"]) {
    for (const k of ["input_limit", "output_limit"])
      field(
        "profiles",
        `${which === "main" ? "主模型" : "摘要模型"} ${k === "input_limit" ? "输入" : "输出"}上限`,
        scenario.input[which][k],
        (v) => (scenario.input[which][k] = v),
      );
    const row = document.createElement("label");
    row.className = "hint";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = scenario.input[which].shared_window;
    box.addEventListener("change", () => {
      scenario.input[which].shared_window = box.checked;
      update();
    });
    row.append(
      box,
      ` ${which === "main" ? "主模型" : "摘要模型"}额外预留生成额度 q（本地保守策略）`,
    );
    $("profiles").append(row);
  }
  for (const [key, label] of Object.entries(workloadLabels))
    field(
      primaryWorkload.includes(key) ? "workloads" : "performance",
      label,
      scenario.workload[key],
      (v) => (scenario.workload[key] = v),
      workloadHints[key] ?? "",
    );
}
function bar(id, values, max) {
  const colors = ["#a7b6c2", "#087d74", "#4778b3"];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 720 66");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    values
      .map((v, i) => `${["必需/包装", "摘要", "原文"][i]} ${fmt(v)} tokens`)
      .join("；"),
  );
  const ns = svg.namespaceURI;
  const base = document.createElementNS(ns, "rect");
  Object.entries({
    x: 0,
    y: 4,
    width: 720,
    height: 28,
    rx: 5,
    fill: "#edf2f4",
  }).forEach(([k, v]) => base.setAttribute(k, v));
  svg.append(base);
  let x = 0;
  values.forEach((v, i) => {
    const width =
      (Math.max(0, Math.min(v, Math.max(0, max - x))) / Math.max(1, max)) * 720;
    const rect = document.createElementNS(ns, "rect");
    Object.entries({
      x: (x / Math.max(1, max)) * 720,
      y: 4,
      width,
      height: 28,
      fill: colors[i],
    }).forEach(([k, val]) => rect.setAttribute(k, val));
    svg.append(rect);
    x += Math.min(v, Math.max(0, max - x));
  });
  const text = document.createElementNS(ns, "text");
  text.setAttribute("x", 0);
  text.setAttribute("y", 55);
  text.textContent = `${fmt(max)} tokens 总额度`;
  svg.append(text);
  $(id).replaceChildren(svg);
}
function curves() {
  const width = 720,
    height = 220,
    pad = 35;
  const cap = Math.max(
    scenario.input.summary_max_tokens,
    Math.ceil(scenario.input.summary.output_limit * 1.25),
  );
  const points = Array.from({ length: 49 }, (_, i) => {
    const configured = Math.max(1, Math.floor((cap * i) / 48));
    return {
      configured,
      ...allocate({ ...scenario.input, summary_max_tokens: configured }, defs),
    };
  });
  const ns = "http://www.w3.org/2000/svg";
  $("curve").replaceChildren();
  for (const [key, label, color] of [
    ["summary_tokens", "正文 S = 总生成 G（tokens）", "#087d74"],
    ["chunk_tokens", "摘要模型安全输入 C（tokens，独立纵轴）", "#4778b3"],
  ]) {
    const top = Math.max(1, ...points.map((point) => point[key]));
    const x = (v) => pad + ((width - pad * 2) * v) / cap;
    const y = (v) => height - pad - ((height - pad * 2) * v) / top;
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
    const title = document.createElementNS(ns, "text");
    title.setAttribute("x", pad);
    title.setAttribute("y", 15);
    title.textContent = label;
    svg.append(title);
    for (const tick of [0, 0.5, 1]) {
      const line = document.createElementNS(ns, "path");
      line.setAttribute("d", `M${pad},${y(top * tick)}H${width - pad}`);
      line.setAttribute("stroke", "#e2e9ec");
      svg.append(line);
      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", pad);
      text.setAttribute("y", y(top * tick) - 6);
      text.textContent = fmt(Math.floor(top * tick));
      svg.append(text);
    }
    const path = document.createElementNS(ns, "path");
    path.setAttribute(
      "d",
      points
        .map(
          (point, j) =>
            `${j ? "L" : "M"}${x(point.configured)},${y(point[key])}`,
        )
        .join(" "),
    );
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", 2);
    path.setAttribute("fill", "none");
    svg.append(path);
    const marker = document.createElementNS(ns, "path");
    marker.setAttribute(
      "d",
      `M${x(scenario.input.summary_max_tokens)},${pad}V${height - pad}`,
    );
    marker.setAttribute("stroke", "#172c3c");
    marker.setAttribute("stroke-dasharray", "4 4");
    svg.append(marker);
    const text = document.createElementNS(ns, "text");
    text.setAttribute("x", width - pad);
    text.setAttribute("y", height - 7);
    text.setAttribute("text-anchor", "end");
    text.textContent = `配置摘要上限（tokens）0 → ${fmt(cap)}`;
    svg.append(text);
    $("curve").append(svg);
  }
}
function update() {
  $("config-output").value = "";
  $("export-state").textContent = "";
  try {
    validateScenario(scenario);
    result = allocate(scenario.input, defs);
    const r = result,
      w = scenario.workload,
      p = { ...defs, ...scenario.input.policy };
    const analysis = analyzeWorkload(r, w, p),
      {
        adopted_summary: adoptedSummary,
        adopted_previous: adoptedPrevious,
        raw_tokens: raw,
        new_prefix_tokens: extra,
      } = analysis;
    renderFlow($("flow-view"), {
      input: scenario.input,
      workload: w,
      policy: p,
      allocation: r,
      analysis,
    });
    for (const note of document.querySelectorAll("[data-policy]")) {
      const key = note.dataset.policy;
      note.textContent = `默认 ${defs[key]} · 有效 ${p[key]}${defs[key] !== p[key] ? " · 已覆盖" : ""}`;
      note.classList.toggle("override", defs[key] !== p[key]);
    }
    $("budget-slider").max = Math.max(1, r.model_input, r.trigger_tokens);
    $("budget-slider").value = r.trigger_tokens;
    $("error").hidden = true;
    $("export").disabled = false;
    $("save").disabled = false;
    $("compare").disabled = false;
    document.querySelector(".results").style.opacity = "1";
    $("metrics").replaceChildren(
      ...[
        ["主模型安全输入 M", r.input_tokens, "自动按模型能力计算"],
        [
          "Compact 触发线",
          r.trigger_tokens,
          "独立 token 阈值，与模型容量无比例关系",
        ],
        [
          "摘要正文 S",
          r.summary_tokens,
          `正文 cap ${fmt(scenario.input.summary_max_tokens)}`,
        ],
        ["摘要模型安全输入 C", r.chunk_tokens, "模型容量，不是单次实际消耗"],
        [
          "本块工作输入上界",
          analysis.summary_input_tokens,
          "指令 + 旧摘要 + 可新增原文；预算口径",
        ],
        [
          "输入估算 + 生成额度",
          analysis.summary_total_tokens,
          "调用规模示意；混合口径，不是账单上限",
        ],
        ["摘要总生成 G", r.generation_tokens, "包含正文与思考"],
        ["原文可用空间", raw, "扣实际摘要与必需输入"],
        [
          "原文预取理论上界",
          analysis.prefetch_tokens,
          "不扣必需输入；运行还扣固定摘要包装",
        ],
      ].map(([label, v, hint]) => {
        const el = document.createElement("div");
        el.className = "metric";
        const small = document.createElement("small"),
          strong = document.createElement("strong"),
          span = document.createElement("span");
        small.textContent = label;
        strong.textContent = fmt(v);
        span.textContent = hint;
        el.append(small, strong, span);
        return el;
      }),
    );
    bar("input-bar", [w.mandatory, adoptedSummary, raw], r.input_tokens);
    bar(
      "summary-bar",
      [w.overhead, adoptedPrevious, extra],
      Math.max(1, analysis.summary_input_tokens),
    );
    $("input-state").textContent =
      w.mandatory > r.input_tokens
        ? "必需输入超预算"
        : w.summary_actual > 0 && adoptedSummary === 0
          ? "摘要与必需输入无法同时容纳"
          : "额度可分配";
    $("input-note").textContent =
      `必需输入 ${fmt(w.mandatory)}，采用摘要 ${fmt(adoptedSummary)}（场景提供 ${fmt(w.summary_actual)}），原文余量 ${fmt(raw)}。`;
    $("summary-note").textContent =
      `本块工作输入上界 ${fmt(analysis.summary_input_tokens)}，其中可新增 ${fmt(extra)} tokens；模型容量 C=${fmt(r.chunk_tokens)}。${w.previous > r.summary_tokens ? "旧摘要会先压缩到新上限，成功后替换，覆盖点不变。" : ""}完整轮次、工具组和时限会进一步缩小实际进度，账单以 provider usage 为准。`;
    const predicted = (n) => (n == null ? "未校准" : fmt(n));
    const performance = [
      [
        "软触发估计",
        `${fmt(analysis.soft_input_tokens)} / ${fmt(r.trigger_tokens)} · ${triggerLabels[analysis.trigger_reason] ?? "未触发"}`,
      ],
      [
        "软判断来源",
        w.usage_prompt_tokens == null
          ? "本地输入场景"
          : "有效 usage + 新增/重放",
      ],
      [
        "独立硬保护估计",
        `${fmt(analysis.local_input_tokens)} / ${fmt(r.input_tokens)} tokens · ${analysis.guard_state === "projection_needed" ? "需投影／必需部分超限则拒绝" : analysis.guard_state === "bytes_unverified" ? "待字节校验" : "场景值均在预算内"}`,
      ],
      [
        "保守字节上界 / 允许上界",
        `${w.input_byte_bound == null ? "未填写" : fmt(w.input_byte_bound)} / ${fmt(r.model_input)} bytes`,
      ],
      [
        "总生成耗时假设",
        analysis.generation_seconds == null
          ? "未校准"
          : `${fmt(analysis.generation_seconds)} 秒${analysis.generation_seconds > p.model_timeout_seconds ? " · 超模型时限" : ""}`,
      ],
      [
        "总生成对应可见正文",
        `${predicted(analysis.native_visible_tokens)} 原生 tokens`,
      ],
      [
        "可见正文预测 / 本地上限",
        `${predicted(analysis.native_body_bytes)} / ${predicted(analysis.visible_cap_bytes)} bytes`,
      ],
      [
        "部署并发估计",
        `${fmt(w.instances)} × ${p.compaction_concurrency} = ${fmt(analysis.total_concurrency)}`,
      ],
    ];
    $("performance-output").replaceChildren(
      ...performance.map(([label, value]) => {
        const el = document.createElement("div"),
          small = document.createElement("small"),
          strong = document.createElement("strong");
        small.textContent = label;
        strong.textContent = value;
        el.append(small, strong);
        return el;
      }),
    );
    $("limits").textContent =
      `正文与总生成上限同为 ${fmt(r.summary_tokens)}；摘要输入受模型安全容量 ${fmt(r.chunk_tokens)} 限制，新增原文最多 64k，与正文上限没有倍数关系。`;
    curves();
    const bytes = (n) =>
      n === null ? "未校准" : `${fmt(n)} B · ${fmt(n / 1024)} KiB`;
    const volumes = [
      ["主原文 BSON 体量", bytes(predictVolume(raw, w.bson_ratio))],
      [
        "摘要正文 UTF-8 体量",
        bytes(predictVolume(r.summary_tokens, w.body_ratio)),
      ],
      [
        "消息 / Dialog 体量等价",
        `${w.message_tokens ? fmt(raw / w.message_tokens) : "未校准"} / ${w.dialog_tokens ? fmt(raw / w.dialog_tokens) : "未校准"}`,
      ],
      ["BSON 接纳硬上限", bytes(p.read_max_bytes)],
      [
        "可选 Unicode 字符（码点）",
        w.codepoint_ratio ? fmt(Math.floor(raw * w.codepoint_ratio)) : "未校准",
      ],
    ];
    $("volume").replaceChildren(
      ...volumes.map(([label, value]) => {
        const el = document.createElement("div"),
          small = document.createElement("small"),
          strong = document.createElement("strong");
        small.textContent = label;
        strong.textContent = value;
        el.append(small, strong);
        return el;
      }),
    );
    if (baseline) {
      const old = allocate(baseline.input, defs),
        table = document.createElement("table");
      table.innerHTML =
        "<thead><tr><th>派生值</th><th>对照</th><th>当前</th><th>变化</th></tr></thead>";
      const body = table.createTBody();
      for (const [key, label] of [
        ["input_tokens", "主安全输入 M"],
        ["trigger_tokens", "独立触发阈值 K"],
        ["summary_tokens", "摘要正文 S"],
        ["chunk_tokens", "摘要输入容量 C"],
        ["generation_tokens", "总生成 G"],
      ]) {
        const row = body.insertRow();
        for (const val of [
          `${label}（tokens）`,
          fmt(old[key]),
          fmt(r[key]),
          fmt(r[key] - old[key]),
        ])
          row.insertCell().textContent = val;
      }
      $("comparison").replaceChildren(table);
    }
  } catch (error) {
    result = null;
    $("error").textContent = error.message;
    $("error").hidden = false;
    $("export").disabled = true;
    $("save").disabled = true;
    $("compare").disabled = true;
    document.querySelector(".results").style.opacity = ".4";
  }
}
$("budget").addEventListener("input", (e) => {
  scenario.input.trigger_tokens = Number(e.target.value);
  $("budget-slider").value = e.target.value;
  update();
});
$("budget-slider").addEventListener("input", (e) => {
  scenario.input.trigger_tokens = Number(e.target.value);
  $("budget").value = e.target.value;
  update();
});
for (const value of [16000, 32000, 64000, 128000, 256000]) {
  const button = document.createElement("button");
  button.textContent =
    value > 1
      ? `${value / 1000}k`
      : value === 1
        ? "安全容量"
        : `容量 1/${1 / value}`;
  button.addEventListener("click", () => {
    if (value <= 1 && !result) return;
    scenario.input.trigger_tokens =
      value > 1 ? value : Math.max(1, Math.floor(result.model_input * value));
    forms();
    update();
  });
  $("presets").append(button);
}
$("compare").addEventListener("click", () => {
  baseline = structuredClone(scenario);
  update();
  $("comparison").closest("details").open = true;
});
$("reset").addEventListener("click", () => {
  scenario = structuredClone(initial);
  baseline = null;
  $("comparison").textContent =
    "点击“保存为对照”，比较独立触发阈值和派生额度（tokens）。";
  forms();
  update();
});
$("export").addEventListener("click", () => {
  if (result) {
    $("config-output").value = JSON.stringify(
      exportApollo(scenario.input, defs, result),
      null,
      2,
    );
    $("export-state").textContent = "已生成本场景配置；尚未发布到任何环境。";
  }
});
$("save").addEventListener("click", () => {
  const url = URL.createObjectURL(
      new Blob([JSON.stringify({ schema: 2, ...scenario }, null, 2)], {
        type: "application/json",
      }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "context-budget-scenario.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$("import-open").addEventListener("click", () => $("import").click());
$("import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 65536) throw Error("场景文件不能超过64KiB");
    const value = JSON.parse(await file.text());
    if (value.schema !== 2 || !value.input || !value.workload)
      throw Error("无效的场景文件");
    value.workload = {
      input_byte_bound: null,
      recoverable_gap: false,
      ...value.workload,
    };
    validateScenario(value);
    scenario = { input: value.input, workload: value.workload };
    forms();
    update();
  } catch (error) {
    $("error").textContent = `导入失败，保留当前场景：${error.message}`;
    $("error").hidden = false;
  }
  e.target.value = "";
});
forms();
update();
