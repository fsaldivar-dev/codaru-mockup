export const validFontId=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v);
export const validFontStyle=(v:unknown)=>v===undefined||['normal','italic','oblique'].includes(v as string);
