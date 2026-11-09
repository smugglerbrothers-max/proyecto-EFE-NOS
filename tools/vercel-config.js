// Paso de "build" en Vercel: escribe js/config.js con las variables de entorno.
const fs = require('fs');
const path = require('path');
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const out = `// GENERADO en el despliegue por tools/vercel-config.js\nwindow.UMBRAL_CONFIG = ${JSON.stringify({ supabaseUrl: url, supabaseAnonKey: key }, null, 2)};\n`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'config.js'), out);
console.log(url ? 'Supabase configurado: ' + url : 'Aviso: sin SUPABASE_URL; el juego funcionará solo con guardado local.');
