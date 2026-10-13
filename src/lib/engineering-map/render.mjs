/** Framework-independent, escaped HTML. Shared by Astro and browser regression tests. */
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const e = escapeHtml;
const modes = { own: '自主实现', integration: '开源集成', research: '研究', plan: '规划' };
const glyphs = {
 arch:'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M6 9v9h9M9 6h9v9"/>',
 ux:'<rect x="2" y="4" width="15" height="12" rx="2"/><rect x="16" y="10" width="6" height="11" rx="1.5"/><path d="M5 20h9M9 16v4"/>',
 dist:'<rect x="8" y="2" width="8" height="5" rx="1"/><rect x="1" y="17" width="8" height="5" rx="1"/><rect x="15" y="17" width="8" height="5" rx="1"/><path d="M12 7v5M5 17v-5h14v5"/>',
 cloud:'<path d="M7 18a5 5 0 0 1-1-9.9 6 6 0 0 1 11-2A5 5 0 0 1 18 18M9 16l3-3 3 3M12 13v9"/>',
 agent:'<path d="M8 4H4v16h4M16 4h4v16h-4M9 8l6 4-6 4"/>',
 quality:'<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6zM8 12l3 3 5-6"/>'
};
const icon = id => `<svg class="domain-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphs[id] || ''}</svg>`;
const unique = items => [...new Set(items)];
export function validateMap(data) {
  if (!data || data.version !== 1 || data.locale !== 'zh') throw new Error('Unsupported engineering-map data');
  const nodes = new Map(data.nodes.map(n => [n.id,n]));
  const projects = new Set(data.projects.map(p => p.id));
  const sources = new Map(data.sources.map(s => [s.id,s]));
  if (nodes.size !== data.nodes.length || projects.size !== data.projects.length || sources.size !== data.sources.length) throw new Error('Duplicate graph ID');
  const placements = data.domains.flatMap(d => d.nodes);
  if (new Set(placements).size !== nodes.size || placements.length !== nodes.size) throw new Error('Each capability needs exactly one primary domain');
  for (const id of placements) if (!nodes.has(id)) throw new Error(`Unknown capability: ${id}`);
  for (const node of data.nodes) {
    if (!/^[a-z]+-\d{2}$/.test(node.id) || !node.problem || !node.boundary || !node.contributions.length) throw new Error(`Incomplete capability: ${node.id}`);
    for (const c of node.contributions) {
      if (!projects.has(c.project) || !modes[c.mode] || !c.text || !c.evidence.length) throw new Error(`Incomplete contribution: ${node.id}`);
      for (const id of c.evidence) if (!sources.has(id)) throw new Error(`Unknown evidence: ${id}`);
    }
  }
  for (const source of data.sources) if (source.href && !/^\/(?!\/)/.test(source.href) && !/^https:\/\//.test(source.href)) throw new Error('Unsafe source URL');
  for (const r of data.relations) if (!nodes.has(r.from) || !nodes.has(r.to) || !['depends','applies'].includes(r.type) || r.from===r.to) throw new Error('Invalid graph relation');
  if (!nodes.has(data.featured)) throw new Error('Unknown featured node');
  return data;
}

export function renderEngineeringMap(input) {
  const data=validateMap(input);
  const nodes = new Map(data.nodes.map(n=>[n.id,n]));
  const projects = new Map(data.projects.map(p=>[p.id,p]));
  const sources = new Map(data.sources.map(s=>[s.id,s]));
  const domainFor = id => data.domains.find(d=>d.nodes.includes(id));
  const projectIds = n => unique(n.contributions.map(c=>c.project));
  const badges = n => projectIds(n).map(id=>`<span class="project-code" title="${e(projects.get(id).name)}">${e(projects.get(id).code)}</span>`).join('');
  const modeBadge = mode => `<span class="mode mode-${e(mode)}">${e(modes[mode])}</span>`;
  const cards = data.domains.map(d=>`<details class="domain-card" id="domain-${e(d.id)}" data-domain="${e(d.id)}" open>
    <summary><span class="domain-mark">${icon(d.id)}</span><span class="domain-heading"><span class="eyebrow">${e(d.code)} / ${e(d.en)}</span><h2>${e(d.name)}</h2></span><span class="domain-toggle" aria-hidden="true">+</span></summary>
    <p class="domain-question">${e(d.question)}</p>
    <ul class="capability-list">${d.nodes.map(id=>{const n=nodes.get(id); return `<li><a class="node-link" id="node-${e(id)}" data-node="${e(id)}" data-projects="${projectIds(n).join(' ')}" href="#cap-${e(id)}"><span class="node-dot" aria-hidden="true"></span><span class="node-copy"><strong>${e(n.title)}</strong><small>${e(n.problem)}</small></span><span class="node-projects">${badges(n)}</span></a></li>`}).join('')}</ul>
  </details>`).join('');
  const details = data.nodes.map(n=>{
    const d=domainFor(n.id);
    const evidence=unique(n.contributions.flatMap(c=>c.evidence));
    const related=data.relations.filter(r=>r.from===n.id || r.to===n.id);
    const relatedHTML=related.map(r=>{
      const outgoing=r.from===n.id; const target=nodes.get(outgoing?r.to:r.from); const domain=domainFor(target.id);
      const type=r.type==='depends'?(outgoing?'依赖':'被依赖'):(outgoing?'应用于':'应用来自');
      return `<li><span class="relation-type">${type}</span><a href="#cap-${e(target.id)}" data-node="${e(target.id)}"><small>${e(domain.name)}</small><strong>${e(target.title)}</strong><span>${e(r.label)}</span></a></li>`;
    }).join('');
    return `<details class="capability-detail" id="cap-${e(n.id)}" data-capability="${e(n.id)}" ${n.id===data.featured?'open':''}>
      <summary class="detail-heading"><span><span class="eyebrow">${e(d.name)} <span aria-hidden="true">/</span> ${e(n.id.toUpperCase().replace('-','.'))}</span><h3 tabindex="-1">${e(n.title)}</h3></span><span class="detail-chevron" aria-hidden="true">⌄</span></summary>
      <div class="detail-grid"><div class="detail-main">
        <section class="problem-block"><h4>工程问题</h4><p>${e(n.problem)}</p><div class="tech-tags">${n.tech.map(t=>`<span>${e(t)}</span>`).join('')}</div></section>
        <section><h4>本人贡献 <span class="section-note">按项目归属</span></h4><div class="contributions">${n.contributions.map((c,i)=>`<article class="contribution" id="contribution-${e(n.id)}-${i+1}"><div class="contribution-meta"><a href="#project-${e(c.project)}" class="project-label">${e(projects.get(c.project).code)} · ${e(projects.get(c.project).name)}</a>${modeBadge(c.mode)}</div><p>${e(c.text)}</p><div class="evidence-refs"><span>证据支撑</span>${c.evidence.map(id=>`<a href="#evidence-${e(n.id)}-${e(id)}" data-evidence-target="evidence-${e(n.id)}-${e(id)}">${e(sources.get(id).label)}</a>`).join('')}</div></article>`).join('')}</div></section>
        ${n.decision?`<section class="decision-block"><h4>工程取舍 <span class="section-note">机制解读</span></h4><p>${e(n.decision)}</p></section>`:''}
        <section class="boundary-block"><h4><span class="boundary-marker" aria-hidden="true"></span>验证边界</h4><p>${e(n.boundary)}</p></section>
      </div><aside class="detail-aside" aria-label="关联与证据">
        <section class="relation-section"><h4>关联路径</h4><div class="relation-origin">${e(n.title)}</div><ul class="relation-list">${relatedHTML}${projectIds(n).map(id=>`<li><span class="relation-type">应用于</span><a href="#project-${e(id)}"><small>项目</small><strong>${e(projects.get(id).name)}</strong></a></li>`).join('')}</ul></section>
        <section class="evidence-section"><h4>项目证据 <span class="section-note">${e(evidence.length)} 份引用</span></h4><p class="evidence-notice">履历与作者陈述，不等同于源码或运行验证。</p>${evidence.map(id=>{const s=sources.get(id); return `<details class="evidence-item" id="evidence-${e(n.id)}-${e(id)}"><summary><span class="evidence-kind">${e(s.kind)}</span><strong>${e(s.label)}</strong><span aria-hidden="true">+</span></summary><div class="evidence-body"><blockquote>${e(s.excerpt)}</blockquote><p>${e(s.scope)}</p>${s.href?`<a class="source-link" href="${e(s.href)}" target="_blank" rel="noopener noreferrer">查看履历来源 <span aria-hidden="true">↗</span><span class="sr-only">（新窗口）</span></a>`:'<span class="source-label">作者提供 · 摘要已内嵌</span>'}</div></details>`}).join('')}</section>
      </aside></div><a class="back-to-map" href="#node-${e(n.id)}" data-return-node="${e(n.id)}">返回图谱中的此节点 <span aria-hidden="true">↑</span></a>
    </details>`;
  }).join('');
  return `<a class="skip-link" href="#capability-map">跳到能力图谱</a>
  <div class="map-shell" data-engineering-map data-featured="${e(data.featured)}">
    <header class="map-header"><a class="identity" href="#overview" aria-label="George 工程能力图谱"><span class="identity-monogram" aria-hidden="true">G<span>.</span></span><span>${e(data.name)}<small>ENGINEERING PROFILE</small></span></a><nav aria-label="页面导航"><a href="#capability-map">能力</a><a href="#project-evidence">项目</a></nav><span class="review-label">设计审阅版</span></header>
    <main id="overview"><section class="map-hero" aria-labelledby="map-title"><div><p class="eyebrow">SYSTEMS · AGENTS · DELIVERY</p><h1 id="map-title">${e(data.title)}<span class="title-dot" aria-hidden="true">.</span></h1><p class="hero-intro">${e(data.intro)}</p></div><p class="hero-thesis">连接<span>交互、推理与执行</span><small>明确系统边界，让贡献可追溯。</small></p></section>
      <section id="capability-map" class="map-section" aria-label="六个工程能力领域">
        <div class="foundation"><span class="foundation-label">ROOT / 组织基础</span><strong>计算机科学 <span aria-hidden="true">+</span> 软件工程</strong><span class="foundation-principles">抽象 · 状态 · 契约 · 验证</span></div>
        <div class="map-caption"><p>六个领域，一套工程视角。</p><span>点选能力，展开问题与证据 <span aria-hidden="true">↘</span></span></div>
        <div class="domain-grid">${cards}</div>
        <div class="map-legend"><div>${Object.keys(modes).map(mode=>modeBadge(mode)).join('')}</div><p>贡献方式标在具体项目中，不设自评分数。</p></div>
      </section>
      <section id="capability-evidence" class="detail-section" aria-label="能力与工程贡献"><div class="section-topline"><h2>从能力，进入工程现场<span aria-hidden="true">↘</span></h2><span>问题 / 贡献 / 证据 / 边界</span></div><div class="detail-panels">${details}</div></section>
      <section id="project-evidence" class="project-section" aria-labelledby="project-title"><div class="section-topline"><h2 id="project-title">共享项目，各自归属</h2><span>同一项目可以支撑多个领域</span></div><div class="project-grid">${data.projects.map(p=>{const supported=data.nodes.filter(n=>projectIds(n).includes(p.id)); return `<article class="project-card" id="project-${e(p.id)}"><div class="project-card-heading"><span>${e(p.code)}</span><h3>${e(p.name)}</h3></div><p class="project-subtitle">${e(p.subtitle)}</p><p>${e(p.summary)}</p><details class="project-expansion"><summary>查看 ${supported.length} 项关联能力 <span aria-hidden="true">+</span></summary><ul>${supported.map(n=>`<li><a href="#cap-${e(n.id)}" data-node="${e(n.id)}">${e(n.title)} <small>${e(domainFor(n.id).name)}</small></a></li>`).join('')}</ul><p class="project-boundary">${e(p.boundary)}</p></details></article>`}).join('')}</div></section>
      <footer class="map-footer"><p>GEORGE / ENGINEERING MAP <span>v${data.version}.0</span></p><p>已提供经历 · 贡献归属 · 验证边界</p><details class="publication-note"><summary>范围说明</summary><p>本页不加入站内导航或搜索索引。持有链接者仍可访问，不构成权限隔离。内容采用已提供履历和作者补充；个人细粒度代码归属、测试与运行证据仍按节点标注待核。</p></details></footer>
    </main><p class="sr-only" id="map-live" role="status" aria-live="polite"></p>
  </div>`;
}
