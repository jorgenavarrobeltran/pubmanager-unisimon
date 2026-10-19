const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
  const [k, ...v] = l.split('=');
  return [k.trim(), v.join('=').trim()];
}));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  // ============================================================
  // PASO 1: Actualizar tracking en certificados existentes (Forms)
  // ============================================================
  const updates = [
    { consecutive: 39, requester_name: 'Aldemar José de Moya Camacho', requester_email: 'aldemar.demoya@unisimon.edu.co', request_channel: 'formulario' },
    { consecutive: 40, requester_name: 'Aldemar José de Moya Camacho', requester_email: 'aldemar.demoya@unisimon.edu.co', request_channel: 'formulario' },
    { consecutive: 41, requester_name: 'Aldemar José de Moya Camacho', requester_email: 'aldemar.demoya@unisimon.edu.co', request_channel: 'formulario' },
    { consecutive: 46, requester_name: 'Norma Isabel Liñan Melendez', requester_email: 'norma.linan@unisimon.edu.co', request_channel: 'formulario' },
    { consecutive: 47, requester_name: 'Norma Isabel Liñan Melendez', requester_email: 'norma.linan@unisimon.edu.co', request_channel: 'formulario' },
    { consecutive: 48, requester_name: 'Matilde María Eljach Pacheco', requester_email: 'matilde.eljach@unisimon.edu.co', request_channel: 'formulario' },
    { consecutive: 49, requester_name: 'Matilde María Eljach Pacheco', requester_email: 'matilde.eljach@unisimon.edu.co', request_channel: 'formulario' },
    { consecutive: 55, requester_name: 'Angélica Orozco Idárraga', requester_email: 'angelica.orozco@unisimon.edu.co', request_channel: 'formulario' },
  ];

  console.log('=== PASO 1: Actualizando tracking en certificados existentes ===\n');

  for (const u of updates) {
    const { data, error } = await supabase
      .from('certificates')
      .update({
        requester_name: u.requester_name,
        requester_email: u.requester_email,
        request_channel: u.request_channel,
        status: 'atendido',
      })
      .eq('consecutive_number', u.consecutive)
      .select('id, consecutive_number, recipient_name');

    if (error) {
      console.log(`  ❌ Cert #${u.consecutive}: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(`  ✅ Cert #${u.consecutive} → ${u.requester_name} (${u.requester_email}) [formulario] → atendido`);
    } else {
      console.log(`  ⚠️ Cert #${u.consecutive}: No se encontró`);
    }
  }

  // ============================================================
  // PASO 2: Crear solicitudes nuevas para Alexander Ruz Gomez
  // ============================================================
  console.log('\n=== PASO 2: Creando solicitudes nuevas ===\n');

  // Solicitud 1: Capítulo
  const { data: d1, error: e1 } = await supabase.from('certificates').insert({
    certificate_type: 'cert-editorial-capitulo',
    recipient_name: 'Alexander Ruz Gomez',
    title_reference: 'RESPONSABILIDAD SOCIAL, ÉTICA Y GESTIÓN: fundamentos en producción, marketing y logística',
    description: 'Capítulo: PRODUCCIÓN DE HARINA DE PESCADO COMO APUESTA DE DESARROLLO SOSTENIBLE EN EL NORTE DE COLOMBIA',
    document_category: 'aval',
    publication_type: 'capitulo',
    requester_name: 'Alexander Ruz Gomez',
    requester_email: 'alexander.ruz@unisimon.edu.co',
    request_channel: 'formulario',
    status: 'solicitado',
  }).select('id, consecutive_number');

  if (e1) {
    console.log(`  ❌ Alexander Ruz (capítulo): ${e1.message}`);
  } else {
    console.log(`  ✅ Creada solicitud #${d1[0].consecutive_number} → Alexander Ruz Gomez — Capítulo "PRODUCCIÓN DE HARINA DE PESCADO…" [solicitado]`);
  }

  // Solicitud 2: Libro completo
  const { data: d2, error: e2 } = await supabase.from('certificates').insert({
    certificate_type: 'aval-libro',
    recipient_name: 'Alexander Ruz Gomez',
    title_reference: 'RESPONSABILIDAD SOCIAL, ÉTICA Y GESTIÓN: fundamentos en producción, marketing y logística',
    description: 'Solicitud de aval para libro completo',
    document_category: 'aval',
    publication_type: 'libro',
    requester_name: 'Alexander Ruz Gomez',
    requester_email: 'alexander.ruz@unisimon.edu.co',
    request_channel: 'formulario',
    status: 'solicitado',
  }).select('id, consecutive_number');

  if (e2) {
    console.log(`  ❌ Alexander Ruz (libro): ${e2.message}`);
  } else {
    console.log(`  ✅ Creada solicitud #${d2[0].consecutive_number} → Alexander Ruz Gomez — Libro "RESPONSABILIDAD SOCIAL…" [solicitado]`);
  }

  // ============================================================
  // RESUMEN FINAL
  // ============================================================
  console.log('\n=== RESUMEN FINAL ===\n');

  const { data: allCerts } = await supabase.from('certificates')
    .select('consecutive_number, status, requester_name, requester_email, request_channel, title_reference, recipient_name')
    .order('consecutive_number');

  const withReq = allCerts.filter(c => c.requester_name);
  const withoutReq = allCerts.filter(c => !c.requester_name);
  const solicitados = allCerts.filter(c => c.status === 'solicitado');
  const atendidos = allCerts.filter(c => c.status === 'atendido');
  const expedidos = allCerts.filter(c => c.status === 'expedido');

  console.log(`Total certificados: ${allCerts.length}`);
  console.log(`  Con solicitante:    ${withReq.length}`);
  console.log(`  Sin solicitante:    ${withoutReq.length} (pendientes de correo)`);
  console.log(`  Estado solicitado:  ${solicitados.length}`);
  console.log(`  Estado atendido:    ${atendidos.length}`);
  console.log(`  Estado expedido:    ${expedidos.length}`);

  console.log('\n--- Sin solicitante (pendientes de pantallazos de correo): ---');
  withoutReq.forEach(c => {
    console.log(`  #${c.consecutive_number} | ${c.status.padEnd(10)} | ${(c.recipient_name || '').substring(0, 50)} | ${(c.title_reference || '').substring(0, 45)}`);
  });
}

run().catch(console.error);
