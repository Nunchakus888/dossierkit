/** Static, semantic engineering map. Reading the skills never requires JavaScript. */
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const e = escapeHtml;
const MODES = { own: '自主实现', integration: '开源集成', mixed: '实现 + 集成' };
const ID = /^[a-z][a-z0-9-]*$/;
export function validateMap(data) {
  if (!data || data.version !== 2 || data.locale !== 'zh') throw new Error('Unsupported engineering-map data');
  const nodes = new Map(data.nodes.map(n => [n.id, n]));
  const projects = new Map(data.projects.map(p => [p.id, p]));
  if (nodes.size !== data.nodes.length || projects.size !== data.projects.length) throw new Error('Duplicate IDs');
  const placements = data.domains.flatMap(d => d.nodes);
  if (placements.length !== nodes.size || new Set(placements).size !== nodes.size) throw new Error('Each capability requires one primary group');
  for (const d of data.domains) {
    if (!ID.test(d.id) || !d.name) throw new Error('Invalid domain');
    for (const id of d.nodes) if (!nodes.has(id)) throw new Error('Unknown capability');
  }
  for (const n of data.nodes) {
    if (!ID.test(n.id) || !n.title || !n.tech?.length || !n.work || !n.problem || !n.boundary || !MODES[n.mode] || !projects.has(n.project)) throw new Error(`Incomplete capability: ${n.id}`);
  }
  for (const p of data.projects) if (!ID.test(p.id) || !p.name || !p.source || !p.problem || !p.work?.length || !p.boundary || !p.evidence) throw new Error('Incomplete evidence');
  for (const r of data.relations) if (!nodes.has(r.from) || r.type !== 'depends' || !r.to?.length || r.to.some(id => !nodes.has(id))) throw new Error('Invalid dependency');
  for (const x of data.extensions) if (!['research', 'plan'].includes(x.kind) || !x.title || !x.text) throw new Error('Invalid extension');
  return data;
}
export function renderEngineeringMap(input) {
  const data = validateMap(input);
  const nodes = new Map(data.nodes.map(n => [n.id,n]));
  const projects = new Map(data.projects.map(p => [p.id,p]));
  const domains = data.domains.map(d => `<section class="branch" id="domain-${e(d.id)}" aria-labelledby="heading-${e(d.id)}" data-domain="${e(d.id)}">
    <h2 id="heading-${e(d.id)}" class="branch-name"><span class="branch-number">${e(d.number)}</span><span>${e(d.name)}</span></h2>
    <ul class="skills">${d.nodes.map(id => {
      const n = nodes.get(id), p = projects.get(n.project);
      return `<li class="skill" id="node-${e(n.id)}" data-capability="${e(n.id)}"><span id="cap-${e(n.id)}" class="anchor-marker" aria-hidden="true"></span>
        <h3 aria-label="${e(n.title)}：${e(n.tech.join(' / '))}">${n.tech.map(t=>`<span>${e(t)}</span>`).join('<i aria-hidden="true"> / </i>')}</h3>
        <p class="skill-project">${e(p.label)}${n.mode !== 'own' ? `<span class="ownership">${e(MODES[n.mode])}</span>` : ''}</p>
        <p class="skill-work">${e(n.work)}</p>
      </li>`;
    }).join('')}</ul>
  </section>`).join('');
  const evidence = data.projects.map((p,index) => {
    const capabilities = data.nodes.filter(n=>n.project===p.id);
    return `<article class="project-record" id="project-${e(p.id)}">
      <header><span class="project-number">${String(index+1).padStart(2,'0')}</span><div><h3>${e(p.name)}</h3><p class="project-role">${e(p.role)}</p></div></header>
      <div class="project-problem"><span class="minor-label">工程问题</span><p>${e(p.problem)}</p></div>
      <ul class="project-work">${p.work.map(w=>`<li>${e(w)}</li>`).join('')}</ul>
      <p class="project-boundary"><strong>验证边界</strong>${e(p.boundary)}</p>
      <details class="evidence"><summary>来源与逐项边界<span aria-hidden="true">＋</span></summary>
        <div class="evidence-body"><p class="source-name">${e(p.source)}</p><p class="source-summary">${e(p.evidence)}</p>
          <dl>${capabilities.map(n=>`<div><dt>${e(n.tech.join(' / '))}<small>${e(MODES[n.mode])}</small></dt><dd><p><strong>问题</strong>${e(n.problem)}</p><p><strong>贡献</strong>${e(n.work)}</p><p><strong>边界</strong>${e(n.boundary)}</p></dd></div>`).join('')}</dl>
        </div>
      </details>
    </article>`;
  }).join('');
  return `<main class="atlas" data-map-version="2">
    <header class="masthead"><div><p class="author">${e(data.name)} <span>/ ENGINEERING</span></p><h1>${e(data.title)}</h1></div><p class="positioning">跨端 AI 产品 · 业务 Agent · Cowork<br><span>从产品交付到任务执行的工程实践</span></p></header>
    <section class="graph" aria-label="以计算机科学与软件工程为基础的六个技术领域">
      <div class="origin"><div class="origin-label"><span class="minor-label">组织基础</span><strong>计算机科学</strong><span class="origin-plus" aria-hidden="true">＋</span><strong>软件工程</strong><small>抽象 · 状态<br>并发 · 契约</small></div></div>
      <div class="branches">${domains}</div>
    </section>
    <section class="dependencies" aria-labelledby="dependency-title"><h2 id="dependency-title">跨领域依赖</h2><div class="dependency-grid">${data.relations.map(r=>`<article class="dependency"><div class="dependency-line"><strong>${e(r.name)}</strong><span class="edge-label">依赖 <span aria-hidden="true">→</span></span><strong>${e(r.target)}</strong></div><p>${e(r.explanation)}</p></article>`).join('')}</div></section>
    <section class="projects" aria-labelledby="projects-title"><div class="section-heading"><h2 id="projects-title">工程贡献与项目依据</h2><p>三个项目分别归属，成果不混用。</p></div><div class="project-records">${evidence}</div></section>
    <section class="extensions" aria-label="研究与规划">${data.extensions.map(x=>`<p><span>${x.kind==='research'?'研究':'规划'}</span><strong>${e(x.title)}</strong>${e(x.text)}</p>`).join('')}</section>
    <footer class="atlas-footer"><p>${e(data.evidencePolicy)}</p><small>George · 技术能力图谱 / 02</small></footer>
  </main>`;
}
