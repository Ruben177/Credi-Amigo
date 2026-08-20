const SUPABASE_URL = 'https://orttrwtrsaltowrqckym.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ylnt_FLdN-83tMjcZDQuTA_jjAW55QT';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


const $ = (id) => document.getElementById(id);
const fmt = (n) => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n||0));
const hoy = () => new Date().toISOString().slice(0,10);

let db = JSON.parse(localStorage.getItem('crediAmigoDB') || '{"clientes":[],"prestamos":[],"pagos":[]}');

function save(){ localStorage.setItem('crediAmigoDB', JSON.stringify(db)); render(); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function clienteNombre(id){ return db.clientes.find(c=>c.id===id)?.nombre || 'Cliente'; }
function pagosPrestamo(id){ return db.pagos.filter(p=>p.prestamoId===id).reduce((s,p)=>s+Number(p.monto),0); }

function render(){
  $('clientePrestamo').innerHTML='<option value="">Selecciona cliente</option>'+db.clientes.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join('');
  $('prestamoPago').innerHTML='<option value="">Selecciona préstamo</option>'+db.prestamos.map(p=>{
    const pendiente=Math.max(0,p.total-pagosPrestamo(p.id));
    return `<option value="${p.id}">${clienteNombre(p.clienteId)} — pendiente ${fmt(pendiente)}</option>`;
  }).join('');

  const q=$('buscar').value.trim().toLowerCase();
  $('tablaPrestamos').innerHTML=db.prestamos
    .filter(p=>clienteNombre(p.clienteId).toLowerCase().includes(q))
    .map(p=>{
      const pagado=pagosPrestamo(p.id), pendiente=Math.max(0,p.total-pagado);
      const vencido=pendiente>0 && p.fechaCobro < hoy();
      const estado=pendiente<=0?['Pagado','ok']:vencido?['Vencido','late']:['Pendiente','open'];
      return `<tr>
        <td>${clienteNombre(p.clienteId)}</td><td>${fmt(p.monto)}</td><td>${p.interes}%</td>
        <td>${fmt(p.total)}</td><td>${fmt(pagado)}</td><td>${fmt(pendiente)}</td>
        <td>${p.fechaCobro}</td><td><span class="badge ${estado[1]}">${estado[0]}</span></td>
      </tr>`;
    }).join('') || '<tr><td colspan="8">Todavía no hay préstamos.</td></tr>';

  $('historialPagos').innerHTML=[...db.pagos].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(p=>{
    const prestamo=db.prestamos.find(x=>x.id===p.prestamoId);
    return `<div class="history-item"><strong>${fmt(p.monto)}</strong> — ${prestamo?clienteNombre(prestamo.clienteId):'Préstamo'}<br><small>${p.fecha}</small></div>`;
  }).join('') || '<p>No hay pagos registrados.</p>';

  $('statClientes').textContent=db.clientes.length;
  const prestado=db.prestamos.reduce((s,p)=>s+Number(p.monto),0);
  const total=db.prestamos.reduce((s,p)=>s+Number(p.total),0);
  const cobrado=db.pagos.reduce((s,p)=>s+Number(p.monto),0);
  $('statPrestado').textContent=fmt(prestado);
  $('statCobrado').textContent=fmt(cobrado);
  $('statPendiente').textContent=fmt(Math.max(0,total-cobrado));
}

$('clienteForm').addEventListener('submit',e=>{
  e.preventDefault();
  db.clientes.push({id:uid(),nombre:$('nombre').value.trim(),telefono:$('telefono').value.trim(),nota:$('nota').value.trim()});
  e.target.reset(); save();
});

$('prestamoForm').addEventListener('submit',e=>{
  e.preventDefault();
  const monto=Number($('monto').value), interes=Number($('interes').value);
  db.prestamos.push({
    id:uid(),clienteId:$('clientePrestamo').value,monto,interes,
    total:monto*(1+interes/100),fechaInicio:$('fechaInicio').value,fechaCobro:$('fechaCobro').value
  });
  e.target.reset(); $('fechaInicio').value=hoy(); save();
});

$('pagoForm').addEventListener('submit',e=>{
  e.preventDefault();
  const p=db.prestamos.find(x=>x.id===$('prestamoPago').value);
  if(!p) return;
  const pendiente=Math.max(0,p.total-pagosPrestamo(p.id));
  const monto=Number($('montoPago').value);
  if(monto>pendiente){ alert('El pago no puede ser mayor al saldo pendiente.'); return; }
  db.pagos.push({id:uid(),prestamoId:p.id,monto,fecha:$('fechaPago').value});
  e.target.reset(); $('fechaPago').value=hoy(); save();
});

$('buscar').addEventListener('input',render);

$('exportarBtn').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download='credi-amigo-respaldo.json'; a.click();
  URL.revokeObjectURL(a.href);
});

$('importarArchivo').addEventListener('change',e=>{
  const file=e.target.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=()=>{ try{ db=JSON.parse(r.result); save(); alert('Respaldo restaurado.'); } catch{ alert('Archivo inválido.'); } };
  r.readAsText(file);
});

$('borrarTodoBtn').addEventListener('click',()=>{
  if(confirm('¿Seguro que quieres borrar todos los datos?')){ db={clientes:[],prestamos:[],pagos:[]}; save(); }
});

$('fechaInicio').value=hoy();
$('fechaPago').value=hoy();
render();
