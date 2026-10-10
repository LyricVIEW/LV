const $=id=>document.getElementById(id),redirect=location.origin+location.pathname;
$('redirect').textContent=redirect;
const demoLines=[{t:0,text:'The city lights are fading'},{t:12,text:'But we are wide awake'},{t:26,text:'Chasing colors in the midnight'},{t:42,text:'Every moment feels like magic'},{t:60,text:'Let the whole world disappear'},{t:80,text:'We are right where we belong'},{t:110,text:'Underneath the velvet sky'},{t:145,text:'And the music carries on'}];
let synced=true;
let browserPlayer=null,browserDevice='',grantedScopes='',sdkPromise=null,browserStarting=false;
let pendingSeek=null,lastBrowserSeek=0,lastAutoRestartedTrack=null;
let lines=demoLines,trackId='demo',position=0,duration=192,playing=true,lastTick=performance.now(),access='',refresh='',expires=0,fetching=false,art='',customImage='',demo=true;
const settings=['client','background','accent','bgcolor','blur','font','size','align','opacity','glow','artwork','progressToggle','offset','lineDelay','glide','volume','beginning'];
for(const id of settings){const el=$(id);const saved=localStorage.getItem('lv_'+id);if(saved!==null){if(el.type==='checkbox')el.checked=saved==='true';else el.value=saved}el.addEventListener('input',()=>{localStorage.setItem('lv_'+id,el.type==='checkbox'?el.checked:el.value);apply()})}
function apply(){const p=$('capture'),b=p.querySelector('.backdrop');p.style.setProperty('--blur',$('blur').value+'px');p.style.setProperty('--lyric-size',$('size').value+'px');p.style.setProperty('--inactive',Number($('opacity').value)/100);p.style.setProperty('--glow-enabled',$('glow').checked?'1':'0');$('blurValue').textContent=$('blur').value;$('sizeValue').textContent=$('size').value;$('offsetValue').textContent=Number($('offset').value).toFixed(1);$('lineDelayValue').textContent=Number($('lineDelay').value).toFixed(2);$('glideValue').textContent=Number($('glide').value).toFixed(1);$('volumeValue').textContent=$('volume').value+'%';if(browserPlayer)browserPlayer.setVolume(Number($('volume').value)/100).catch(()=>{});$('lyrics').classList.remove('left','center','right','alternate');$('lyrics').classList.add($('align').value);$('lyrics').classList.toggle('has-sync',synced);$('lyrics').style.fontFamily=$('font').value==='serif'?'Georgia,serif':$('font').value==='mono'?'ui-monospace,monospace':'inherit';$('cover').style.display=$('artwork').checked?'block':'none';$('progressWrap').style.display=$('progressToggle').checked?'block':'none';requestAnimationFrame(()=>highlight(true));const mode=$('background').value;const gradient=`radial-gradient(circle at 25% 18%,${$('accent').value},transparent 55%),radial-gradient(circle at 85% 90%,#464185,${$('bgcolor').value} 75%)`;b.style.background=mode==='solid'?$('bgcolor').value:mode==='gradient'?gradient:mode==='image'&&customImage?`url("${customImage}") center/cover`:mode==='art'&&art?`url("${art}") center/cover`:gradient}
$('upload').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{customImage=r.result;$('background').value='image';apply()};r.readAsDataURL(f)};
for(const btn of document.querySelectorAll('[data-preset]'))btn.onclick=()=>{const presets={rose:['#e97b9e','#28182b','art'],ocean:['#4b9cfa','#10243d','gradient'],mono:['#eeeeee','#171717','solid'],gold:['#f5bb6d','#30201a','gradient']};const [a,b,c]=presets[btn.dataset.preset];$('accent').value=a;$('bgcolor').value=b;$('background').value=c;apply()};
// Keep a monotonic local clock and gently correct minor Spotify polling jitter.
// Large differences (an actual seek/skip) are applied immediately.
let activeIndex=-1;
let clockCorrection=0;
function reconcilePosition(observed, isPlaying, {immediate=false}={}){
  const target=Math.max(0,Math.min(duration,observed));
  const error=target-position;
  if(immediate||Math.abs(error)>1.2){
    position=target;
    clockCorrection=0;
    highlight(true);
  }else{
    // Nudge towards the observed position over multiple frames. Prevents 5-second
    // polling and SDK callback jitter from prematurely triggering a lyric switch.
    clockCorrection=Math.max(-.6,Math.min(.6,error));
  }
  playing=!!isPlaying;
}

function render(){
  const viewport=$('lyrics'), track=$('lyricsTrack');
  track.replaceChildren();
  viewport.classList.toggle('has-sync',synced);
  if(!lines.length){
    const div=document.createElement('div');div.className='line active';
    div.textContent='No lyrics available for this track';track.append(div);
  } else {
    lines.forEach((l,i)=>{const div=document.createElement('div');div.className='line';
      div.textContent=l.text;div.dataset.index=i;track.append(div)});
  }
  activeIndex=-1;
  litIndices.clear();
  highlight(true);
}
// Smooth follow v5: the track begins traveling *before* the next timestamp,
// then arrives exactly when that next line is due. Highlighting NEVER advances early.
// We derive the translation from playback time on every frame (not from CSS
// transitions), so pause/seek/Spotify clock corrections cannot queue animations.
const clamp01=n=>Math.min(1,Math.max(0,n));
const smoothStep=n=>{const x=clamp01(n);return x*x*(3-2*x)};
// Visual emphasis is a function of the *same eased glide progress* as the
// scrolling track. These per-line CSS properties survive font/opacity changes.
// Only the currently blended two lines are updated each frame for performance.
const litIndices=new Set();
function setLineFocus(index, amount){
  const line=$('lyricsTrack').children[index];
  if(!line)return;
  const focus=clamp01(amount);
  const inactive=Number($('opacity').value)/100;
  line.style.setProperty('--line-focus',focus.toFixed(4));
  line.style.setProperty('--line-opacity',(inactive+(1-inactive)*focus).toFixed(4));
  const glow=$('glow').checked?focus:0;
  line.style.setProperty('--line-glow',glow.toFixed(4));
  line.style.setProperty('--glow-core',(glow*.83).toFixed(4));
  line.style.setProperty('--glow-middle',(glow*.59).toFixed(4));
  line.style.setProperty('--glow-outer',(glow*.32).toFixed(4));
  line.style.setProperty('--line-scale',(.985+focus*.03).toFixed(4));
}
function blendLineGlow(current,next,progress){
  const wanted=new Set();
  if(current>=0 && current<lines.length){
    wanted.add(current);
    setLineFocus(current,next<lines.length?1-progress:1);
  }
  if(next>=0 && next<lines.length){
    wanted.add(next);
    setLineFocus(next,progress);
  }
  for(const stale of litIndices){if(!wanted.has(stale))setLineFocus(stale,0)}
  litIndices.clear();
  for(const index of wanted)litIndices.add(index);
}
function lyricTime(){
  return Math.max(0,position+Number($('offset').value||0)-Number($('lineDelay').value||0));
}
function lyricIndexAt(time){
  let lo=0,hi=lines.length-1,index=-1;
  while(lo<=hi){const mid=(lo+hi)>>1;if(lines[mid].t<=time){index=mid;lo=mid+1}else hi=mid-1}
  return index;
}
function anchorFor(index){
  const viewport=$('lyrics'),el=$('lyricsTrack').children[index];
  if(!el)return 0;
  // This retains the top-first layout of earlier versions.
  // Keep the focused text in the clear center of the new wide edge fade.
  // The first line must not start in the transparent part of the mask.
  const anchor=viewport.clientHeight*(index===0?.405:index===1?.425:.445);
  return anchor-el.offsetTop;
}
function followLyrics(){
  if(!synced || !lines.length)return;
  const t=lyricTime(), i=lyricIndexAt(t);
  const current=Math.max(0,i), next=current+1;
  let y=anchorFor(current);
  let glideProgress=0;
  if(i>=0 && next<lines.length){
    // Never stretch the glide beyond the actual interval. A 2-second pair of
    // lines gets a <=2-second move; a long pause gets a gentle capped glide.
    const gap=Math.max(.001,lines[next].t-lines[current].t);
    const desired=Number($('glide').value)||3.4;
    const window=Math.min(gap,desired);
    const begin=lines[next].t-window;
    glideProgress=smoothStep((t-begin)/window);
    y+=(anchorFor(next)-y)*glideProgress;
  }
  // The glow and opacity crossfade exactly as far as the position has glided.
  // At the timestamp, the next line is at full strength without a flash.
  blendLineGlow(current,next,glideProgress);
  // No transition on the moving track: this position is a continuous function
  // of song time, so the boundary between two lines cannot cause a jump.
  $('lyricsTrack').style.transform=`translate3d(0,${y.toFixed(2)}px,0)`;
}
function highlight(force=false){
  const track=$('lyricsTrack');
  if(!lines.length){
    track.style.transform='translate3d(0,18px,0)';
    return;
  }
  if(!synced){
    [...track.children].forEach(el=>el.classList.remove('active','past','upcoming'));
    track.style.transform='translate3d(0,18px,0)';
    activeIndex=-1;return;
  }
  const index=lyricIndexAt(lyricTime());
  if(force||index!==activeIndex){
    activeIndex=index;
    [...track.children].forEach((el,j)=>{
      el.classList.toggle('active',j===index);
      el.classList.toggle('past',j<index);
      el.classList.toggle('upcoming',j>index);
    });
  }
  followLyrics();
}
const viewportObserver=new ResizeObserver(()=>highlight(true));
viewportObserver.observe($('lyrics'));
function fmt(s){s=Math.max(0,Math.floor(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function frame(now){
  const dt=Math.min(Math.max(0,(now-lastTick)/1000),1);lastTick=now;
  if(playing)position=Math.min(duration,position+dt);
  if(clockCorrection){
    const adjust=Math.sign(clockCorrection)*Math.min(Math.abs(clockCorrection),dt*.12);
    position=Math.max(0,Math.min(duration,position+adjust));
    clockCorrection-=adjust;
    if(Math.abs(clockCorrection)<.004)clockCorrection=0;
  }
  $('elapsed').textContent=fmt(position);$('duration').textContent=fmt(duration);
  $('barFill').style.width=(duration?position/duration*100:0)+'%';
  $('seekBar').setAttribute('aria-valuemax',Math.ceil(duration));
  $('seekBar').setAttribute('aria-valuenow',Math.floor(position));
  $('togglePlay').textContent=playing?'⏸ Pause':'▶ Play';
  highlight();requestAnimationFrame(frame);
}
function setDemo(){clockCorrection=0;demo=true;synced=true;lastAutoRestartedTrack=null;trackId='demo';lines=demoLines;position=0;duration=192;playing=true;art='';$('song').textContent='Midnight Echoes';$('artist').textContent='LyricView Demo';$('cover').removeAttribute('src');$('live').textContent='DEMO PREVIEW';$('audioStatus').textContent='Demo mode has no copyrighted song audio. Connect Spotify Premium for real music sound.';$('lyricState').textContent='Sample lyrics';$('status').textContent='Demo mode · Connect to sync your music.';activeIndex=-1;render();apply()}
$('demo').onclick=setDemo;
const base64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function connect(){const id=$('client').value.trim();if(!id){alert('Enter your Spotify Client ID first. See README.md.');return}const verifier=base64url(crypto.getRandomValues(new Uint8Array(64)));const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));const state=base64url(crypto.getRandomValues(new Uint8Array(16)));sessionStorage.setItem('lv_verifier',verifier);sessionStorage.setItem('lv_state',state);const u=new URL('https://accounts.spotify.com/authorize');u.search=new URLSearchParams({client_id:id,response_type:'code',redirect_uri:redirect,scope:'user-read-currently-playing user-read-playback-state user-modify-playback-state streaming user-read-email user-read-private',code_challenge_method:'S256',code_challenge:base64url(new Uint8Array(digest)),state});location.href=u}
$('connect').onclick=()=>access?disconnect():connect();
function disconnect(){if(browserPlayer){browserPlayer.disconnect();browserPlayer=null;browserDevice='';}access='';refresh='';grantedScopes='';sessionStorage.removeItem('lv_tokens');$('connect').textContent='Connect Spotify';$('browserAudio').textContent='🔊 Listen in this browser';setDemo()}
async function tokenRequest(params){const res=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});if(!res.ok)throw Error('Spotify authorization failed ('+res.status+'). Check your Client ID and redirect URI.');return res.json()}
function storeTokens(t){access=t.access_token;refresh=t.refresh_token||refresh;grantedScopes=t.scope||grantedScopes;expires=Date.now()+t.expires_in*1000-60000;sessionStorage.setItem('lv_tokens',JSON.stringify({access,refresh,expires,grantedScopes}));$('connect').textContent='Disconnect Spotify';$('status').textContent='Spotify connected · Checking playback…'}
async function ensureToken(){if(Date.now()<expires)return;if(!refresh)throw Error('Session expired. Connect again.');storeTokens(await tokenRequest({client_id:$('client').value,grant_type:'refresh_token',refresh_token:refresh}))}
// LRCLIB provides timestamped LRC lines when available; Spotify itself does not provide lyrics.
function parseLrc(lrc){
  const parsed=[];
  for(const row of lrc.split(/\r?\n/)){
    const timeTags=[...row.matchAll(/\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]/g)];
    const text=row.replace(/^(?:\[\d{1,3}:\d{2}(?:\.\d{1,3})?\])+\s*/, '').trim();
    if(!timeTags.length || !text)continue;
    for(const tag of timeTags)parsed.push({t:Number(tag[1])*60+Number(tag[2]),text});
  }
  return parsed.sort((a,b)=>a.t-b.t);
}
const lyricHeaders={'Lrclib-Client':'LyricView Studio/1.1 (static browser lyrics visualizer)'};
let lyricCooldownUntil=0;
async function lyricFetch(path,params){
  if(Date.now()<lyricCooldownUntil)throw Error('Lyrics service rate-limited; try again later');
  const res=await fetch('https://lrclib.net'+path+'?'+new URLSearchParams(params),{headers:lyricHeaders});
  if(res.status===429){
    const retry=Number(res.headers.get('Retry-After'))||60;
    lyricCooldownUntil=Date.now()+Math.max(10,retry)*1000;
    throw Error('Lyrics service rate-limited; try again later');
  }
  if(res.status===404)return null;
  if(!res.ok)throw Error('Lyrics service unavailable ('+res.status+')');
  return res.json();
}
function normalized(s){return (s||'').toLowerCase().replace(/\s*\((?:feat|ft)\.?[^)]*\)/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
function pickSearchResult(results,t){
  const title=normalized(t.name), artist=normalized(t.artists[0].name),seconds=t.duration_ms/1000;
  const matches=results.filter(r=>{
    const rt=normalized(r.trackName||r.name),ra=normalized(r.artistName);
    const titleOK=rt===title||rt.startsWith(title+' ')||title.startsWith(rt+' ');
    const artistOK=ra.includes(artist)||artist.includes(ra);
    return titleOK&&artistOK&&Math.abs(Number(r.duration)-seconds)<12;
  });
  return matches.sort((a,b)=>Number(Boolean(b.syncedLyrics))-Number(Boolean(a.syncedLyrics))||Math.abs(Number(a.duration)-seconds)-Math.abs(Number(b.duration)-seconds))[0]||null;
}
async function loadLyrics(t){
  const id=t.id,who=t.artists[0].name;
  $('lyricState').textContent='Searching synchronized lyrics…';
  try{
    const base={track_name:t.name,artist_name:who};
    let found=await lyricFetch('/api/get',{...base,album_name:t.album.name,duration:Math.round(t.duration_ms/1000)});
    if(id!==trackId)return;
    if(!found?.syncedLyrics){
      // Don't discard a plain lyric match unless we find a timestamped one.
      await new Promise(resolve=>setTimeout(resolve,250));
      const next=await lyricFetch('/api/get',base);
      if(id!==trackId)return;
      found=next?.syncedLyrics?next:found||next;
    }
    if(!found?.syncedLyrics){
      await new Promise(resolve=>setTimeout(resolve,250));
      const matches=await lyricFetch('/api/search',base);
      if(id!==trackId)return;
      const next=pickSearchResult(Array.isArray(matches)?matches:[],t);
      found=next?.syncedLyrics?next:found||next;
    }
    if(id!==trackId)return;
    const parsed=found?.syncedLyrics?parseLrc(found.syncedLyrics):[];
    if(parsed.length){
      lines=parsed;synced=true;
      $('lyricState').textContent='● LIVE • Time-synced lyrics';
    }else if(found?.plainLyrics){
      lines=found.plainLyrics.split(/\r?\n/).filter(x=>x.trim()).map(text=>({text}));
      synced=false;
      $('lyricState').textContent='Lyrics found • No timestamps available';
    }else{
      lines=[];synced=false;
      $('lyricState').textContent='No timed lyrics found for this track';
    }
    render();
  }catch(e){
    if(id!==trackId)return;
    synced=false;lines=[];
    $('lyricState').textContent=e.message||'Lyrics unavailable';
    render();
  }
}
async function poll(){
  if(!access||fetching)return;
  fetching=true;
  try{
    await ensureToken();
    const requestedAt=performance.now();
    const res=await fetch('https://api.spotify.com/v1/me/player/currently-playing',{headers:{Authorization:'Bearer '+access}});
    if(res.status===204){$('status').textContent='Connected · Play a song on Spotify';playing=false;clockCorrection=0;return}
    if(res.status===429){$('status').textContent='Rate limited · Waiting before retry';return}
    if(!res.ok)throw Error('Spotify returned '+res.status);
    const data=await res.json();
    if(!data.item||data.item.type!=='track'){playing=false;return}
    const t=data.item,changed=trackId!==t.id;
    demo=false;
    duration=t.duration_ms/1000;
    // Spotify progress_ms is an observation, not a clock to hard-reset every poll.
    // RTT midpoint is only a small network-lag estimate; don't add the API's
    // timestamp age, which could be old and make lines jump forward too early.
    const rtt=Math.max(0,performance.now()-requestedAt);
    const latency=data.is_playing?Math.min(.3,rtt/2000):0;
    const spotifyPosition=(data.progress_ms||0)/1000+latency;
    // Ignore delayed snapshots immediately after a local seek/restart.
    const recentlySought=Date.now()-lastBrowserSeek<1900;
    if(changed||!recentlySought){
      reconcilePosition(spotifyPosition,!!data.is_playing,{immediate:changed});
    }else{
      playing=!!data.is_playing;
    }
    if(changed){
      trackId=t.id;
      art=t.album.images?.[0]?.url||'';
      $('cover').src=art;
      $('song').textContent=t.name;
      $('artist').textContent=t.artists.map(a=>a.name).join(', ');
      $('live').textContent='SPOTIFY CONNECTED';
      lines=[];synced=false;render();apply();loadLyrics(t);
    }
    $('status').textContent=playing?'Spotify connected · Playing':'Spotify connected · Paused';
    if(changed&&playing&&$('beginning').checked&&lastAutoRestartedTrack!==t.id){
      lastAutoRestartedTrack=t.id;
      const prior=position;
      position=0;clockCorrection=0;lastBrowserSeek=Date.now();highlight(true);
      $('status').textContent='Starting song from 0:00 · Lyrics following…';
      try{
        await spotifyApi('/me/player/seek?position_ms=0');
        setTimeout(()=>{if(access)poll()},1250);
      }catch(seekError){
        position=prior;lastBrowserSeek=0;highlight(true);
        audioMessage('Auto-restart unavailable: '+seekError.message+' — Use Restart or play from the beginning in Spotify.');
      }
    }
  }catch(e){$('status').textContent=e.message}
  finally{fetching=false}
}
async function initialize(){const q=new URLSearchParams(location.search);if(q.has('error')){$('status').textContent='Spotify permission denied';history.replaceState({},'',redirect)}if(q.has('code')){try{if(q.get('state')!==sessionStorage.getItem('lv_state'))throw Error('Login security check failed');const t=await tokenRequest({client_id:$('client').value,grant_type:'authorization_code',code:q.get('code'),redirect_uri:redirect,code_verifier:sessionStorage.getItem('lv_verifier')});storeTokens(t)}catch(e){$('status').textContent=e.message}finally{sessionStorage.removeItem('lv_verifier');sessionStorage.removeItem('lv_state');history.replaceState({},'',redirect)}}else{try{const t=JSON.parse(sessionStorage.getItem('lv_tokens'));if(t){access=t.access;refresh=t.refresh;expires=t.expires;grantedScopes=t.grantedScopes||'';$('connect').textContent='Disconnect Spotify'}}catch{}}if(access)poll()}

// Playback controls: Spotify audio is provided only by Spotify's official Web Playback SDK.
// Nothing here downloads, copies, or synthesizes the copyrighted music.
function audioMessage(message){$('audioStatus').textContent=message;}
function audioErrorMessage(error){
  const status=error?.message||String(error);
  audioMessage(status.includes('403')?'Spotify refused playback. Premium and the app playback permissions are required.':status);
}
async function spotifyApi(path,method='PUT',body){
  await ensureToken();
  const response=await fetch('https://api.spotify.com/v1'+path,{
    method,headers:{Authorization:'Bearer '+access,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  if(!response.ok){let msg='Spotify playback error ('+response.status+')';if(response.status===403)msg+=': Premium or permission required';throw Error(msg);}
  return response;
}
function loadSpotifySdk(){
  if(window.Spotify?.Player)return Promise.resolve();
  if(sdkPromise)return sdkPromise;
  sdkPromise=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('Spotify player loading timed out. Check network or browser restrictions.')),15000);
    const previous=window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady=()=>{clearTimeout(timeout);previous?.();resolve();};
    const script=document.createElement('script');script.src='https://sdk.scdn.co/spotify-player.js';
    script.async=true;script.onerror=()=>{clearTimeout(timeout);reject(Error('Cannot load the Spotify audio player SDK.'))};
    document.head.appendChild(script);
  }).catch(e=>{sdkPromise=null;throw e});
  return sdkPromise;
}
async function startBrowserAudio(){
  if(!access){audioMessage('Connect Spotify first, then use Listen in this browser.');return;}
  if(!grantedScopes.includes('streaming')){
    audioMessage('Reconnect Spotify to grant new audio permissions: click Disconnect Spotify, then Connect Spotify.');
    return;
  }
  if(browserStarting)return;
  browserStarting=true;
  $('browserAudio').disabled=true;
  audioMessage('Loading Spotify player…');
  try{
    await loadSpotifySdk();
    if(!access)throw Error('Connect Spotify again.');
    if(!browserPlayer){
      browserPlayer=new Spotify.Player({name:'LyricView Studio',getOAuthToken:async cb=>{
        try{await ensureToken();cb(access);}catch(e){audioErrorMessage(e);}
      },volume:Number($('volume').value)/100});
      browserPlayer.addListener('ready',({device_id})=>{browserDevice=device_id;audioMessage('Browser player ready. Transferring playback…');});
      browserPlayer.addListener('not_ready',()=>{browserDevice='';audioMessage('Browser player disconnected; reconnect to listen here.');});
      browserPlayer.addListener('initialization_error',audioErrorMessage);
      browserPlayer.addListener('authentication_error',audioErrorMessage);
      browserPlayer.addListener('account_error',()=>audioMessage('Spotify Premium is required for audio playback in this browser.'));
      browserPlayer.addListener('playback_error',audioErrorMessage);
      browserPlayer.addListener('autoplay_failed',()=>audioMessage('Browser blocked autoplay. Click Play to enable sound.'));
      browserPlayer.addListener('player_state_changed',state=>{
        if(!state||!browserDevice)return;
        const uri=state.track_window?.current_track?.uri;
        // UI timing can stay responsive between API polls. Never mismatch a different track.
        if(uri&&trackId!=='demo'&&uri.endsWith(trackId)){
          duration=state.duration/1000||duration;
          if(Date.now()-lastBrowserSeek>1600){
            reconcilePosition(state.position/1000,!state.paused);
          }else{playing=!state.paused;}
          highlight();
        }
      });
    }
    // IMPORTANT: activateElement is from a click path in browsers with autoplay protection.
    try{await browserPlayer.activateElement();}catch{}
    const connected=await browserPlayer.connect();
    if(!connected)throw Error('Spotify could not create a browser playback device.');
    let tries=0;
    while(!browserDevice&&tries++<30)await new Promise(r=>setTimeout(r,100));
    if(!browserDevice)throw Error('Spotify browser player did not become ready.');
    // Spotify Connect may move the current song at its current position into this browser.
    await spotifyApi('/me/player','PUT',{device_ids:[browserDevice],play:playing});
    $('browserAudio').textContent='✓ Audio playing in this browser';
    audioMessage('Spotify sound is coming from this tab. Use the controls below.');
    if($('beginning').checked)await restartSong();
    await poll();
  }catch(e){audioErrorMessage(e);}
  finally{browserStarting=false;$('browserAudio').disabled=false;}
}
$('browserAudio').onclick=startBrowserAudio;
async function restartSong(){
  position=0;clockCorrection=0;lastBrowserSeek=Date.now();highlight(true);
  try{
    if(demo){playing=true;return;}
    if(!access)throw Error('Connect Spotify before restarting music.');
    await spotifyApi('/me/player/seek?position_ms=0');
    lastBrowserSeek=Date.now();
    if(browserPlayer&&browserDevice){await browserPlayer.resume();playing=true;}
    audioMessage('Restarted from 0:00 — lyrics and song position are synchronized.');
    setTimeout(()=>{if(access)poll()},800);
  }catch(e){audioErrorMessage(e);if(access)poll()}
}
$('restart').onclick=restartSong;
$('togglePlay').onclick=async()=>{
  if(demo){playing=!playing;return;}
  try{
    if(!access)throw Error('Connect Spotify first.');
    if(browserPlayer&&browserDevice){await browserPlayer.togglePlay();}
    else await spotifyApi('/me/player/'+(playing?'pause':'play'));
    playing=!playing;await poll();
  }catch(e){audioErrorMessage(e);}
};
async function seekTo(next){
  const previous=position;
  position=Math.min(duration,Math.max(0,next));clockCorrection=0;lastBrowserSeek=Date.now();highlight(true);
  try{
    if(!demo){if(!access)throw Error('Connect Spotify to seek.');
      await spotifyApi('/me/player/seek?position_ms='+Math.round(position*1000));
      lastBrowserSeek=Date.now();setTimeout(()=>{if(access)poll()},800);
    }
  }catch(e){position=previous;lastBrowserSeek=0;highlight(true);audioErrorMessage(e);}
}
$('seekBar').addEventListener('click',e=>{
  const rect=e.currentTarget.getBoundingClientRect();
  seekTo((e.clientX-rect.left)/rect.width*duration);
});
$('seekBar').addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();
  seekTo(e.key==='Home'?0:e.key==='End'?duration:position+(e.key==='ArrowRight'?5:-5));
});

$('full').onclick=()=>{document.body.classList.toggle('full');if(document.body.classList.contains('full'))$('capture').requestFullscreen?.().catch(()=>{});else if(document.fullscreenElement)document.exitFullscreen()};document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)document.body.classList.remove('full')});
$('reset').onclick=()=>{settings.filter(x=>x!=='client').forEach(x=>localStorage.removeItem('lv_'+x));location.reload()};
$('shot').onclick=async()=>{try{const mod=await import('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/+esm');const data=await mod.toPng($('capture'),{pixelRatio:2,cacheBust:true});const a=document.createElement('a');a.href=data;a.download='lyricview.png';a.click()}catch{alert('Screenshot export failed. Some external album covers block browser image export. Try a custom background or a browser screenshot.')}};
apply();setDemo();initialize();requestAnimationFrame(frame);setInterval(()=>{if(access)poll()},5000);
