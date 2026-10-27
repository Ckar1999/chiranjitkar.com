(() => {
  const $=selector=>document.querySelector(selector);
  const params=new URLSearchParams(location.hash.slice(1)); const key=params.get('key')||'';
  let project=null, session=null, countdownHandle=null, refreshHandle=null;
  const money=value=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value)||0);
  const statusNames={lead:'Inquiry',confirmed:'Confirmed',preproduction:'Pre-production',scheduled:'Scheduled',in_session:'In session',editing:'Editing',client_review:'Client review',delivered:'Delivered',archived:'Closed'};
  async function api(path,options={}){
    const response=await fetch(`/api/${path}`,{...options,headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`,...(options.headers||{})}});
    const data=await response.json().catch(()=>({})); if(!response.ok)throw new Error(data.error||'Unable to complete request.'); return data;
  }
  const safeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function init(){
    if(!key){showError('This link is missing its private access key. Ask the studio for a fresh link.');return;}
    try{
      const result=await api('client/project'); project=result.project;session=result.session;
      $('#session-loading').hidden=true;$('#session-content').hidden=false;
      $('#session-project-code').textContent=project.project_code;
      $('#session-title').textContent=`${project.client_name} · ${project.service}`;
      $('#session-description').textContent=project.package_name||'Photography session';
      $('#booked-time').textContent=`${Math.floor(project.booked_minutes/60)}h${project.booked_minutes%60?` ${project.booked_minutes%60}m`:''}`;
      $('#overtime-rate').textContent=`${money(project.overtime_rate)} / 30 min`;
      $('#session-status').textContent=statusNames[project.status]||project.status;$('#session-status').className=`status ${project.status}`;
      renderClientResources(result.invoices||[],result.deliveries||[]);
      $('#client-feedback-form').hidden=false;$('#client-feedback-form').addEventListener('submit',sendFeedback,{once:true});
      if(session?.status==='active'){renderActive();}
      else if(session?.status==='complete'){renderComplete();}
      else if(project.status==='scheduled'){showAction('start');}
      else {$('#client-action-area').hidden=true;$('#policy-copy').textContent=`Your booking is ${statusNames[project.status]||project.status.toLowerCase()}. The session approval action will become available when the studio marks the booking as scheduled.`;}
      refreshHandle=setInterval(refreshSessionState,5000);
    }catch(error){showError(error.message);}
  }
  function showError(message){$('#session-loading').hidden=true;$('#session-error').hidden=false;$('#session-error-text').textContent=message;}
  function renderClientResources(invoices,deliveries){
    const billing=$('#client-billing'),invoiceItems=$('#invoice-items');
    invoiceItems.replaceChildren();billing.hidden=!invoices.length;
    invoices.forEach(invoice=>{
      const item=document.createElement('div');item.className='client-resource';
      const left=document.createElement('div');left.innerHTML=`<strong>${safeText(invoice.description)}</strong><small>${safeText(invoice.invoice_code)} · ${safeText(invoice.status.replaceAll('_',' '))}</small>`;
      const right=document.createElement('div');right.innerHTML=`<strong>${money(invoice.amount)}</strong><small>Paid ${money(invoice.amount_paid)} · Balance ${money(Math.max(0,invoice.amount-invoice.amount_paid))}</small>`;
      item.append(left,right);
      if(invoice.payment_url){try{const url=new URL(invoice.payment_url);if(url.protocol==='https:'){const link=document.createElement('a');link.className='small-button';link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Payment link ↗';item.append(link);}}catch{}}
      invoiceItems.append(item);
    });
    const deliveryArea=$('#client-deliveries'),deliveryList=$('#delivery-items');deliveryList.replaceChildren();deliveryArea.hidden=!deliveries.length;
    deliveries.forEach(delivery=>{const row=document.createElement('div');row.className='client-resource';const text=document.createElement('div');text.innerHTML=`<strong>${safeText(delivery.title)}</strong><small>${safeText(delivery.note||'Shared by the studio')}</small>`;let link;
      try{const url=new URL(delivery.url);if(url.protocol!=='https:')return;link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.className='small-button';link.textContent='Open ↗';}catch{return;}
      row.append(text,link);deliveryList.append(row);
    });
  }
  async function sendFeedback(event){
    event.preventDefault();const form=event.currentTarget;const message=$('#feedback-message');
    try{await api('client/feedback',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});message.textContent='Sent to the studio team. Thank you.';form.reset();form.addEventListener('submit',sendFeedback,{once:true});}
    catch(error){message.textContent=error.message;form.addEventListener('submit',sendFeedback,{once:true});}
  }
  async function refreshSessionState(){
    try{const result=await api('client/project');if(result.session?.status!==session?.status){session=result.session;project=result.project;if(session?.status==='active')renderActive();else if(session?.status==='complete'){clearInterval(countdownHandle);clearInterval(refreshHandle);renderComplete();renderClientResources(result.invoices||[],result.deliveries||[]);}}}
    catch{}
  }
  function showAction(kind){
    $('#client-action-area').hidden=false;$('#client-approve-button').textContent=kind==='start'?'Approve session start':'Approve session finish';
    $('#client-approve-button').onclick=()=>requestApproval(kind);
  }
  async function requestApproval(kind){
    const button=$('#client-approve-button'), message=$('#client-message');button.disabled=true;message.textContent='Generating a one-time code…';
    try{
      const result=await api('client/challenge',{method:'POST',body:JSON.stringify({kind})});
      $('#client-code').textContent=result.code;$('#client-code-area').hidden=false;message.textContent='';$('#client-code-instruction').textContent=kind==='start'?'Give this code to your photographer when you are ready to begin. The timer starts only after they enter it.':'Give this code to your photographer when you are ready to end. The timer stops only after they enter it.';
      button.textContent='Code generated';button.disabled=true;
      const expires=Date.parse(result.expires_at);const interval=setInterval(()=>{if(Date.now()>=expires){clearInterval(interval);$('#client-code-area').hidden=true;button.disabled=false;button.textContent=kind==='start'?'Generate a new start code':'Generate a new finish code';message.textContent='Code expired. Generate another when ready.';}},1000);
    }catch(error){message.textContent=error.message;button.disabled=false;}
  }
  function renderActive(){
    $('#client-timer-area').hidden=false;$('#client-action-area').hidden=true;$('#session-status').textContent='In session';$('#session-status').className='status in_session';
    $('#timer-caption').textContent=`Timer started ${new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short'}).format(new Date(session.started_at))}.`;
    updateTimer();countdownHandle=setInterval(updateTimer,1000);showAction('end');
  }
  function updateTimer(){
    if(!session?.started_at)return;
    const total=Math.floor((Date.now()-Date.parse(session.started_at))/60000), booked=Number(project.booked_minutes), grace=30;
    const format=minutes=>`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}:00`;
    if(total<booked){$('#client-timer').textContent=format(booked-total);$('#timer-caption').textContent='Time remaining in the booked session.';}
    else if(total<booked+grace){$('#client-timer').textContent=format(booked+grace-total);$('#timer-caption').textContent='Booked time is complete. Grace period is running; overtime starts after this reaches zero.';}
    else{const overtime=total-booked-grace, units=Math.ceil(overtime/30);$('#client-timer').textContent=`+${format(overtime)}`;$('#client-timer').classList.add('over');$('#timer-caption').textContent=`Overtime estimate: ${money(units*project.overtime_rate)} (${units} × 30-minute block${units===1?'':'s'}).`}
  }
  function renderComplete(){
    $('#client-timer-area').hidden=true;$('#client-action-area').hidden=true;$('#session-status').textContent='Session complete';$('#session-status').className='status delivered';
    $('#policy-copy').textContent='The client-approved finish time has been recorded. The studio team will confirm your final invoice and delivery schedule.';
    const elapsed=session.elapsed_minutes||0, overtime=session.overtime_minutes||0, units=session.overtime_units||0, fee=session.overtime_fee||0;
    const summary=document.createElement('div');summary.className='session-stat-grid';summary.innerHTML=`<div class="session-stat"><small>Total session time</small><strong>${Math.floor(elapsed/60)}h ${elapsed%60}m</strong></div><div class="session-stat"><small>Chargeable overtime</small><strong>${Math.floor(overtime/60)}h ${overtime%60}m · ${units} block${units===1?'':'s'}</strong></div><div class="session-stat"><small>Overtime fee</small><strong>${money(fee)}</strong></div>`;$('#session-summary').replaceChildren(summary);$('#session-summary').hidden=false;
  }
  document.addEventListener('DOMContentLoaded',init);
})();
