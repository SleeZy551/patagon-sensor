var $=function(i){return document.getElementById(i)};
var M=[],A=[],TH={},SI={on:false,frost:false},sel='temp',filt='all',CR=[],cid=null,lastA=0,first=true;
var SEN=[['Teros 12','Humedad + temp. + CE suelo','Invernadero Norte','temp'],['Anemómetro','Viento','Torre exterior','vie'],['Sensor PAR (LI-190R)','Radiación fotosintética','Invernadero Norte','par'],['CO₂ invernadero','Concentración de CO₂','Invernadero Norte','co2'],['Ecowitt WN35','Humedad foliar','Invernadero Sur','fol'],['Sensor NPK (DFRobot)','Nitrógeno, fósforo, potasio','Campo abierto',null],['Sensor de nivel','Nivel de agua del estanque','Invernadero Norte','niv']];
var FC=[['Hoy','☀️',3,9,'Despejado','Refrescar invernadero al mediodía.'],['Mañana','☁️',2,7,'Nublado','Verificar acumulación de humedad en hoja.'],['Miércoles','🌬️',2,8,'Viento fuerte (50 km/h)','Revisar estructura y fijar cubiertas.'],['Jueves','❄️',-4,2,'Helada probable','Activar calefacción y revisar sensores desde temprano.']];
var EMO={frutilla:'🍓',lechuga:'🥬',albahaca:'🌿',tomate:'🍅',espinaca:'🥬',otro:'🌱'};
function api(p,o){o=o||{};o.credentials='same-origin';if(o.body&&typeof o.body!=='string'){o.body=JSON.stringify(o.body);o.headers={'Content-Type':'application/json'}}
return fetch('/api/'+p,o).then(function(r){if(r.status===401){$('lg').hidden=false;throw new Error('auth')}if(!r.ok)throw new Error(r.status);return r.json()})}
function fail(e){if(e.message!=='auth')toast('No se pudo completar la acción')}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function toast(t){var e=$('toast');e.textContent=t;e.className='on';clearTimeout(toast.k);toast.k=setTimeout(function(){e.className=''},2600)}
function mm(id){return M.filter(function(x){return x.id===id})[0]}
function f(m,v){if(v==null)return '—';return (m.id==='temp'||m.id==='hum'||m.id==='niv'?v.toFixed(1):Math.round(v))+(m.u==='%'?'%':' '+m.u)}
function p2(x){return('0'+x).slice(-2)}
function fdt(s){var d=new Date(s),n=new Date(),k=Math.round((new Date(n.getFullYear(),n.getMonth(),n.getDate())-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/864e5);return(k===0?'Hoy':k===1?'Ayer':p2(d.getDate())+'/'+p2(d.getMonth()+1))+', '+p2(d.getHours())+':'+p2(d.getMinutes())}
function dm(d){return d.slice(8)+'/'+d.slice(5,7)}
function pend(){return A.filter(function(a){return!a.confirmed_at})}
function alertHTML(a,btn){var d=!!a.confirmed_at;return '<div class="al '+a.level+(d?' done':'')+'"><div class="mk"></div><div class="x">'+esc(a.message)+'<div class="tm">'+fdt(a.created_at)+(d?' · confirmada':'')+'</div></div>'+(btn&&!d?'<button class="btn" data-id="'+a.id+'">Confirmar</button>':'')+'</div>'}
function drawCards(){$('mt').innerHTML=M.map(function(m){return '<button class="m '+m.st+(m.id===sel?' sel':'')+'" data-id="'+m.id+'"><div class="l">'+m.n+'</div><div class="v">'+f(m,m.v)+'</div><div class="s">'+m.src+'</div></button>'}).join('')}
function drawChart(){var m=mm(sel);if(!m||m.h.length<2){$('chart').innerHTML='';return}var h=m.h,mn=Math.min.apply(0,h),mx=Math.max.apply(0,h);if(m.thr!==null){mn=Math.min(mn,m.thr);mx=Math.max(mx,m.thr)}var r=(mx-mn)||1,Y=function(v){return 175-(v-mn)/r*160};var pts=h.map(function(v,i){return (i*600/(h.length-1)).toFixed(0)+','+Y(v).toFixed(0)}).join(' ');
$('ct').textContent=m.n+' — últimas '+h.length+' lecturas';
$('chart').innerHTML=(m.thr!==null?'<line x1="0" x2="600" y1="'+Y(m.thr)+'" y2="'+Y(m.thr)+'" stroke="var(--r)" stroke-width="1.5" stroke-dasharray="5 4"/>':'')+'<polyline fill="none" stroke="var(--green)" stroke-width="2.5" vector-effect="non-scaling-stroke" points="'+pts+'"/><circle cx="600" cy="'+Y(h[h.length-1])+'" r="5" fill="'+(m.st==='r'?'var(--r)':'var(--green)')+'"/>'}
function drawSem(){var w='g',m0=null;M.forEach(function(m){if(m.st==='r'&&w!=='r'){w='r';m0=m}else if(m.st==='y'&&w==='g'){w='y';m0=m}});$('sd').className='dot '+w;$('sb').textContent=!M.length?'Conectando…':w==='g'?'Cultivo en buen estado':w==='y'?'Cultivo con avisos':'Cultivo en riesgo';$('ss').textContent=w==='g'?'Todas las variables dentro de rango. No necesitas hacer nada.':'Qué hacer primero: '+m0.msg+'.'}
function drawTables(){$('tb').innerHTML=SEN.map(function(s){var m=s[3]&&mm(s[3]);var c=m?m.st:'o';return '<tr><td><b>'+s[0]+'</b></td><td>'+s[1]+'</td><td>'+s[2]+'</td><td>'+(m&&m.v!=null?f(m,m.v):'Sin datos')+'</td><td><span class="st '+c+'">'+(c==='r'?'Alerta':c==='y'?'Aviso':c==='g'?'Activo':'Sin señal')+'</span></td></tr>'}).join('');
var p=pend();$('ra').innerHTML=p.length?p.slice(0,3).map(function(a){return alertHTML(a,false)}).join(''):'<span style="color:var(--muted)">Sin alertas pendientes 🎉</span>';
var n=A.filter(function(a){return filt==='all'||!a.confirmed_at});$('la').innerHTML=n.length?n.map(function(a){return alertHTML(a,true)}).join(''):'<span style="color:var(--muted)">Sin alertas pendientes</span>';
$('bd').textContent=p.length;$('bd').setAttribute('data-n',p.length)}
function setLive(on){var e=$('live');e.className='live'+(on?'':' off');e.textContent=!on?'SIN CONEXIÓN':SI.on?'EN VIVO · DATOS SIMULADOS':'EN VIVO'}
function draw(){drawCards();drawChart();drawSem();drawTables();$('frost').hidden=!SI.on;$('frost').textContent=SI.frost?'Volver a normal':'Simular helada';$('frost').className='btn '+(SI.frost?'':'dng');if(window.drawMap)drawMap()}
function fillT(){['temp','hum','vie','niv'].forEach(function(k){$('t-'+k).value=TH[k]})}
function poll(){return api('state').then(function(s){M=s.sensors;A=s.alerts;TH=s.settings;SI=s.sim;
var mx=A.reduce(function(a,x){return Math.max(a,x.id)},0);
if(first){fillT();var o=M.map(function(m){return '<option value="'+m.id+'">'+m.n+' ('+m.u+')</option>'}).join('');$('msel').innerHTML=o;$('hs').innerHTML=o;$('hs').value='niv'}
else A.filter(function(x){return x.id>lastA&&!x.confirmed_at}).slice(0,2).forEach(function(x){toast((x.level==='r'?'🚨 ':'⚠️ ')+x.message)});
lastA=mx;first=false;setLive(true);draw()}).catch(function(e){if(e.message!=='auth')setLive(false)})}
$('mt').addEventListener('click',function(e){var b=e.target.closest('.m');if(b){sel=b.dataset.id;draw()}});
document.addEventListener('click',function(e){var b=e.target.closest('.al button');if(b)api('alerts/'+b.dataset.id,{method:'PATCH'}).then(function(){toast('Alerta confirmada');poll()}).catch(fail)});
document.querySelectorAll('nav button').forEach(function(b){b.onclick=function(){document.querySelectorAll('nav button,.view').forEach(function(x){x.classList.remove('on')});b.classList.add('on');$('v-'+b.dataset.v).classList.add('on');$('ttl').textContent=b.firstChild.textContent.trim();window.scrollTo(0,0);if(b.dataset.v==='historial')loadHist()}});
document.querySelectorAll('.chips .btn').forEach(function(b){b.onclick=function(){filt=b.dataset.f;document.querySelectorAll('.chips .btn').forEach(function(x){x.classList.toggle('on',x===b)});drawTables()}});
$('frost').onclick=function(){api('sim/frost',{method:'POST',body:{on:!SI.frost}}).then(function(){SI.frost=!SI.frost;if(SI.frost)toast('Simulando helada y viento fuerte…');draw()}).catch(fail)};
$('theme').onclick=function(){var r=document.documentElement,d=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;r.dataset.theme=d?'light':'dark';try{localStorage.setItem('ps-theme',r.dataset.theme)}catch(e){}};
try{var th=localStorage.getItem('ps-theme');if(th)document.documentElement.dataset.theme=th}catch(e){}
$('madd').onclick=function(){var v=parseFloat($('mval').value);if(isNaN(v)){toast('Escribe un valor numérico');return}var id=$('msel').value;api('readings',{method:'POST',body:{sensor:id,value:v}}).then(function(){$('mval').value='';toast('Registrado: '+mm(id).n+' '+f(mm(id),v));poll()}).catch(fail)};
$('fc').innerHTML=FC.map(function(d){return '<div class="d'+(d[2]<-2?' r':'')+'"><div class="ic">'+d[1]+'</div><b>'+d[0]+' · '+d[2]+'° / '+d[3]+'°C</b><span style="font-size:13px">'+d[4]+'</span><p>'+d[5]+'</p></div>'}).join('');
// Historial por día
function loadHist(){var s=$('hs').value,d=$('hd').value;if(!s)return;Promise.all([api('daily?sensor='+s+'&days='+d),api('alerts/daily?days='+d)]).then(function(r){var rows=r[0],al={},m=mm(s);r[1].forEach(function(x){(al[x.d]=al[x.d]||{})[x.level]=x.n});
$('ht').textContent=m.n+' — promedio diario ('+m.u+', barra = promedio, línea = mín–máx)';
var top=Math.max.apply(0,rows.map(function(x){return x.max}).concat([1]))*1.1,Y=function(v){return 180-v/top*170},bw=600/Math.max(rows.length,1);
$('hbars').innerHTML=rows.map(function(x,i){var cx=i*bw+bw/2;return '<rect x="'+(i*bw+bw*.2)+'" y="'+Y(x.avg)+'" width="'+bw*.6+'" height="'+(180-Y(x.avg))+'" rx="3" fill="var(--green)" opacity=".85"/><line x1="'+cx+'" x2="'+cx+'" y1="'+Y(x.max)+'" y2="'+Y(x.min)+'" stroke="var(--ink)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>'}).join('');
$('h0').textContent=rows.length?dm(rows[0].d):'';$('h1').textContent=rows.length?dm(rows[rows.length-1].d):'';
var g=function(v){return v.toFixed(1)};
$('htb').innerHTML=rows.slice().reverse().map(function(x){var a=al[x.d]||{};return '<tr><td>'+dm(x.d)+'</td><td><b>'+g(x.avg)+'</b></td><td>'+g(x.min)+'</td><td>'+g(x.max)+'</td><td>'+x.n+'</td><td>'+((a.r?'<span class="st r">'+a.r+' alerta</span> ':'')+(a.y?'<span class="st y">'+a.y+' aviso</span>':'')||'—')+'</td></tr>'}).join('')||'<tr><td colspan="6" style="color:var(--muted)">Aún no hay datos en este período.</td></tr>'}).catch(fail)}
$('hs').onchange=loadHist;$('hd').onchange=loadHist;
// Cultivos
function loadCrops(){return api('crops').then(function(c){CR=c;if(!CR.some(function(x){return x.id===cid}))cid=CR.length?CR[0].id:null;$('cs').innerHTML=CR.map(function(x){return '<option value="'+x.id+'">'+esc(x.name)+'</option>'}).join('');if(cid)$('cs').value=cid;drawFicha()}).catch(fail)}
function drawFicha(){var c=CR.filter(function(x){return x.id==cid})[0];if(!c){$('ficha').innerHTML='<span style="color:var(--muted)">Aún no hay cultivos. Crea uno abajo.</span>';return}
var ms=c.meas,l=ms[ms.length-1],p=ms[ms.length-2],age=Math.max(0,Math.floor((Date.now()-new Date(c.planted))/864e5));
$('ficha').innerHTML='<div style="font-size:34px">'+(EMO[c.type]||'🌱')+'</div><b>'+esc(c.name)+'</b><div style="color:var(--muted);font-size:12px">'+esc(c.system||'')+' · '+esc(c.zone||'')+' · '+age+' días desde siembra</div>'+(l?'<div style="margin:6px 0">Última medida ('+l.d+'): altura <b>'+l.h+' cm</b>, ancho <b>'+l.w+' cm</b>'+(p?' <span style="color:var(--green)">('+(l.h>=p.h?'+':'')+(Math.round((l.h-p.h)*10)/10)+' cm de altura)</span>':'')+'</div>':'<div style="margin:6px 0;color:var(--muted)">Sin medidas aún.</div>')+ms.slice(-5).reverse().map(function(x){return '<div style="color:var(--muted);font-size:12px">'+x.d+' · '+x.h+' × '+x.w+' cm</div>'}).join('')}
$('cs').onchange=function(){cid=+this.value;drawFicha()};
$('hadd').onclick=function(){var h=parseFloat($('hh').value),w=parseFloat($('hw').value);if(!cid||isNaN(h)||isNaN(w)){toast('Elige un cultivo y escribe altura y ancho');return}api('crops/'+cid+'/measurements',{method:'POST',body:{height:h,width:w}}).then(function(){$('hh').value='';$('hw').value='';toast('Medida registrada');loadCrops()}).catch(fail)};
$('carc').onclick=function(){if(cid&&confirm('¿Archivar este cultivo? Sus datos se conservan.'))api('crops/'+cid,{method:'PATCH'}).then(loadCrops).catch(fail)};
$('nadd').onclick=function(){var n=$('nn').value.trim();if(!n){toast('Escribe un nombre');return}api('crops',{method:'POST',body:{name:n,type:$('ntp').value,system:$('nsy').value,zone:$('nzo').value}}).then(function(r){$('nn').value='';cid=r.id;toast('Cultivo creado');loadCrops()}).catch(fail)};
function loadYields(){return api('yields').then(function(Y){var top=Math.max.apply(0,Y.map(function(y){return y.kg}).concat([2]))*1.1,sp=280/Math.max(Y.length,1),bw=Math.min(45,sp*.7);
$('bars').innerHTML=Y.map(function(t,i){var h=t.kg/top*100,x=10+i*sp+(sp-bw)/2;return '<rect x="'+x+'" y="'+(130-h)+'" width="'+bw+'" height="'+h+'" rx="4" fill="var(--green)"/><text x="'+(x+bw/2)+'" y="'+(124-h)+'" text-anchor="middle" font-size="11" fill="var(--ink)">'+t.kg+'</text><text x="'+(x+bw/2)+'" y="148" text-anchor="middle" font-size="10" fill="var(--muted)">'+esc(t.season)+'</text>'}).join('')}).catch(fail)}
$('yadd').onclick=function(){api('yields',{method:'POST',body:{season:$('ys').value,kg:$('yk').value}}).then(function(){$('ys').value='';$('yk').value='';toast('Temporada guardada');loadYields()}).catch(fail)};
// Ajustes
$('tsave').onclick=function(){var b={};['temp','hum','vie','niv'].forEach(function(k){b[k]=$('t-'+k).value});api('settings',{method:'PUT',body:b}).then(function(){toast('Umbrales guardados');poll()}).catch(fail)};
$('treset').onclick=function(){api('settings',{method:'PUT',body:{reset:true}}).then(function(t){TH=t;fillT();toast('Umbrales restaurados');poll()}).catch(fail)};
$('csv').onclick=function(){location.href='/api/export.csv?days='+$('xd').value};
$('out').onclick=function(){api('logout',{method:'POST'}).then(function(){location.reload()})};
$('lgf').onsubmit=function(e){e.preventDefault();api('login',{method:'POST',body:{password:$('lp').value}}).then(function(){$('lg').hidden=true;$('lp').value='';$('lerr').textContent='';boot()}).catch(function(){$('lerr').textContent='Clave incorrecta'})};
function boot(){poll();loadCrops();loadYields();if(!boot.t)boot.t=setInterval(poll,10000)}
if('serviceWorker' in navigator&&location.protocol.indexOf('http')===0)navigator.serviceWorker.register('sw.js').catch(function(){});
boot();
