// Mapa del invernadero: plano SVG con sensores en vivo (usa M, SEN, f, $ de app.js)
var NS='http://www.w3.org/2000/svg',ZONES=[
{id:'Invernadero Norte',x:40,y:30,w:340,h:210,rows:4},
{id:'Invernadero Sur',x:410,y:30,w:200,h:210,rows:3},
{id:'Campo abierto',x:40,y:268,w:570,h:70,field:1}];
// posición de cada sensor en el plano (mismo orden que SEN: ... agua, pH, NPK)
var POS=[[110,95],[540,298],[300,95],[190,190],[510,120],[330,303],[335,205]],msel=0;
function sState(i){var m=SEN[i][3]&&M.filter(function(x){return x.id===SEN[i][3]})[0];return m?m.st:'o'}
function zoneState(z){var w='g';SEN.forEach(function(s,i){if(s[2]!==z)return;var c=sState(i);if(c==='r')w='r';else if(c==='y'&&w==='g')w='y'});return w}
function drawMap(){var el=$('map');if(!el)return;var s='';
ZONES.forEach(function(z){var st=zoneState(z.id);
s+='<rect class="'+(z.field?'field':'zone '+st)+'" x="'+z.x+'" y="'+z.y+'" width="'+z.w+'" height="'+z.h+'" rx="10"/>';
for(var r=0;r<(z.rows||0);r++){s+='<rect class="nft" x="'+(z.x+16)+'" y="'+(z.y+50+r*40)+'" width="'+(z.w-32)+'" height="14" rx="7"/>'}
s+='<text class="zl" x="'+(z.x+14)+'" y="'+(z.y+22)+'">'+z.id+'</text>'});
SEN.forEach(function(q,i){var c=sState(i),m=q[3]&&M.filter(function(x){return x.id===q[3]})[0],p=POS[i];
s+='<g class="mk '+c+(i===msel?' sel':'')+'" data-i="'+i+'" tabindex="0" role="button" aria-label="'+esc(q[0])+': '+(m?f(m,m.v):'sin señal')+'"><circle class="ring" cx="'+p[0]+'" cy="'+p[1]+'" r="11"/><circle class="c" cx="'+p[0]+'" cy="'+p[1]+'" r="11"/><text class="sl" x="'+p[0]+'" y="'+(p[1]+26)+'">'+esc(q[0].split(' (')[0])+(m?' · '+f(m,m.v):'')+'</text></g>'});
el.innerHTML=s;drawDetail()}
function drawDetail(){var q=SEN[msel],c=sState(msel),m=q[3]&&M.filter(function(x){return x.id===q[3]})[0],L={g:'Normal',y:'Aviso',r:'Alerta',o:'Sin señal'};
$('md').innerHTML='<h3>Sensor seleccionado</h3><b>'+esc(q[0])+'</b><div class="big">'+(m?f(m,m.v):'—')+'</div><span class="st '+c+'">'+L[c]+'</span><p>Mide: '+esc(q[1])+'</p><p>Ubicación: '+esc(q[2])+'</p>'+(m&&m.thr!==null?'<p>Umbral: '+m.thr+' '+m.u+'</p>':'')+(m?'':'<p>Revisa batería y conexión del sensor.</p>')}
function pickSensor(e){var g=e.target.closest('.mk');if(!g)return;if(e.type==='keydown'&&e.key!=='Enter'&&e.key!==' ')return;e.preventDefault();msel=+g.dataset.i;drawMap()}
$('map').addEventListener('click',pickSensor);$('map').addEventListener('keydown',pickSensor);
drawMap();
