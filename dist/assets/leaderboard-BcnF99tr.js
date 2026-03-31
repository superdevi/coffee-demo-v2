import{t as e}from"./i18n-CYArclXf.js";function t(){return localStorage.getItem(`coffee_nickname`)||``}function n(e){localStorage.setItem(`coffee_nickname`,e.trim())}function r(){return localStorage.getItem(`coffee_company`)||``}function i(e){localStorage.setItem(`coffee_company`,e.trim())}var a=`/api/leaderboard`;async function o(e){try{let t=await fetch(a,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify(e)});return t.ok?await t.json():null}catch{return console.warn(`Leaderboard submit failed — offline?`),null}}async function s(e,t=10){try{let n=await fetch(`${a}/${e}?limit=${t}`);return n.ok&&(await n.json()).scores||[]}catch{return console.warn(`Leaderboard fetch failed — offline?`),[]}}async function c(e,t){try{return(await fetch(`${a}/${e}?id=${t}`,{method:`DELETE`})).ok}catch{return!1}}function l(t,n,r={}){let i=e()===`zh`?{title:`排行榜`,empty:`暂无记录`,del:`删除`,cancel:`取消`,confirmMsg:`删除这条记录？`}:{title:`Leaderboard`,empty:`No scores yet`,del:`Delete`,cancel:`Cancel`,confirmMsg:`Delete this score?`};if(!n.length){t.innerHTML=`
      <div class="leaderboard">
        <div class="leaderboard-title">${i.title}</div>
        <p style="text-align:center;color:var(--text-secondary);font-size:0.85rem;padding:var(--space-lg)">
          ${i.empty}
        </p>
      </div>`;return}let a=n.map((e,t)=>{let n=r.currentNickname&&e.nickname===r.currentNickname&&Math.abs(e.score-r.currentScore)<.001,i=t<3?`top-3`:``,a=t<3?[`🥇`,`🥈`,`🥉`][t]:`${t+1}`;return`
      <div class="leaderboard-row ${n?`highlight`:``}" data-id="${e.id}">
        <span class="leaderboard-rank ${i}">${a}</span>
        <span class="leaderboard-name">${f(e.nickname)}</span>
        <span class="leaderboard-score">${d(e.score,r.lowerIsBetter)}</span>
      </div>`}).join(``);t.innerHTML=`
    <div class="leaderboard">
      <div class="leaderboard-title">${i.title}</div>
      ${a}
    </div>`;let o=null;t.querySelectorAll(`.leaderboard-row`).forEach(e=>{let n=n=>{o=setTimeout(()=>{o=null;let n=e.dataset.id,a=e.querySelector(`.leaderboard-name`).textContent;u(t,i,a,()=>{c(r.game,n).then(t=>{t&&e.remove()})})},600)},a=()=>{o&&=(clearTimeout(o),null)};e.addEventListener(`pointerdown`,n),e.addEventListener(`pointerup`,a),e.addEventListener(`pointerleave`,a),e.addEventListener(`contextmenu`,e=>e.preventDefault())})}function u(e,t,n,r){let i=document.querySelector(`.lb-modal-overlay`);i&&i.remove();let a=document.createElement(`div`);a.className=`lb-modal-overlay`,a.innerHTML=`
    <div class="lb-modal">
      <div class="lb-modal-name">${f(n)}</div>
      <div class="lb-modal-msg">${t.confirmMsg}</div>
      <div class="lb-modal-actions">
        <button class="btn lb-modal-cancel">${t.cancel}</button>
        <button class="btn btn-danger lb-modal-delete">${t.del}</button>
      </div>
    </div>`,a.querySelector(`.lb-modal-cancel`).addEventListener(`click`,()=>a.remove()),a.addEventListener(`click`,e=>{e.target===a&&a.remove()}),a.querySelector(`.lb-modal-delete`).addEventListener(`click`,()=>{r(),a.remove()}),document.body.appendChild(a)}function d(e,t){return t?`±${e.toFixed(2)}s`:`${Math.round(e)}`}function f(e){let t=document.createElement(`div`);return t.textContent=e,t.innerHTML}export{t as a,r as i,l as n,i as o,o as r,n as s,s as t};