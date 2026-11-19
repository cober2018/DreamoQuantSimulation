// 介绍页首屏「市场星图」：Canvas 2D 画星、连线和坐标环，不依赖 WebGL；所有文字标签放在画布上方的 DOM 层里，
// 这样能按真实文字尺寸做碰撞避让，也能被键盘和读屏软件访问。
// 标签避让：先放星座名，再把读数标签按 y 排序逐个试位（右 → 右侧上下微移 → 左 → 上下），
// 与已放标签、亮星、文案区和画布边界都不相交才落位；都放不下就收成编号标记，悬停 / 聚焦时展开。
// 动效：入场连线逐段画出 → 极慢漂移 + 背景星闪烁 → 每隔几秒一束金光沿某个星座走一遍。
// 降级：prefers-reduced-motion 只画一帧终态；离屏或页面隐藏时停帧；低端机减少星数并降到 30fps；触屏不做视差。

const hash = (s, k = 0) => { let h = 2166136261 ^ k; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000 }
const LABEL_DEPTH = 0.8 // 亮星与全部标签同一视差深度：整层平移时，标签和星的相对位置不变
const GAP = 4 // 标签之间至少留 4px

export const intersects = (a, b, pad = 0) => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y

// 纯函数：给定标签尺寸和障碍，返回每个标签的位置，或「收起」为编号标记
// 线段与矩形是否相交（Liang–Barsky 裁剪）
function segHitsRect([x1, y1, x2, y2], r) {
  let t0 = 0, t1 = 1
  const dx = x2 - x1, dy = y2 - y1
  for (const [p, q] of [[-dx, x1 - r.x], [dx, r.x + r.w - x1], [-dy, y1 - r.y], [dy, r.y + r.h - y1]]) {
    if (p === 0) { if (q < 0) return false; continue }
    const t = q / p
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t } else { if (t < t0) return false; if (t < t1) t1 = t }
  }
  return true
}

export function layoutLabels({ groupLabels, factLabels, obstacles, bounds, segments = [], marker = 20 }) {
  const placed = []
  const inside = (r) => r.x >= bounds.x && r.y >= bounds.y && r.x + r.w <= bounds.x + bounds.w && r.y + r.h <= bounds.y + bounds.h
  const clear = (r, obs) => inside(r) && !placed.some((p) => intersects(r, p, GAP)) && !obs.some((o) => intersects(r, o, 2))
  // 两轮：先找不压星座连线的位置，找不到再允许压线（文字有底色描边，压线仍可读）
  const pick = (tries, ok) => tries.find((r) => ok(r) && !segments.some((sg) => segHitsRect(sg, r))) || tries.find(ok)
  const out = { groups: [], facts: [] }

  for (const g of groupLabels) {
    const tries = []
    for (const dy of [0, 14, -14, 28]) for (const dx of [0, -24, 24, -48, 48]) tries.push({ x: g.x - g.w / 2 + dx, y: g.y + dy })
    tries.push({ x: g.x - g.w / 2, y: g.yAbove })
    const hit = pick(tries.map((p) => ({ ...p, w: g.w, h: g.h })), (r) => clear(r, obstacles))
    if (hit) placed.push(hit)
    out.groups.push(hit || null)
  }

  const order = factLabels.map((_, i) => i).sort((a, b) => factLabels[a].sy - factLabels[b].sy)
  for (const i of order) {
    const f = factLabels[i]
    const R = 12 // 星点半径 + 间距
    const right = (dy) => ({ x: f.sx + R, y: f.sy - f.h / 2 + dy, w: f.w, h: f.h })
    const left = (dy) => ({ x: f.sx - R - f.w, y: f.sy - f.h / 2 + dy, w: f.w, h: f.h })
    const tries = [right(0), right(-16), right(16), left(0), left(-16), left(16), right(-32), right(32), left(-32), left(32),
      { x: f.sx - f.w / 2, y: f.sy - R - f.h, w: f.w, h: f.h }, { x: f.sx - f.w / 2, y: f.sy + R, w: f.w, h: f.h }]
    const own = obstacles.filter((o) => o.star !== i) // 自己的星不挡自己的标签
    let hit = pick(tries, (r) => clear(r, own))
    if (hit) { placed.push(hit); out.facts[i] = { ...hit, collapsed: false, leader: hit !== tries[0] }; continue }
    // 放不下：收成编号标记，标记本身也要避让
    const m = marker
    const mt = [{ x: f.sx + 7, y: f.sy - m - 3 }, { x: f.sx - m - 7, y: f.sy - m - 3 }, { x: f.sx + 7, y: f.sy + 3 }, { x: f.sx - m - 7, y: f.sy + 3 }, { x: f.sx + 9, y: f.sy - m / 2 }, { x: f.sx - m - 9, y: f.sy - m / 2 }]
      .map((p) => ({ ...p, w: m, h: m }))
    hit = mt.find((r) => clear(r, own)) || mt.find((r) => inside(r) && !placed.some((p) => intersects(r, p, 1)))
    // 连标记都放不下（极端密集）：图上不画标记，只在图例里列出，保证任何两个标签都不相交
    if (hit) placed.push(hit)
    out.facts[i] = { ...(hit || mt[0]), collapsed: true, offmap: !hit, leader: false }
  }
  return out
}

export function createStarfield(canvas, { groups, layer, avoid = () => [], reduced = false, lowEnd = false, layout = 'wide', onLayout = () => {} }) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  let W = 0, H = 0, dpr = 1, raf = 0, running = false, visible = true
  let colors = readColors()
  const t0 = performance.now()
  let lastFrame = 0
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  let pulse = null, nextPulseAt = 2600, litPrev = -1
  const frameCost = [] // 最近 120 帧的绘制耗时（ms），供性能自查
  let nodes = [], edges = [], bg = [], ring = null, groupAnchors = [], factLayout = [], factEls = [], groupEls = []
  let pointerIn = false, px = 0, py = 0, hotPrev = -1

  function readColors() {
    const cs = getComputedStyle(document.documentElement)
    const v = (n) => cs.getPropertyValue(n).trim()
    return { star: v('--c-star'), dim: v('--c-star-dim'), accent: v('--c-accent'), line: v('--c-line-strong') }
  }

  function build() {
    // 天区：宽屏放在右侧，窄屏占满画布
    const nw = Math.min(W * 0.88, H * 1.8)
    const box = layout === 'wide' ? { x: W * 0.5, y: H * 0.15, w: W * 0.44, h: H * 0.68 } : { x: (W - nw) / 2, y: H * 0.1, w: nw, h: H * 0.72 }
    ring = { x: box.x + box.w / 2, y: box.y + box.h / 2, r: layout === 'wide' ? Math.min(box.w, box.h) * 0.6 : Math.min(W, H) * 0.47 }
    nodes = []; edges = []; groupAnchors = []
    groups.forEach((g, gi) => {
      const cx = box.x + g.at[0] * box.w, cy = box.y + g.at[1] * box.h
      const R = Math.min(box.w, box.h) * (layout === 'wide' ? 0.17 : 0.16)
      const start = nodes.length
      g.stars.forEach((s, i) => {
        const a = hash(s.name, gi) * Math.PI * 2 + i * 2.1
        const r = R * (0.25 + 0.75 * hash(s.name, 3 + gi))
        const fact = !!s.value
        nodes.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.8, fact, name: s.name, value: s.value, group: gi, depth: fact ? LABEL_DEPTH : 0.6 + hash(s.name, 9) * 0.4, tw: hash(s.name, 11) * 6.28 })
      })
      const ids = nodes.slice(start).map((n, k) => ({ k: start + k, a: Math.atan2(n.y - cy, n.x - cx) })).sort((p, q) => p.a - q.a).map((p) => p.k)
      for (let k = 1; k < ids.length; k++) edges.push({ a: ids[k - 1], b: ids[k], group: gi, order: k })
      groupAnchors.push({ x: cx, y: cy + R * 0.95 + 8, yAbove: cy - R * 0.95 - 22, text: g.label, cx, cy, r: R })
    })
    groups.forEach((g, gi) => (g.links || []).forEach((to) => {
      const a = nodes.findIndex((n) => n.group === gi && n.fact), b = nodes.findIndex((n) => n.group === to && n.fact)
      if (a >= 0 && b >= 0) edges.push({ a, b, group: gi, order: 99, cross: true })
    }))
    const count = Math.round((W * H) / (lowEnd ? 9000 : 5200))
    bg = Array.from({ length: Math.min(count, 360) }, (_, i) => ({ x: hash('x' + i) * W, y: hash('y' + i) * H, r: 0.4 + hash('r' + i) * 0.9, a: 0.25 + hash('a' + i) * 0.5, tw: hash('t' + i) * 6.28, depth: 0.2 + hash('d' + i) * 0.4 }))
    // 标签要量 DOM 尺寸，放到下一个任务里做，避免和画布初始化挤成一个长任务
    clearTimeout(labelTimer)
    labelTimer = setTimeout(buildLabels, 0)
  }
  let labelTimer = 0

  // ---------- DOM 标签层 ----------
  function buildLabels() {
    if (!layer) return
    layer.replaceChildren()
    layer.classList.remove('in')
    delete layer.dataset.ready
    const facts = nodes.map((n, i) => ({ n, i })).filter((x) => x.n.fact)
    const mk = (cls, text) => { const el = document.createElement('span'); el.className = cls; el.textContent = text; el.setAttribute('aria-hidden', 'true'); layer.appendChild(el); return el }
    const gEls = groupAnchors.map((g) => mk('sl grp', g.text))
    const fEls = facts.map((f) => mk('sl fact', f.n.value))
    const gl = groupAnchors.map((g, k) => ({ ...g, w: gEls[k].offsetWidth, h: gEls[k].offsetHeight }))
    const fl = facts.map((f, k) => ({ sx: f.n.x, sy: f.n.y, w: fEls[k].offsetWidth, h: fEls[k].offsetHeight }))
    const pad = layout === 'wide' ? 12 : 6
    const obstacles = [
      ...avoid().map((r) => ({ x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 })),
      ...facts.map((f, k) => ({ x: f.n.x - 7, y: f.n.y - 7, w: 14, h: 14, star: k })),
    ]
    // 暗星也算障碍（小一些），避免数值压在星点上
    for (const n of nodes) if (!n.fact) obstacles.push({ x: n.x - 3, y: n.y - 3, w: 6, h: 6 })
    const segments = edges.filter((e) => !e.cross).map((e) => [nodes[e.a].x, nodes[e.a].y, nodes[e.b].x, nodes[e.b].y])
    const top = layout === 'wide' ? 76 : 6
    const res = layoutLabels({ groupLabels: gl, factLabels: fl, obstacles, segments, bounds: { x: 6, y: top, w: W - 12, h: H - top - 6 } })
    groupEls = gEls
    res.groups.forEach((r, k) => { const el = gEls[k]; if (!r) { el.hidden = true; return } place(el, r); el.style.setProperty('--d', 600 + k * 220 + 'ms') })
    factLayout = []; factEls = []
    const readings = []
    facts.forEach((f, k) => {
      const r = res.facts[k]
      const n = k + 1
      let el = fEls[k]
      if (r.offmap) {
        el.remove()
        factLayout.push({ node: f.i, rect: r }); factEls.push(null)
        readings.push({ n, text: f.n.value, group: groupAnchors[f.n.group].text, collapsed: true })
        return
      }
      if (r.collapsed) {
        el.remove()
        el = document.createElement('button')
        el.type = 'button'
        el.className = 'sky-mark' + (r.x + r.w / 2 > W * 0.6 ? ' pop-left' : '')
        el.setAttribute('aria-label', `星图读数 ${n}：${f.n.value}`)
        const num = document.createElement('span'); num.setAttribute('aria-hidden', 'true'); num.textContent = n
        const pop = document.createElement('span'); pop.className = 'pop'; pop.setAttribute('aria-hidden', 'true'); pop.textContent = f.n.value
        el.append(num, pop)
        layer.appendChild(el)
      }
      place(el, r)
      el.style.setProperty('--d', 600 + f.n.group * 220 + 'ms')
      factLayout.push({ node: f.i, rect: r })
      factEls.push(el)
      readings.push({ n, text: f.n.value, group: groupAnchors[f.n.group].text, collapsed: r.collapsed })
    })
    layer.dataset.ready = '1'
    layer.dataset.collapsed = String(readings.filter((x) => x.collapsed).length)
    requestAnimationFrame(() => layer.classList.add('in'))
    onLayout(readings)
  }
  const place = (el, r) => { el.style.left = r.x + 'px'; el.style.top = r.y + 'px' }

  function resize() {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    dpr = Math.min(window.devicePixelRatio || 1, lowEnd ? 1.5 : 2)
    W = rect.width; H = rect.height
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    performance.mark('zx-sky-build')
    build()
    performance.measure('zx-sky-build', 'zx-sky-build')
    if (!running) draw(reduced ? 1e6 : performance.now() - t0)
  }

  const ease = (x) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3)

  function draw(t) {
    const c = colors
    ctx.clearRect(0, 0, W, H)
    pointer.x += (pointer.tx - pointer.x) * 0.04
    pointer.y += (pointer.ty - pointer.y) * 0.04
    const sway = reduced ? 0 : Math.sin(t / 14000) * 6
    const off = (d) => ({ x: pointer.x * 10 * d + sway * d, y: pointer.y * 8 * d + (reduced ? 0 : Math.cos(t / 17000) * 3) * d })
    const lo = off(LABEL_DEPTH)
    if (layer) layer.style.transform = `translate3d(${lo.x.toFixed(2)}px, ${lo.y.toFixed(2)}px, 0)`

    if (ring) {
      const o = off(0.3), cx = ring.x + o.x, cy = ring.y + o.y
      const pr = reduced ? 1 : ease((t - 100) / 1800)
      const rot = reduced ? 0 : t / 240000
      ctx.strokeStyle = c.line; ctx.lineWidth = 1
      ctx.globalAlpha = 0.55
      ctx.beginPath(); ctx.arc(cx, cy, ring.r, -Math.PI / 2, -Math.PI / 2 + pr * 6.283); ctx.stroke()
      ctx.globalAlpha = 0.35; ctx.setLineDash([2, 5])
      ctx.beginPath(); ctx.arc(cx, cy, ring.r * 0.62, -Math.PI / 2, -Math.PI / 2 + pr * 6.283); ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 0.18
      ctx.beginPath(); ctx.moveTo(cx - ring.r * pr, cy); ctx.lineTo(cx + ring.r * pr, cy); ctx.moveTo(cx, cy - ring.r * pr); ctx.lineTo(cx, cy + ring.r * pr); ctx.stroke()
      ctx.globalAlpha = 0.5 * pr
      for (let i = 0; i < 72; i++) {
        const a = rot + (i / 72) * 6.283, long = i % 6 === 0, r0 = ring.r, r1 = ring.r + (long ? 9 : 4)
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
    ctx.fillStyle = c.dim
    for (const s of bg) {
      const o = off(s.depth)
      ctx.globalAlpha = reduced ? s.a : s.a * (0.65 + 0.35 * Math.sin(t / 1400 + s.tw))
      ctx.beginPath(); ctx.arc(s.x + o.x, s.y + o.y, s.r, 0, 6.283); ctx.fill()
    }
    ctx.globalAlpha = 1

    const P = (n) => { const o = off(n.depth); return [n.x + o.x, n.y + o.y] }
    // 指针靠近某个星座时，这个星座的连线和名称转成金色（只在精确指针设备上）
    let hot = -1
    if (pointerIn) {
      let best = 1e9
      groupAnchors.forEach((g, gi) => { const d = Math.hypot(px - g.cx, py - g.cy); if (d < best && d < g.r * 1.4) { best = d; hot = gi } })
    }
    if (hot !== hotPrev) { groupEls.forEach((el, gi) => el?.classList.toggle('on', gi === hot)); hotPrev = hot }
    ctx.lineWidth = 1
    for (const e of edges) {
      const start = 300 + e.group * 220 + e.order * 120
      const p = ease((t - start) / 700)
      if (p <= 0) continue
      const [ax, ay] = P(nodes[e.a]), [bx, by] = P(nodes[e.b])
      const isHot = e.group === hot && !e.cross
      ctx.strokeStyle = isHot ? c.accent : c.line
      ctx.globalAlpha = e.cross ? 0.5 : isHot ? 1 : 0.85
      if (e.cross) ctx.setLineDash([3, 4])
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * p, ay + (by - ay) * p); ctx.stroke()
      ctx.setLineDash([])
    }
    ctx.globalAlpha = 1

    let lit = -1
    if (pulse) {
      const k = (t - pulse.t) / pulse.dur
      if (k >= 1.25) pulse = null
      else {
        const path = pulse.path, seg = Math.min(k, 1) * (path.length - 1), i = Math.floor(seg), f = seg - i
        const a = P(nodes[path[Math.min(i, path.length - 1)]]), b = P(nodes[path[Math.min(i + 1, path.length - 1)]])
        const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f
        const g = ctx.createRadialGradient(x, y, 0, x, y, 18)
        g.addColorStop(0, c.accent); g.addColorStop(1, 'transparent')
        ctx.globalAlpha = k > 1 ? 1.25 - k : 0.9
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 18, 0, 6.283); ctx.fill()
        ctx.globalAlpha = 1
        if (k > 0.85) lit = pulse.target
      }
    } else if (!reduced && t > nextPulseAt) {
      const gi = Math.floor(hash('p' + Math.floor(t / 1000)) * groups.length)
      const path = [edges.find((e) => e.group === gi && e.order === 1)?.a, ...edges.filter((e) => e.group === gi && !e.cross).map((e) => e.b)].filter((v) => v !== undefined)
      const target = path.find((id) => nodes[id].fact) ?? path[path.length - 1]
      if (path.length > 1) pulse = { t, dur: 2400, path, target }
      nextPulseAt = t + 5200
    }
    // 光束到达的亮星：对应的 DOM 标签同步点亮（只在变化时改 class）
    if (lit !== litPrev) {
      factLayout.forEach((f, k) => factEls[k]?.classList.toggle('on', f.node === lit))
      litPrev = lit
    }

    nodes.forEach((n, i) => {
      const [x, y] = P(n)
      const appear = ease((t - 200 - n.group * 220) / 600)
      if (appear <= 0) return
      ctx.globalAlpha = appear
      if (n.fact) {
        const on = i === lit
        ctx.fillStyle = on ? c.accent : c.star
        const r = on ? 4.2 : 3.2
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill()
        ctx.strokeStyle = on ? c.accent : c.star; ctx.globalAlpha = appear * (on ? 0.6 : 0.3)
        ctx.beginPath(); ctx.arc(x, y, r + 5, 0, 6.283); ctx.stroke()
      } else {
        ctx.fillStyle = c.star
        ctx.globalAlpha = appear * (reduced ? 0.8 : 0.6 + 0.3 * Math.sin(t / 2200 + n.tw))
        ctx.beginPath(); ctx.arc(x, y, 1.7, 0, 6.283); ctx.fill()
      }
    })
    // 标签被挪开时，从星到标签画一条短引线
    ctx.strokeStyle = c.line; ctx.lineWidth = 1
    for (const f of factLayout) {
      if (!f.rect.leader) continue
      const n = nodes[f.node], [x, y] = P(n)
      const appear = ease((t - 600 - n.group * 220) / 600)
      if (appear <= 0) continue
      const r = f.rect, lx = Math.max(r.x, Math.min(n.x, r.x + r.w)) + lo.x, ly = Math.max(r.y, Math.min(n.y, r.y + r.h)) + lo.y
      ctx.globalAlpha = appear * 0.7
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lx, ly); ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  function loop(now) {
    raf = requestAnimationFrame(loop)
    if (lowEnd && now - lastFrame < 32) return
    lastFrame = now
    const a = performance.now()
    draw(now - t0)
    frameCost.push(performance.now() - a)
    if (frameCost.length > 120) frameCost.shift()
  }
  function start() { if (reduced || running || !visible || document.hidden) return; running = true; raf = requestAnimationFrame(loop) }
  function stop() { running = false; cancelAnimationFrame(raf) }

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop() })
  io.observe(canvas)
  const onVis = () => (document.hidden ? stop() : start())
  document.addEventListener('visibilitychange', onVis)
  let lastW = 0, lastH = 0
  const ro = new ResizeObserver(() => { const r = canvas.getBoundingClientRect(); if (Math.abs(r.width - lastW) < 1 && Math.abs(r.height - lastH) < 1) return; lastW = r.width; lastH = r.height; requestAnimationFrame(resize) })
  ro.observe(canvas)
  const mo = new MutationObserver(() => { colors = readColors(); if (!running) draw(reduced ? 1e6 : performance.now() - t0) })
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect()
    pointer.tx = (e.clientX - r.left) / r.width - 0.5; pointer.ty = (e.clientY - r.top) / r.height - 0.5
    px = e.clientX - r.left; py = e.clientY - r.top; pointerIn = px >= 0 && py >= 0 && px <= r.width && py <= r.height
  }
  if (!reduced && matchMedia('(pointer: fine)').matches) window.addEventListener('pointermove', onMove, { passive: true })

  start()
  return {
    frameCost,
    destroy() { stop(); clearTimeout(labelTimer); io.disconnect(); ro.disconnect(); mo.disconnect(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pointermove', onMove); layer?.replaceChildren() },
  }
}
