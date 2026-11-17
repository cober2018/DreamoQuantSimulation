<!-- 下钻抽屉：把一条要点从句子一路追到口径、字段、日期和明细页。用原生 dialog，焦点圈定与 Esc 关闭由浏览器负责。 -->
<template>
  <dialog ref="dlg" id="fact-sheet" class="sheet" aria-labelledby="sheet-title" @close="$emit('close')" @click.self="close">
    <div v-if="fact" class="inner">
      <header class="hd">
        <span class="kind"><KindGlyph :kind="fact.kind" />{{ fact.kind }} · 第 {{ rank }} 条</span>
        <span class="badge stat">统计</span>
        <button id="sheet-close" class="btn sm ghost close" type="button" @click="close">关闭<span class="sr-only">要点详情</span></button>
      </header>
      <h2 id="sheet-title" class="stmt"><Statement :fact="fact" /></h2>

      <section class="trace" aria-label="追溯链">
        <h3 class="cap">追溯链</h3>
        <ol>
          <li><span class="k">口径</span><span class="v">{{ fact.source }}</span></li>
          <li><span class="k">字段</span><span class="v"><code v-for="f in fact.fields" :key="f">{{ f }}</code></span></li>
          <li><span class="k">数据日期</span><span class="v tnum">{{ fact.data_date }}</span></li>
          <li><span class="k">规则</span><span class="v">{{ KINDS[fact.kind]?.hint }}；按固定模板生成，不经大模型改写。<template v-if="fact.definition"><br />{{ fact.definition }}</template></span></li>
          <li class="last"><span class="k">明细页</span><span class="v links"><router-link v-for="m in mods" :key="m.key" :to="m.to" class="lnk" @click="close">{{ m.label }} →</router-link></span></li>
        </ol>
      </section>

      <section class="strength" aria-label="偏离程度">
        <div class="row"><span class="cap">偏离程度</span><span class="tnum big">{{ Math.round(fact.strength) }}<small> / 100</small></span></div>
        <div class="track"><i :style="{ width: fact.strength + '%' }" /></div>
        <p class="note">只用于当天排序，表示离常态有多远，不代表方向，也不构成判断。</p>
      </section>
    </div>
  </dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import KindGlyph from './KindGlyph.vue'
import Statement from './Statement.vue'
import { KINDS, modulesOfSource, moduleByKey } from '../lib/brief.js'

const props = defineProps({ fact: Object, rank: Number })
defineEmits(['close'])
const dlg = ref(null)
const mods = computed(() => (props.fact ? modulesOfSource(props.fact.source).map((k) => moduleByKey[k]) : []))
watch(() => props.fact, async (f) => { await nextTick(); if (f && !dlg.value.open) dlg.value.showModal() })
const close = () => dlg.value?.close()
</script>

<style scoped>
.sheet {
  margin: 0 0 0 auto; height: 100vh; max-height: 100vh; width: min(480px, 100vw); max-width: 100vw;
  padding: 0; border: 0; border-left: 1px solid var(--c-line-strong);
  background: var(--c-surface); color: var(--c-ink); box-shadow: var(--shadow-2);
}
.sheet[open] { animation: in var(--dur-3) var(--ease-out); }
.sheet::backdrop { background: var(--c-scrim); }
@keyframes in { from { transform: translateX(24px); opacity: 0; } }
.inner { padding: var(--s-5) var(--s-6); display: flex; flex-direction: column; gap: var(--s-6); }
.hd { display: flex; align-items: center; gap: var(--s-2); }
.kind { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-xs); color: var(--c-ink-2); }
.close { margin-left: auto; }
.stmt { font-size: var(--fs-lg); line-height: 1.6; font-weight: 400; color: var(--c-ink-2); }
.cap { font-size: var(--fs-xs); font-weight: 500; color: var(--c-ink-3); letter-spacing: 0.08em; }
.trace ol { margin-top: var(--s-3); }
/* 追溯链：一根细线串起五个节点，最后一个节点（明细页）是金色 */
.trace li { position: relative; display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: var(--s-3); padding: 0 0 var(--s-4) var(--s-5); font-size: var(--fs-sm); }
.trace li::before { content: ""; position: absolute; left: 3px; top: 7px; width: 7px; height: 7px; border-radius: 50%; border: 1px solid var(--c-ink-3); background: var(--c-surface); z-index: 1; }
.trace li::after { content: ""; position: absolute; left: 6.5px; top: 14px; bottom: -6px; width: 1px; background: var(--c-line-strong); }
.trace li.last::after { display: none; }
.trace li.last::before { background: var(--c-accent); border-color: var(--c-accent); }
.k { color: var(--c-ink-3); }
.v { color: var(--c-ink); line-height: 1.6; }
code { display: inline-block; margin: 0 6px 4px 0; padding: 0 6px; border-radius: var(--r-1); background: var(--c-surface-2); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--c-ink-2); }
.links { display: flex; flex-wrap: wrap; gap: var(--s-3); }
.lnk { color: var(--c-accent-ink); font-weight: 500; border-bottom: 1px solid transparent; transition: border-color var(--dur-2); }
.lnk:hover { border-color: currentColor; }
.strength .row { display: flex; align-items: baseline; justify-content: space-between; }
.big { font-size: var(--fs-xl); font-family: var(--font-display); }
.big small { font-size: var(--fs-sm); color: var(--c-ink-3); font-family: var(--font-sans); }
.track { margin-top: var(--s-2); height: 2px; background: var(--c-line); border-radius: 2px; }
.track i { display: block; height: 100%; background: var(--c-accent); border-radius: 2px; }
.note { margin-top: var(--s-3); font-size: var(--fs-xs); color: var(--c-ink-3); line-height: 1.6; }
@media (max-width: 640px) {
  .sheet { margin: auto 0 0; width: 100vw; height: auto; max-height: 88vh; border-left: 0; border-top: 1px solid var(--c-line-strong); border-radius: var(--r-3) var(--r-3) 0 0; }
  .inner { padding: var(--s-5) var(--s-4); gap: var(--s-5); }
  @keyframes in { from { transform: translateY(24px); opacity: 0; } }
}
</style>
