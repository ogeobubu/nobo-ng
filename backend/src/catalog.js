const createProductImage = (label, bg) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="520" viewBox="0 0 600 520">
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0%" stop-color="${bg}" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.9" />
        </linearGradient>
      </defs>
      <rect width="600" height="520" fill="url(#g)"/>
      <circle cx="300" cy="180" r="110" fill="rgba(255,255,255,0.25)"/>
      <text x="300" y="290" text-anchor="middle" font-size="36" font-family="Arial, sans-serif" fill="#1f2937" font-weight="700">${label}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const initialProducts = [
  {
    id: 'luna-sandal',
    name: 'Luna Leather Sandal',
    price: 19500,
    stock: 12,
    image: createProductImage('LUNA', '#f9d6a5'),
    description: 'Comfort-fit leather sandals designed for warm-weather travel and everyday wear.',
    eta: '3-5 business days',
    category: 'Footwear'
  },
  {
    id: 'nile-tote',
    name: 'Nile Canvas Tote',
    price: 12800,
    stock: 9,
    image: createProductImage('TOTE', '#c7f0d7'),
    description: 'A roomy, light-weight tote ideal for carrying daily essentials and travel backups.',
    eta: '4-6 business days',
    category: 'Accessories'
  },
  {
    id: 'sahara-swatch',
    name: 'Sahara Travel Watch',
    price: 24500,
    stock: 7,
    image: createProductImage('WATCH', '#d8d4ff'),
    description: 'A sleek travel watch with a resilient stainless steel build and water resistance.',
    eta: '5-7 business days',
    category: 'Accessories'
  }
];
