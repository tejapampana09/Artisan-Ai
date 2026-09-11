export function getCraftImage(p) {
  if (p?.image_url && typeof p.image_url === 'string' && p.image_url.startsWith('http')) return p.image_url;
  if (p?.enhanced_image_url && typeof p.enhanced_image_url === 'string' && p.enhanced_image_url.startsWith('http')) return p.enhanced_image_url;
  
  const cat = (p?.category || '').toLowerCase();
  const title = (p?.title || '').toLowerCase();

  if (cat.includes('kalam') || cat.includes('saree') || cat.includes('textile') || title.includes('kalamkari') || title.includes('saree')) {
    return 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80';
  }
  if (cat.includes('wood') || cat.includes('toy') || title.includes('wooden') || title.includes('horse')) {
    return 'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=600&auto=format&fit=crop&q=80';
  }
  if (cat.includes('pottery') || cat.includes('ceramic') || cat.includes('clay') || title.includes('pottery') || title.includes('urn')) {
    return 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=600&auto=format&fit=crop&q=80';
  }
  if (cat.includes('metal') || cat.includes('bidri') || cat.includes('brass') || cat.includes('silver') || title.includes('silver') || title.includes('diya')) {
    return 'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=600&auto=format&fit=crop&q=80';
  }
  return 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80';
}
