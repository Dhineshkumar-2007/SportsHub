const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const SEED_FILE = path.join(__dirname, 'seed', 'products.json');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

// Ensure data directory exists
fs.mkdirSync(DATA_DIR, { recursive: true });

// Seed products
if (fs.existsSync(SEED_FILE)) {
  const seedProducts = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  const products = seedProducts.map(p => ({ ...p, stock: 100 }));
  fs.writeFileSync(path.join(DATA_DIR, 'products.json'), JSON.stringify(products, null, 2));
  console.log(`Seeded ${products.length} products to products.json`);
}

// Seed admin user
const usersFile = path.join(DATA_DIR, 'users.json');
let users = [];
if (fs.existsSync(usersFile)) {
  try { users = JSON.parse(fs.readFileSync(usersFile, 'utf8')); } catch { users = []; }
}
if (!users.some(u => u.email === 'admin@sportshub.local')) {
  users.push({
    id: 1,
    name: 'Sports Hub Admin',
    email: 'admin@sportshub.local',
    passwordHash: hashPassword('Admin@123'),
    role: 'admin',
    createdAt: new Date().toISOString()
  });
}
fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

// Ensure empty arrays for other collections
for (const coll of ['carts', 'wishlists', 'orders', 'newsletter']) {
  const f = path.join(DATA_DIR, `${coll}.json`);
  if (!fs.existsSync(f)) {
    fs.writeFileSync(f, JSON.stringify([], null, 2));
  }
}

console.log('Seed completed successfully!');
console.log('Demo admin: admin@sportshub.local / Admin@123');
