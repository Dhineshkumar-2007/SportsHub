const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'sports-hub-development-secret-change-me';
function sign(user){ return jwt.sign({id:user.id,email:user.email,role:user.role,name:user.name}, SECRET, {expiresIn:'7d'}); }
function authRequired(req,res,next){
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) return res.status(401).json({error:'Login required'});
  try { req.user=jwt.verify(token,SECRET); next(); }
  catch { return res.status(401).json({error:'Invalid or expired token'}); }
}
function adminRequired(req,res,next){ return req.user?.role==='admin' ? next() : res.status(403).json({error:'Admin access required'}); }
module.exports={sign,authRequired,adminRequired};
