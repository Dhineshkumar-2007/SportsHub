const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const SECRET = process.env.JWT_SECRET || 'sports-hub-development-secret-change-me';
fs.mkdirSync(DATA, { recursive: true });

const files = {
  products: path.join(DATA, 'products.json'), users: path.join(DATA, 'users.json'),
  carts: path.join(DATA, 'carts.json'), wishlists: path.join(DATA, 'wishlists.json'),
  orders: path.join(DATA, 'orders.json'), newsletter: path.join(DATA, 'newsletter.json')
};
const seed = JSON.parse(fs.readFileSync(path.join(ROOT,'seed','products.json'),'utf8'));
function read(name, fallback=[]) { try { return JSON.parse(fs.readFileSync(files[name],'utf8')); } catch { fs.writeFileSync(files[name],JSON.stringify(fallback,null,2)); return fallback; } }
function write(name,data){ fs.writeFileSync(files[name],JSON.stringify(data,null,2)); }
function init(){
  if(!fs.existsSync(files.products)) write('products',seed.map(p=>({...p,stock:100})));
  for(const n of ['users','carts','wishlists','orders','newsletter']) if(!fs.existsSync(files[n])) write(n,[]);
  const users=read('users');
  if(!users.some(u=>u.email==='admin@sportshub.local')){users.push({id:1,name:'Sports Hub Admin',email:'admin@sportshub.local',passwordHash:hashPassword('Admin@123'),role:'admin',createdAt:new Date().toISOString()});write('users',users)}
}
init();

function hashPassword(password){const salt=crypto.randomBytes(16).toString('hex');const hash=crypto.scryptSync(password,salt,64).toString('hex');return `${salt}:${hash}`}
function verifyPassword(password,stored){try{const [salt,hash]=stored.split(':');const actual=crypto.scryptSync(password,salt,64).toString('hex');return crypto.timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(actual,'hex'))}catch{return false}}
function tokenFor(user){const payload=Buffer.from(JSON.stringify({id:user.id,email:user.email,name:user.name,role:user.role,exp:Date.now()+7*864e5})).toString('base64url');const sig=crypto.createHmac('sha256',SECRET).update(payload).digest('base64url');return `${payload}.${sig}`}
function userFromToken(req){const h=req.headers.authorization||'';const t=h.replace(/^Bearer\s+/i,'');if(!t)return null;const [p,s]=t.split('.');if(!p||!s)return null;const expected=crypto.createHmac('sha256',SECRET).update(p).digest('base64url');if(s!==expected)return null;try{const u=JSON.parse(Buffer.from(p,'base64url').toString());return u.exp>Date.now()?u:null}catch{return null}}
function json(res,status,data){const body=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(body)}
function body(req){return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>1e6)req.destroy()});req.on('end',()=>{try{resolve(b?JSON.parse(b):{})}catch{reject(new Error('Invalid JSON'))}});req.on('error',reject)})}
function id(){return Date.now()+Math.floor(Math.random()*1000)}
function safeUser(u){return {id:u.id,name:u.name,email:u.email,role:u.role}}
function requireAuth(req,res){const u=userFromToken(req);if(!u){json(res,401,{error:'Login required'});return null}return u}
function requireAdmin(req,res){const u=requireAuth(req,res);if(u&&u.role!=='admin'){json(res,403,{error:'Admin access required'});return null}return u}
function productById(id){return read('products').find(p=>p.id===Number(id))}
function cartItems(userId){const carts=read('carts');const c=carts.find(x=>x.userId===userId)?.items||[];const products=read('products');return c.map(x=>{const p=products.find(p=>p.id===x.productId);return p?{...p,quantity:x.quantity}:null}).filter(Boolean)}
function sendFile(req,res,file){const ext=path.extname(file).toLowerCase();const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon'};fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});res.end(data)})}

async function api(req,res,u){
 const pathname=u.pathname, method=req.method;
 if(pathname==='/api/health'&&method==='GET') return json(res,200,{ok:true,service:'Sports Hub API',time:new Date().toISOString()});
 if(pathname==='/api/products'&&method==='GET'){let ps=read('products');const q=u.searchParams.get('search')?.toLowerCase();const c=u.searchParams.get('category');if(c&&c!=='All')ps=ps.filter(p=>p.category===c);if(q)ps=ps.filter(p=>p.name.toLowerCase().includes(q)||p.category.toLowerCase().includes(q));return json(res,200,{products:ps.sort((a,b)=>a.id-b.id)})}
 if(pathname.startsWith('/api/products/')&&method==='GET'){const p=productById(pathname.split('/').pop());return p?json(res,200,p):json(res,404,{error:'Product not found'})}
 if(pathname==='/api/auth/register'&&method==='POST'){const b=await body(req);if(!b.name||!b.email||!b.password||String(b.password).length<6)return json(res,400,{error:'Name, valid email and password (6+ characters) are required'});const users=read('users');const email=String(b.email).trim().toLowerCase();if(users.some(x=>x.email===email))return json(res,409,{error:'Email is already registered'});const user={id:id(),name:String(b.name).trim(),email,passwordHash:hashPassword(String(b.password)),role:'customer',createdAt:new Date().toISOString()};users.push(user);write('users',users);return json(res,201,{user:safeUser(user),token:tokenFor(user)})}
 if(pathname==='/api/auth/login'&&method==='POST'){const b=await body(req);const email=String(b.email||'').trim().toLowerCase();const user=read('users').find(x=>x.email===email);if(!user||!verifyPassword(String(b.password||''),user.passwordHash))return json(res,401,{error:'Invalid email or password'});return json(res,200,{user:safeUser(user),token:tokenFor(user)})}
 if(pathname==='/api/auth/me'&&method==='GET'){const u=requireAuth(req,res);return u&&json(res,200,{user:u})}
 if(pathname==='/api/newsletter'&&method==='POST'){const b=await body(req);const email=String(b.email||'').trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email))return json(res,400,{error:'Please enter a valid email'});const list=read('newsletter');if(list.some(x=>x.email===email))return json(res,200,{message:'You are already subscribed!'});list.push({id:id(),email,createdAt:new Date().toISOString()});write('newsletter',list);return json(res,201,{message:'Thanks for joining Sports Hub!'})}
 const user=requireAuth(req,res); if(pathname.startsWith('/api/customer')&&!user)return;
 if(pathname==='/api/customer/cart'&&method==='GET')return json(res,200,{items:cartItems(user.id)});
 if(pathname==='/api/customer/cart'&&method==='POST'){const b=await body(req),p=productById(b.productId),q=Number(b.quantity||1);if(!p)return json(res,404,{error:'Product not found'});if(q<1)return json(res,400,{error:'Quantity must be at least 1'});const cs=read('carts');let c=cs.find(x=>x.userId===user.id);if(!c){c={userId:user.id,items:[]};cs.push(c)}let item=c.items.find(x=>x.productId===p.id);item?item.quantity=Math.min(p.stock,item.quantity+q):c.items.push({productId:p.id,quantity:Math.min(p.stock,q)});write('carts',cs);return json(res,200,{items:cartItems(user.id)})}
 const cm=pathname.match(/^\/api\/customer\/cart\/(\d+)$/);if(cm&&method==='PUT'){const b=await body(req),q=Number(b.quantity),p=productById(cm[1]);if(!p)return json(res,404,{error:'Product not found'});if(!Number.isInteger(q)||q<1)return json(res,400,{error:'Quantity must be a positive integer'});const cs=read('carts'),c=cs.find(x=>x.userId===user.id),item=c?.items.find(x=>x.productId===p.id);if(item)item.quantity=Math.min(q,p.stock);write('carts',cs);return json(res,200,{items:cartItems(user.id)})}
 if(cm&&method==='DELETE'){const cs=read('carts'),c=cs.find(x=>x.userId===user.id);if(c)c.items=c.items.filter(x=>x.productId!==Number(cm[1]));write('carts',cs);return json(res,200,{items:cartItems(user.id)})}
 if(pathname==='/api/customer/wishlist'&&method==='GET'){const w=read('wishlists').find(x=>x.userId===user.id)?.productIds||[];return json(res,200,{items:w.map(productById).filter(Boolean)})}
 const wm=pathname.match(/^\/api\/customer\/wishlist\/(\d+)$/);if(wm&&method==='POST'){const cs=read('wishlists');let w=cs.find(x=>x.userId===user.id);if(!w){w={userId:user.id,productIds:[]};cs.push(w)}const pid=Number(wm[1]);if(!productById(pid))return json(res,404,{error:'Product not found'});w.productIds.includes(pid)?w.productIds=w.productIds.filter(x=>x!==pid):w.productIds.push(pid);write('wishlists',cs);return json(res,200,{items:w.productIds})}
 if(pathname==='/api/customer/orders'&&method==='GET'){const os=read('orders').filter(o=>o.userId===user.id).sort((a,b)=>b.id-a.id);return json(res,200,{orders:os})}
 if(pathname==='/api/customer/orders'&&method==='POST'){const b=await body(req);for(const k of ['customerName','email','phone','address','city','pincode'])if(!b[k])return json(res,400,{error:'All delivery fields are required'});const items=cartItems(user.id);if(!items.length)return json(res,400,{error:'Your cart is empty'});for(const i of items)if(i.quantity>i.stock)return json(res,400,{error:`Only ${i.stock} of ${i.name} are available`});const total=items.reduce((s,i)=>s+i.price*i.quantity,0);const products=read('products');items.forEach(i=>{const p=products.find(x=>x.id===i.id);p.stock-=i.quantity});write('products',products);const orders=read('orders');const order={id:id(),userId:user.id,customerName:b.customerName,email:b.email,phone:b.phone,address:b.address,city:b.city,pincode:b.pincode,total,status:'Placed',createdAt:new Date().toISOString(),items:items.map(i=>({productId:i.id,productName:i.name,price:i.price,quantity:i.quantity}))};orders.push(order);write('orders',orders);const cs=read('carts').filter(x=>x.userId!==user.id);write('carts',cs);return json(res,201,{message:'Order placed successfully',order})}
 const om=pathname.match(/^\/api\/customer\/orders\/(\d+)\/cancel$/);if(om&&method==='POST'){const orders=read('orders'),o=orders.find(x=>x.id===Number(om[1])&&x.userId===user.id);if(!o)return json(res,404,{error:'Order not found'});if(o.status!=='Placed'&&o.status!=='Processing')return json(res,400,{error:'Order can no longer be cancelled'});if(Date.now()-new Date(o.createdAt).getTime()>2*864e5)return json(res,400,{error:'Cancellation window of 2 days has expired'});o.status='Cancelled';write('orders',orders);const products=read('products');for(const i of o.items||[]){const p=products.find(x=>x.id===i.productId);if(p)p.stock+=i.quantity}write('products',products);return json(res,200,{message:'Order cancelled successfully',order:o})}
 if(pathname==='/api/admin/orders'&&method==='GET'){if(!requireAdmin(req,res))return;return json(res,200,{orders:read('orders').sort((a,b)=>b.id-a.id)})}
 const adm=pathname.match(/^\/api\/admin\/orders\/(\d+)$/);if(adm&&method==='PUT'){if(!requireAdmin(req,res))return;const b=await body(req),allowed=['Placed','Processing','Shipped','Delivered','Cancelled'];if(!allowed.includes(b.status))return json(res,400,{error:'Invalid status'});const os=read('orders'),o=os.find(x=>x.id===Number(adm[1]));if(!o)return json(res,404,{error:'Order not found'});o.status=b.status;write('orders',os);return json(res,200,o)}
 if(pathname==='/api/admin/newsletter'&&method==='GET'){if(!requireAdmin(req,res))return;return json(res,200,{subscribers:read('newsletter').sort((a,b)=>b.id-a.id)})}
 return json(res,404,{error:'API route not found'});
}

const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url, `http://${req.headers.host || 'localhost'}`);if(u.pathname.startsWith('/api/'))return await api(req,res,u);let p=decodeURIComponent(u.pathname);if(p==='/'||p==='/index.html')p='/index.html';const file=path.normalize(path.join(PUBLIC,p));if(!file.startsWith(PUBLIC))return res.writeHead(403).end();fs.stat(file,(e,s)=>{if(!e&&s.isFile())sendFile(req,res,file);else sendFile(req,res,path.join(PUBLIC,'index.html'))})}catch(e){console.error(e);json(res,500,{error:'Server error'})}});
server.listen(PORT,()=>console.log(`Sports Hub running at http://localhost:${PORT}`));
