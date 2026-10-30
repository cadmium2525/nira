import './style.css';
import { GameScene } from './scene';
import { createChives, createWind, launch, powerAt, stepFlight, type Chive, type Flight, type ThrowResult, type Wind } from './simulation';
import { prepareResultCard, shareResultCard, downloadResultCard, type PreparedResultCard, type ShareResult } from './share';

const icons = {
 leaf: '<svg viewBox="0 0 40 44" fill="none"><path d="M10 35C5 18 16 3 32 2 34 19 23 34 10 35Z" fill="currentColor"/><path d="M8 42 24 13" stroke="#b8c99a" stroke-width="2.5" stroke-linecap="round"/><path d="M17 37C15 24 24 16 36 15 35 28 28 35 17 37Z" fill="currentColor"/></svg>',
 arrow: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 up: '<svg viewBox="0 0 32 32" fill="none"><path d="M16 26V6M7 15l9-9 9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 share: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 15V3m-4 4 4-4 4 4M6 11H4v10h16V11h-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 sound: '<svg viewBox="0 0 24 24" fill="none"><path d="m11 5-5 4H3v6h3l5 4V5Zm5 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 muted: '<svg viewBox="0 0 24 24" fill="none"><path d="m11 5-5 4H3v6h3l5 4V5Zm5 4 6 6m0-6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 download: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 replay: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const $ = <T extends HTMLElement = HTMLElement>(s: string): T => document.querySelector<T>(s)!;
$('#app').innerHTML = `
<main class="game" data-phase="select">
  <div id="scene" aria-label="ニラのトレイと競技場"></div>
  <div class="paper-light"></div>
  <header class="header">
    <a class="brand" href="./" aria-label="ニラ飛ばし ホーム">${icons.leaf}<span>NIRA<span>THROW</span></span><i></i></a>
    <p class="brand-note">その一本に、可能性はある。</p>
    <div class="tools"><button id="sound" class="icon-button" aria-label="音をオンにする" aria-pressed="false">${icons.muted}</button><button id="help" class="icon-button help-button" aria-label="遊び方">?</button></div>
  </header>
  <nav class="steps" aria-label="ゲームの進行"><span class="active" data-step="select"><b>01</b><span>えらぶ</span></span><i></i><span data-step="throw"><b>02</b><span>とばす</span></span><i></i><span data-step="result"><b>03</b><span>きろく</span></span></nav>
  <section class="heading"><p id="eyebrow">PICK YOUR TWO</p><h1 id="title">ニラを選べ<span>！</span></h1><p id="subtitle">直感で、気になる2本をタップ。</p></section>

  <section id="selection" class="selection" aria-label="ニラの選択">
    <div class="tray-caption"><span class="tiny-line"></span> TODAY'S FRESH PICKS <span>8本の個性、2本の相棒。</span></div>
    <div id="pick-buttons" class="pick-buttons" aria-label="ニラを選ぶ"></div>
    <div class="selection-dock">
      <div class="picks"><button class="pick-slot" id="slot-0" aria-label="1本目 未選択"><span class="pick-index">01</span><span class="pick-leaf">${icons.leaf}</span><span class="pick-name">1本目を選ぶ</span><span class="pick-remove">×</span></button><span class="pick-plus">＋</span><button class="pick-slot" id="slot-1" aria-label="2本目 未選択"><span class="pick-index">02</span><span class="pick-leaf">${icons.leaf}</span><span class="pick-name">2本目を選ぶ</span><span class="pick-remove">×</span></button></div>
      <button id="start" class="primary" disabled><span>あと2本えらぼう</span>${icons.arrow}</button>
    </div>
  </section>

  <section id="play" class="play hidden" aria-label="ニラ投げ">
    <div class="throw-info"><span class="eyebrow">THROW</span><strong id="throw-count">01 <small>/ 02</small></strong><span id="chive-name">すらり</span></div>
    <div class="wind"><span id="wind-arrow">${icons.up}</span><div><span class="eyebrow">WIND</span><strong id="wind-speed">0.0 <small>m/s</small></strong><span id="wind-label">追い風</span></div></div>
    <div id="live-distance" class="live-distance hidden"><strong>0.0</strong><span>m</span><small id="flight-status">FLY, NIRA, FLY.</small></div>
    <div id="gesture" class="gesture" role="button" tabindex="0" aria-label="長押しして上へスワイプ。キーボードではスペース長押しして離すと中央へ投げる。">
      <div id="aim-line" class="aim-line"></div>
      <div class="throw-controls"><div class="charge-label"><span id="charge-text">長押しでパワーをためる</span><b id="power-value">0<small>%</small></b></div><div class="charge-track"><div class="perfect-zone"></div><div id="power-fill"></div><span id="power-marker"></span></div><div class="gesture-action"><div class="swipe-hint"><span>HOLD</span><i></i><span>SWIPE</span><i></i><span>FLY!</span></div><div id="throw-pad" class="throw-pad">${icons.up}</div><p id="gesture-hint">そのまま上にスワイプ</p></div></div>
    </div>
    <div id="landing" class="landing hidden"><div><span id="landing-label">NICE THROW</span><strong id="landing-distance">0.0<small>m</small></strong></div><button id="next" class="primary"><span>2投目へ</span>${icons.arrow}</button></div>
  </section>

  <section id="result" class="result hidden" aria-label="結果発表">
    <div class="result-card"><div id="card-loading">記録をカードにしています<span>…</span></div><img id="card-preview" alt="ニラの写真と2投の飛距離が入った結果カード" class="hidden" /></div>
    <div class="result-actions"><button id="share" class="primary" disabled>${icons.share}<span>記録をシェア</span></button><button id="again" class="secondary">${icons.replay}<span>もう一度</span></button><button id="save" class="icon-button" disabled aria-label="結果画像を保存">${icons.download}</button></div>
  </section>
  <footer><span>A LITTLE GREEN. A BIG DREAM.</span><span id="footer-right">2 THROWS, ONE BEST.</span></footer>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
  <dialog id="help-dialog"><button class="dialog-close" aria-label="閉じる">×</button><span class="eyebrow">HOW TO PLAY</span><h2>指ひとつで、遠くへ。</h2><ol><li><b>ニラを2本えらぶ</b><span>長さやしなりで、飛び方もいろいろ。</span></li><li><b>長押し → 上にスワイプ</b><span>メーターが右端に来たらチャンス。<br>縦の長さで高さ、左右の向きで方向を調整。</span></li><li><b>風を読んで、2投勝負</b><span>白い線を一度でも越えたら場外。<br>2投のうち、遠くへ飛んだ記録で勝負。</span></li></ol><p>PC：ドラッグ、またはスペース長押し → 離す。<br>共有：対応スマホでは写真・記録・投稿文をまとめて送れます。</p><button class="primary dialog-done">やってみよう ${icons.arrow}</button></dialog>
  <div id="gpu-error" class="gpu-error hidden"><h2>3D画面を表示できませんでした</h2><p>WebGL対応のブラウザーで開き直してください。</p><button class="primary" onclick="location.reload()">再読み込み</button></div>
</main>`;

type Phase = 'select' | 'throw' | 'result';
let phase: Phase = 'select';
let chives = createChives();
let selected: number[] = [];
let results: ThrowResult[] = [];
let wind: Wind = createWind();
let flight: Flight | null = null;
let scene: GameScene;
let prepared: PreparedResultCard | null = null;
let resultGeneration = 0;
let soundEnabled = false;
let audio: AudioContext | undefined;
let toastTimeout: ReturnType<typeof setTimeout>;
let gesture: {id:number;startX:number;startY:number;x:number;y:number;start:number;power:number;aiming:boolean;keyboard:boolean} | null = null;
let lastTimestamp = 0;
let accumulator = 0;
const STEP = 1 / 120;

function tone(frequency: number, duration = 0.08, delay = 0) {
  if (!soundEnabled) return;
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine'; osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, audio.currentTime + delay);
    gain.gain.linearRampToValueAtTime(0.07, audio.currentTime + delay + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + delay + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(audio.currentTime + delay); osc.stop(audio.currentTime + delay + duration + 0.01);
  } catch { /* Audio is optional. */ }
}
function toast(message: string) {
  clearTimeout(toastTimeout); $('#toast').textContent = message; $('#toast').classList.add('show');
  toastTimeout = setTimeout(() => $('#toast').classList.remove('show'), 3300);
}
function setPhase(value: Phase) {
  phase = value; $('.game').dataset.phase = value;
  $('#selection').classList.toggle('hidden', value !== 'select');
  $('#play').classList.toggle('hidden', value !== 'throw');
  $('#result').classList.toggle('hidden', value !== 'result');
  document.querySelectorAll<HTMLElement>('[data-step]').forEach(el => {el.classList.toggle('active', el.dataset.step === value);el.classList.toggle('done', ['select','throw','result'].indexOf(el.dataset.step!) < ['select','throw','result'].indexOf(value));});
  $('#eyebrow').textContent = value === 'select' ? 'PICK YOUR TWO' : value === 'throw' ? 'LET IT FLY' : 'YOUR GREEN RECORD';
  $('#title').innerHTML = value === 'select' ? 'ニラを選べ<span>！</span>' : value === 'throw' ? 'ニラを飛ばせ<span>！</span>' : '結果発表<span>！</span>';
  $('#subtitle').textContent = value === 'select' ? '直感で、気になる2本をタップ。' : value === 'throw' ? '風を読んで、その一本を遠くへ。' : '今日のニラ、どこまで飛んだ？';
  scene?.setMode(value);
}
function selectChive(id: number) {
  if (phase !== 'select') return;
  if (selected.includes(id)) selected = selected.filter(value => value !== id);
  else if (selected.length < 2) { selected.push(id); tone(selected.length === 1 ? 520 : 680); }
  else {toast('選んだニラをもう一度タップすると外せます'); return;}
  updatePicks();
}
function updatePicks() {
  scene?.setSelected(selected);
  for (let index = 0; index < 2; index++) {
    const slot = $(`#slot-${index}`); const chive = chives.find(item => item.id === selected[index]);
    slot.classList.toggle('filled', !!chive);
    slot.querySelector('.pick-name')!.textContent = chive?.name ?? `${index + 1}本目を選ぶ`;
    slot.setAttribute('aria-label', chive ? `${index + 1}本目 ${chive.name} 選択を外す` : `${index + 1}本目 未選択`);
  }
  const button = $<HTMLButtonElement>('#start'); button.disabled = selected.length !== 2;
  button.querySelector('span')!.textContent = selected.length === 2 ? 'この2本で、舞台へ' : `あと${2 - selected.length}本えらぼう`;
  document.querySelectorAll<HTMLButtonElement>('.pick-number').forEach(button => {button.classList.toggle('selected', selected.includes(Number(button.dataset.id)));button.setAttribute('aria-pressed', String(selected.includes(Number(button.dataset.id))));});
}
function populatePicks() {
  $('#pick-buttons').innerHTML = chives.map(chive => `<button class="pick-number" data-id="${chive.id}" aria-label="ニラ${chive.id} ${chive.name}を選ぶ" aria-pressed="false">0${chive.id}</button>`).join('');
  document.querySelectorAll<HTMLButtonElement>('.pick-number').forEach(button => button.addEventListener('click', () => selectChive(Number(button.dataset.id))));
}
function startThrow() {
  flight = null; accumulator = 0; gesture = null;
  scene.setFlight(null); scene.setHeldChive(chives.find(chive => chive.id === selected[results.length])!);
  wind = createWind(); scene.setWind(wind); scene.setAim(0, 0.6, 0);
  $('#wind-speed').innerHTML = `${wind.speed.toFixed(1)} <small>m/s</small>`;
  $('#wind-arrow').style.transform = `rotate(${Math.atan2(wind.x, wind.forward) * 180 / Math.PI}deg)`;
  $('#wind-label').textContent = Math.abs(wind.x) > Math.abs(wind.forward) ? (wind.x > 0 ? '右へ流れる風' : '左へ流れる風') : (wind.forward > 0 ? '追い風' : '向かい風');
  $('#throw-count').innerHTML = `0${results.length + 1} <small>/ 02</small>`;
  $('#chive-name').textContent = chives.find(chive => chive.id === selected[results.length])!.name;
  $('#gesture').classList.remove('hidden','charging','aiming'); $('#landing').classList.add('hidden'); $('#live-distance').classList.add('hidden');
  resetMeter();
}
function resetMeter() {
  $('#power-fill').style.width = '0%'; $('#power-marker').style.left = '0%';
  $('#power-value').innerHTML = '0<small>%</small>'; $('#charge-text').textContent = '長押しでパワーをためる'; $('#gesture-hint').textContent = 'そのまま上にスワイプ';
  $('#aim-line').style.height = '0px';
}
function beginGesture(id:number, x:number, y:number, keyboard = false) {
  if (phase !== 'throw' || flight || gesture || $<HTMLDialogElement>('#help-dialog').open) return;
  gesture = {id,startX:x,startY:y,x,y,start:performance.now(),power:0.05,aiming:false,keyboard};
  $('#gesture').classList.add('charging'); tone(220,0.05);
}
function moveGesture(x:number,y:number) {
  if (!gesture) return;
  gesture.x=x;gesture.y=y;
  const dx = x - gesture.startX; const dy = gesture.startY - y;
  if (!gesture.aiming && Math.hypot(dx,dy) > 15) {gesture.aiming=true;gesture.power=powerAt(performance.now()-gesture.start);$('#gesture').classList.add('aiming');}
  if (gesture.aiming) {
    const side = Math.max(-1,Math.min(1,dx / Math.max(80,dy)*1.2));
    const lift = Math.max(0,Math.min(1,dy / Math.min(320,window.innerHeight*0.36)));
    scene.setAim(side,lift,gesture.power);
    $('#charge-text').textContent = 'パワー決定！'; $('#gesture-hint').textContent = '指を離して、飛ばそう';
    $('#aim-line').style.height=`${Math.min(200,Math.hypot(dx,dy))}px`;$('#aim-line').style.transform=`rotate(${Math.atan2(dx,dy)*180/Math.PI}deg)`;
  }
}
function cancelGesture() {gesture=null;$('#gesture').classList.remove('charging','aiming');resetMeter();scene?.setAim(0,.6,0);}
function finishGesture(keyboard = false) {
  if (!gesture) return;
  const value=gesture; const dy=value.startY-value.y; const dx=value.x-value.startX;
  if (!keyboard && dy < 26) {cancelGesture();toast('長押ししたまま、上へスワイプ！');return;}
  const power=value.aiming ? value.power : powerAt(performance.now()-value.start);
  const side=keyboard ? 0 : Math.max(-1,Math.min(1,dx/Math.max(80,dy)*1.2));
  const lift=keyboard ? .6 : Math.max(.05,Math.min(1,dy/Math.min(320,window.innerHeight*.36)));
  gesture=null; $('#gesture').classList.add('hidden'); $('#gesture').classList.remove('charging','aiming');
  flight=launch(chives.find(chive=>chive.id===selected[results.length])!,power,side,lift,wind);
  scene.setFlight(flight); $('#live-distance').classList.remove('hidden'); $('#flight-status').textContent='FLY, NIRA, FLY.';
  tone(420,.1);tone(720,.14,.07);
}
function land() {
  if (!flight) return;
  const chive=chives.find(chive=>chive.id===selected[results.length])!;
  results.push({chive,distance:flight.distance,out:flight.out,power:flight.power,wind:{...wind}});
  $('#landing-label').textContent = flight.out ? 'OUT OF BOUNDS' : flight.distance >= 80 ? 'AMAZING THROW!' : 'NICE THROW!';
  $('#landing-distance').innerHTML = flight.out ? '場外<small>記録なし</small>' : `${flight.distance.toFixed(1)}<small>m</small>`;
  $('#landing').classList.toggle('is-out',flight.out); $('#landing').classList.remove('hidden');
  $('#next').querySelector('span')!.textContent=results.length===1 ? '2投目へ' : '結果を見る';
  $('#flight-status').textContent=flight.out ? '白線の外は、記録なし。' : 'LANDED!';
  if (flight.out) tone(160,.22); else {tone(660,.12);tone(880,.18,.12);}
}
function shareData(): ShareResult {return {throws:results.map(r=>({distance:r.distance,out:r.out,name:r.chive.name})),best:Math.max(0,...results.filter(r=>!r.out).map(r=>r.distance))};}
async function showResult() {
  setPhase('result'); const generation=++resultGeneration;
  $('#card-loading').textContent='記録をカードにしています…';
  $('#card-loading').classList.remove('hidden'); $('#card-preview').classList.add('hidden');
  $<HTMLButtonElement>('#share').disabled=true; $<HTMLButtonElement>('#save').disabled=true;
  try {
    const card = await prepareResultCard(shareData());
    if (generation !== resultGeneration) {URL.revokeObjectURL(card.url);return;}
    if (prepared) URL.revokeObjectURL(prepared.url);prepared=card;
    $<HTMLImageElement>('#card-preview').src=card.url;
    $('#card-preview').classList.remove('hidden');$('#card-loading').classList.add('hidden');
    $<HTMLButtonElement>('#share').disabled=false;$<HTMLButtonElement>('#save').disabled=false;
  } catch {
    if (generation !== resultGeneration || phase !== 'result') return;
    const best=shareData().best;
    const hasRecord=results.some(result=>!result.out);
    $('#card-loading').innerHTML=`<strong>${hasRecord?`${best.toFixed(1)} m`:'記録なし'}</strong><p>画像を作れませんでした</p><button id="retry-card">もう一度作る</button>`;
    $('#retry-card').addEventListener('click',()=>void showResult());
  }
}
function replay() {
  resultGeneration++; if(prepared) URL.revokeObjectURL(prepared.url);prepared=null;
  results=[];selected=[];flight=null;chives=createChives();scene.setFlight(null);scene.setChives(chives);populatePicks();updatePicks();setPhase('select');
}

try {scene=new GameScene($('#scene'), selectChive);scene.setChives(chives);scene.setMode('select');}
catch (error) {console.error(error);$('#gpu-error').classList.remove('hidden');}
populatePicks();updatePicks();
$('#start').addEventListener('click',()=>{if(selected.length!==2)return;setPhase('throw');startThrow();});
for(let index=0;index<2;index++) $(`#slot-${index}`).addEventListener('click',()=>{if(selected[index])selectChive(selected[index]);});
$('#next').addEventListener('click',()=>{if(results.length===1)startThrow();else if(results.length===2)void showResult();});
$('#again').addEventListener('click',replay);
$('#sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('#sound').innerHTML=soundEnabled?icons.sound:icons.muted;$('#sound').setAttribute('aria-label',soundEnabled?'音をオフにする':'音をオンにする');$('#sound').setAttribute('aria-pressed',String(soundEnabled));tone(580,.1);});
const help=$<HTMLDialogElement>('#help-dialog');
$('#help').addEventListener('click',()=>{cancelGesture();help.showModal();});
$('.dialog-close').addEventListener('click',()=>help.close());$('.dialog-done').addEventListener('click',()=>help.close());
help.addEventListener('click',e=>{if(e.target===help){const r=help.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)help.close();}});
$('#share').addEventListener('click',async()=>{if(!prepared)return;const button=$<HTMLButtonElement>('#share');button.disabled=true;try{const status=await shareResultCard(prepared);if(status==='downloaded')toast('結果画像を保存しました');}finally{button.disabled=false;}});
$('#save').addEventListener('click',()=>{if(prepared){downloadResultCard(prepared);toast('結果画像を保存しました');}});

const gestureEl=$('#gesture');
gestureEl.addEventListener('pointerdown',e=>{if(e.button!==0||gesture)return;beginGesture(e.pointerId,e.clientX,e.clientY);if(gesture){gestureEl.setPointerCapture(e.pointerId);e.preventDefault();}});
gestureEl.addEventListener('pointermove',e=>{if(gesture?.id===e.pointerId)moveGesture(e.clientX,e.clientY);});
gestureEl.addEventListener('pointerup',e=>{if(gesture?.id===e.pointerId){moveGesture(e.clientX,e.clientY);finishGesture();}});
gestureEl.addEventListener('pointercancel',e=>{if(gesture?.id===e.pointerId)cancelGesture();});
gestureEl.addEventListener('lostpointercapture',e=>{if(gesture?.id===e.pointerId&&!gesture.keyboard)cancelGesture();});
gestureEl.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('keydown',e=>{if(e.code==='Space'&&phase==='throw'&&!help.open&&!['BUTTON','A','TEXTAREA'].includes((e.target as HTMLElement).tagName)){e.preventDefault();if(!e.repeat)beginGesture(-1,0,0,true);}});
window.addEventListener('keyup',e=>{if(e.code==='Space'&&gesture?.keyboard){e.preventDefault();finishGesture(true);}});
window.addEventListener('blur',()=>cancelGesture());
document.addEventListener('visibilitychange',()=>{lastTimestamp=0;accumulator=0;if(document.hidden)cancelGesture();});
$('#scene').addEventListener('gamecontextlost',()=>{cancelGesture();toast('3D画面を復旧しています…');});
$('#scene').addEventListener('gamecontextrestored',()=>{lastTimestamp=0;accumulator=0;toast('3D画面を復旧しました');});
window.addEventListener('resize',()=>{cancelGesture();scene?.resize();});

function animate(timestamp:number) {
  requestAnimationFrame(animate);
  if(!scene||document.hidden)return;
  const dt=lastTimestamp?Math.min((timestamp-lastTimestamp)/1000,.1):0;lastTimestamp=timestamp;
  if(gesture&&!gesture.aiming){gesture.power=powerAt(timestamp-gesture.start);const percent=Math.round(gesture.power*100);$('#power-fill').style.width=`${percent}%`;$('#power-marker').style.left=`${percent}%`;$('#power-value').innerHTML=`${percent}<small>%</small>`;$('#charge-text').textContent=percent>92?'いま！上へスワイプ':'タイミングを合わせて…';}
  if(flight&&!flight.landed){accumulator+=dt;while(accumulator>=STEP&&!flight.landed){stepFlight(flight,wind,STEP);accumulator-=STEP;}
    $('#live-distance strong').textContent=flight.distance.toFixed(1);if(flight.out)$('#flight-status').textContent='場外！';if(flight.landed)land();}
  scene.update(dt,timestamp/1000);
}
requestAnimationFrame(animate);
