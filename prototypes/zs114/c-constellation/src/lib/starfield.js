// 介绍页首屏「市场星图」：Canvas 2D 绘制，不依赖 WebGL。
// 每个星座是一个数据页，星是该页的观察指标；亮星是某一天真实入选的要点，标签写的是要点里的数值。
// 动效：入场连线逐段画出（不阻塞文字）→ 极慢的整体漂移 + 背景星闪烁 → 每隔几秒一束金色光沿某个星座的连线走一遍。
// 降级：prefers-reduced-motion 只画一帧终态；离屏或页面隐藏时停帧；低端机减少星数并降到 30fps。

const hash = (s, k = 0) => { let h = 2166136261 ^ k; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000 }

export function createStarfield(canvas, { groups, reduced = false, lowEnd = false, layout = 'wide' }) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  let W = 0, H = 0, dpr = 1, raf = 0, running = false, visible = true
  let colors = readColors()
  let t0 = performance.now(), lastFrame = 0
  let pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  let pulse = null, nextPulseAt = 2600
  let nodes = [], edges = [], bg = [], labels = [], ring = null

  function readColors() {
    const cs = getComputedStyle(document.documentElement)
    const v = (n) => cs.getPropertyValue(n).trim()
    return { star: v('--c-star'), dim: v('--c-star-dim'), accent: v('--c-accent'), ink2: v('--c-ink-2'), ink3: v('--c-ink-3'), line: v('--c-line-strong'), bg: v('--c-bg-deep') }
  }

  function build() {
    // 天区：宽屏放在右侧 62%，窄屏占满画布
    const box = layout === 'wide' ? { x: W * 0.5, y: H * 0.13, w: W * 0.44, h: H * 0.72 } : { x: W * 0.05, y: H * 0.1, w: W * 0.9, h: H * 0.74 }
    // 星图坐标环：以天区中心为圆心的刻度环，是「星图」的版式骨架
    ring = { x: box.x + box.w / 2, y: box.y + box.h / 2, r: layout === 'wide' ? Math.min(box.w, box.h) * 0.6 : Math.min(W, H) * 0.47 }
    nodes = []; edges = []; labels = []
    groups.forEach((g, gi) => {
      const cx = box.x + g.at[0] * box.w, cy = box.y + g.at[1] * box.h
      const R = Math.min(box.w, box.h) * (layout === 'wide' ? 0.17 : 0.16)
      const start = nodes.length
      g.stars.forEach((s, i) => {
        const a = hash(s.name, gi) * Math.PI * 2 + i * 2.1
        const r = R * (0.25 + 0.75 * hash(s.name, 3 + gi))
        nodes.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.8, fact: !!s.value, name: s.name, value: s.value, group: gi, depth: 0.6 + hash(s.name, 9) * 0.4, tw: hash(s.name, 11) * 6.28 })
      })
      // 星座连线：按离中心的角度排序后串起来，像传统星图的折线
      const ids = nodes.slice(start).map((n, k) => ({ k: start + k, a: Math.atan2(n.y - cy, n.x - cx) })).sort((p, q) => p.a - q.a).map((p) => p.k)
      for (let k = 1; k < ids.length; k++) edges.push({ a: ids[k - 1], b: ids[k], group: gi, order: k })
      labels.push({ x: cx, y: cy + R * 0.95 + 18, text: g.label, group: gi })
    })
    // 跨数据页的要点（如「背离」）连接两个星座
    groups.forEach((g, gi) => (g.links || []).forEach((to) => {
      const a = nodes.findIndex((n) => n.group === gi && n.fact), b = nodes.findIndex((n) => n.group === to && n.fact)
      if (a >= 0 && b >= 0) edges.push({ a, b, group: gi, order: 99, cross: true })
    }))
    const count = Math.round((W * H) / (lowEnd ? 9000 : 5200))
    bg = Array.from({ length: Math.min(count, 360) }, (_, i) => ({ x: hash('x' + i) * W, y: hash('y' + i) * H, r: 0.4 + hash('r' + i) * 0.9, a: 0.25 + hash('a' + i) * 0.5, tw: hash('t' + i) * 6.28, depth: 0.2 + hash('d' + i) * 0.4 }))
  }

  function resize() {
    const rect = canvas.getBoundingClientRect()
    dpr = Math.min(window.devicePixelRatio || 1, lowEnd ? 1.5 : 2)
    W = rect.width; H = rect.height
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    build()
    if (!running) draw(reduced ? 1e6 : performance.now() - t0)
  }

  const ease = (x) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3)

  function draw(t) {
    const c = colors
    ctx.clearRect(0, 0, W, H)
    pointer.x += (pointer.tx - pointer.x) * 0.04
    pointer.y += (pointer.ty - pointer.y) * 0.04
    const sway = reduced ? 0 : Math.sin(t / 14000) * 6
    const off = (d) => ({ x: pointer.x * 10 * d + sway * d, y: pointer.y * 8 * d + Math.cos(t / 17000) * 3 * d })

    // 坐标环：入场时沿圆周画出，之后极慢地转动刻度
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
    // 背景星
    ctx.fillStyle = c.dim
    for (const s of bg) {
      const o = off(s.depth)
      ctx.globalAlpha = reduced ? s.a : s.a * (0.65 + 0.35 * Math.sin(t / 1400 + s.tw))
      ctx.beginPath(); ctx.arc(s.x + o.x, s.y + o.y, s.r, 0, 6.283); ctx.fill()
    }
    ctx.globalAlpha = 1

    const P = (n) => { const o = off(n.depth); return [n.x + o.x, n.y + o.y] }
    // 连线：入场时按星座和顺序逐段画出
    ctx.lineWidth = 1
    for (const e of edges) {
      const start = 300 + e.group * 220 + e.order * 120
      const p = ease((t - start) / 700)
      if (p <= 0) continue
      const [ax, ay] = P(nodes[e.a]), [bx, by] = P(nodes[e.b])
      ctx.strokeStyle = c.line
      ctx.globalAlpha = e.cross ? 0.5 : 0.85
      if (e.cross) ctx.setLineDash([3, 4])
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * p, ay + (by - ay) * p); ctx.stroke()
      ctx.setLineDash([])
    }
    ctx.globalAlpha = 1

    // 金色光束：沿一个星座的连线走一遍，终点的要点星短暂亮起
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

    // 星与标签（要点标签做简单避让，避免同一区域的数值叠在一起）
    ctx.textBaseline = 'middle'
    const placed = []
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
        if (layout === 'wide') {
          ctx.globalAlpha = appear
          ctx.font = '500 12px ' + FONT
          ctx.fillStyle = on ? c.accent : c.ink2
          const w = ctx.measureText(n.value).width
          let ly = y
          for (const dy of [0, -18, 18, -36, 36]) { ly = y + dy; if (!placed.some((p) => x + 12 < p.x + p.w && x + 12 + w > p.x && Math.abs(ly - p.y) < 16)) break }
          placed.push({ x: x + 12, y: ly, w })
          if (ly !== y) { ctx.strokeStyle = c.line; ctx.globalAlpha = appear * 0.6; ctx.beginPath(); ctx.moveTo(x + 6, y); ctx.lineTo(x + 10, ly); ctx.stroke(); ctx.globalAlpha = appear }
          ctx.fillText(n.value, x + 12, ly)
        }
      } else {
        ctx.fillStyle = c.star
        ctx.globalAlpha = appear * (reduced ? 0.8 : 0.6 + 0.3 * Math.sin(t / 2200 + n.tw))
        ctx.beginPath(); ctx.arc(x, y, 1.7, 0, 6.283); ctx.fill()
      }
    })
    ctx.globalAlpha = 1
    ctx.font = (layout === 'wide' ? '11px ' : '10px ') + FONT
    ctx.fillStyle = c.ink3
    ctx.textAlign = 'center'
    for (const l of labels) {
      const a = ease((t - 600 - l.group * 220) / 600)
      if (a <= 0) continue
      ctx.globalAlpha = a
      const o = off(0.8)
      ctx.fillText(l.text, l.x + o.x, l.y + o.y)
    }
    ctx.textAlign = 'start'
    ctx.globalAlpha = 1
  }
  const FONT = getComputedStyle(document.documentElement).getPropertyValue('--font-sans') || 'sans-serif'

  function loop(now) {
    raf = requestAnimationFrame(loop)
    if (lowEnd && now - lastFrame < 32) return
    lastFrame = now
    draw(now - t0)
  }
  function start() { if (reduced || running || !visible || document.hidden) return; running = true; raf = requestAnimationFrame(loop) }
  function stop() { running = false; cancelAnimationFrame(raf) }

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop() })
  io.observe(canvas)
  const onVis = () => (document.hidden ? stop() : start())
  document.addEventListener('visibilitychange', onVis)
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  const mo = new MutationObserver(() => { colors = readColors(); if (!running) draw(reduced ? 1e6 : performance.now() - t0) })
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const onMove = (e) => { const r = canvas.getBoundingClientRect(); pointer.tx = (e.clientX - r.left) / r.width - 0.5; pointer.ty = (e.clientY - r.top) / r.height - 0.5 }
  if (!reduced && matchMedia('(pointer: fine)').matches) window.addEventListener('pointermove', onMove, { passive: true })

  resize()
  start()
  return {
    destroy() { stop(); io.disconnect(); ro.disconnect(); mo.disconnect(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pointermove', onMove) },
  }
}
