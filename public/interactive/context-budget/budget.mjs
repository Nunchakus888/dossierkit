// Pure calculator. Exact decimal ratios keep Python/JS floor/ceil identical.
function fraction(value) {
  const [mantissa, exponent = "0"] = String(value).toLowerCase().split("e");
  const [whole, decimals = ""] = mantissa.split(".");
  let n = BigInt(whole + decimals),
    power = decimals.length - Number(exponent);
  return power >= 0
    ? [n, 10n ** BigInt(power)]
    : [n * 10n ** BigInt(-power), 1n];
}
function mul(value, ratio, ceil = false) {
  const [n, d] = fraction(ratio),
    x = BigInt(value) * n;
  return Number((x + (ceil ? d - 1n : 0n)) / d);
}
function available(profile, generation, policy) {
  const [n, d] = fraction(policy.input_safety_margin_ratio);
  return Number(
    (BigInt(
      Math.max(
        0,
        profile.input_limit - (profile.shared_window ? generation : 0),
      ),
    ) *
      (d - n)) /
      d,
  );
}
export function validatePolicy(policy, defaults) {
  for (const [key, value] of Object.entries(policy)) {
    if (!Object.hasOwn(defaults, key)) throw Error(`未知策略字段：${key}`);
    if (typeof value !== "number" || !Number.isFinite(value))
      throw Error(`${key} 必须是有限数值`);
    if (key === "input_safety_margin_ratio") {
      if (value < 0 || value >= 1) throw Error(`${key} 需在 [0,1) 内`);
    } else if (value <= 0) throw Error(`${key} 必须为正数`);
    if (
      !key.endsWith("_ratio") &&
      !key.endsWith("_multiplier") &&
      !key.endsWith("_seconds") &&
      !Number.isSafeInteger(value)
    )
      throw Error(`${key} 必须为正整数`);
  }
  if (policy.query_timeout_seconds > policy.read_timeout_seconds)
    throw Error("单查询时限不得超过总读取时限");
  if (!(
    policy.model_timeout_seconds <= policy.execution_timeout_seconds &&
    policy.execution_timeout_seconds < policy.lease_seconds
  ))
    throw Error("需要：模型时限 ≤ 执行时限 < 租约");
}
export function allocate(input, defaults) {
  if (
    input.policy !== undefined &&
    (input.policy === null ||
      typeof input.policy !== "object" ||
      Array.isArray(input.policy))
  )
    throw Error("policy 必须是对象");
  if (
    typeof input.main?.shared_window !== "boolean" ||
    typeof input.summary?.shared_window !== "boolean"
  )
    throw Error("共享窗口标记必须为布尔值");
  const p = { ...defaults, ...input.policy };
  validatePolicy(p, defaults);
  for (const v of [
    input.trigger_tokens,
    input.summary_max_tokens,
    input.reply_generation,
    input.main.input_limit,
    input.main.output_limit,
    input.summary.input_limit,
    input.summary.output_limit,
  ]) {
    if (!Number.isSafeInteger(v) || v <= 0)
      throw Error("模型容量与token额度必须是正整数");
  }
  if (input.reply_generation > input.main.output_limit)
    throw Error("回复生成额度超过主模型输出上限");
  const model_input = available(input.main, input.reply_generation, p);
  const summary_tokens = Math.min(
    input.summary_max_tokens,
    input.summary.output_limit,
  );
  return {
    model_input,
    input_tokens: model_input,
    trigger_tokens: input.trigger_tokens,
    summary_tokens,
    chunk_tokens: available(input.summary, summary_tokens, p),
    generation_tokens: summary_tokens,
    summary_ceiling: summary_tokens,
  };
}
export function predictVolume(tokens, ratio) {
  if (ratio == null || ratio === "") return null;
  if (typeof ratio !== "number" || !Number.isFinite(ratio) || ratio <= 0)
    throw Error("bytes/token 必须是有限正数");
  return mul(tokens, ratio);
}
export function analyzeWorkload(allocation, workload, policy) {
  const r = allocation,
    w = workload;
  const loader_summary =
    w.summary_actual <= r.input_tokens ? w.summary_actual : 0;
  const prefetch_tokens = Math.max(0, r.input_tokens - loader_summary);
  const adopted_summary =
    w.mandatory + w.summary_actual <= r.input_tokens ? w.summary_actual : 0;
  const adopted_previous = w.previous;
  const raw_tokens = Math.min(
    prefetch_tokens,
    Math.max(0, r.input_tokens - w.mandatory - adopted_summary),
  );
  const new_prefix_tokens =
    w.previous > r.summary_tokens
      ? 0
      : Math.max(
          0,
          Math.min(64000, r.chunk_tokens - adopted_previous - w.overhead),
        );
  const local_input_tokens = w.mandatory + adopted_summary + w.tail_tokens;
  const soft_input_tokens =
    w.usage_prompt_tokens == null
      ? local_input_tokens
      : w.usage_prompt_tokens + w.replay_new_tokens;
  const byte_bound = w.input_byte_bound ?? null;
  const projection_needed =
    local_input_tokens > r.input_tokens ||
    (byte_bound !== null && byte_bound > r.model_input);
  const guard_state = projection_needed
    ? "projection_needed"
    : byte_bound === null
      ? "bytes_unverified"
      : "within";
  const trigger_reason =
    w.previous > r.summary_tokens
      ? "summary_resize"
      : w.recoverable_gap ||
          projection_needed ||
          (w.summary_actual > 0 && !adopted_summary)
        ? "history_gap"
        : soft_input_tokens >= r.trigger_tokens
          ? "soft_threshold"
          : null;
  const summary_input_tokens =
    w.overhead + adopted_previous + new_prefix_tokens;
  const native_visible_tokens =
    w.thinking_fraction == null
      ? null
      : mul(r.generation_tokens, 1 - w.thinking_fraction);
  const native_body_bytes =
    native_visible_tokens == null
      ? null
      : predictVolume(native_visible_tokens, w.body_bytes_per_native_token);
  const visible_cap_bytes = predictVolume(r.summary_tokens, w.body_ratio);
  return {
    loader_summary,
    adopted_summary,
    adopted_previous,
    prefetch_tokens,
    raw_tokens,
    new_prefix_tokens,
    local_input_tokens,
    soft_input_tokens,
    guard_state,
    projection_needed,
    trigger_reason,
    triggered: trigger_reason !== null,
    summary_input_tokens,
    summary_total_tokens: summary_input_tokens + r.generation_tokens,
    native_visible_tokens,
    native_body_bytes,
    visible_cap_bytes,
    generation_seconds:
      w.output_tokens_per_second == null ||
      w.first_token_latency_seconds == null
        ? null
        : w.first_token_latency_seconds +
          r.generation_tokens / w.output_tokens_per_second,
    total_concurrency: w.instances * policy.compaction_concurrency,
  };
}
export function initialDialogLimit(value) {
  if (
    value == null ||
    (typeof value === "string" && value.trim().toLowerCase() === "auto")
  )
    return null;
  if (!Number.isSafeInteger(value) || value <= 0)
    throw Error("首次 Dialog 上限必须为 auto 或正整数");
  return value;
}
export function exportApollo(input, defaults) {
  const policy = Object.fromEntries(
    Object.entries({ ...defaults, ...input.policy }).filter(
      ([k, v]) => v !== defaults[k],
    ),
  );
  return {
    COMPACTION_TRIGGER_TOKENS: String(input.trigger_tokens),
    COMPACTION_SUMMARY_MAX_TOKENS: String(input.summary_max_tokens),
    ...(input.reply_generation !== 8192
      ? { GEMINI_MAX_COMPLETION_TOKENS: String(input.reply_generation) }
      : {}),
    ...(Object.keys(policy).length
      ? { HISTORY_BUDGET_POLICY: JSON.stringify(policy) }
      : {}),
    ...(initialDialogLimit(input.initial_dialog_limit) != null
      ? {
          HISTORY_INITIAL_DIALOG_LIMIT: String(
            initialDialogLimit(input.initial_dialog_limit),
          ),
        }
      : {}),
    ...Object.fromEntries(
      Object.entries({
        max_dialogs: "HISTORY_PREPARE_MAX_DIALOGS",
        max_messages: "HISTORY_PREPARE_MAX_MESSAGES",
        dialog_page_size: "HISTORY_DIALOG_PAGE_SIZE",
      })
        .filter(
          ([key]) =>
            input[key] != null &&
            input[key] !==
              { max_dialogs: 200, max_messages: 2000, dialog_page_size: 50 }[
                key
              ],
        )
        .map(([key, env]) => [env, String(input[key])]),
    ),
  };
}
