const express=require('express');
const bcrypt=require('bcryptjs');
const db=require('../db');
const {sign,authRequired}=require('../auth');
const router=express.Router();
router.post('/register',(req,res)=>{
  const {name,email,password}=req.body||{};
  if(!name||!email||!password||password.length<6) return res.status(400).json({error:'Name, valid email and password (6+ characters) are required'});
  try{
    const hash=bcrypt.hashSync(password,10);
    const info=db.prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)').run(name.trim(),email.trim().toLowerCase(),hash);
    const user=db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(info.lastInsertRowid);
    res.status(201).json({user,token:sign(user)});
  }catch(e){ if(String(e.message).includes('UNIQUE')) return res.status(409).json({error:'Email is already registered'}); throw e; }
});
router.post('/login',(req,res)=>{
  const {email,password}=req.body||{};
  const user=db.prepare('SELECT * FROM users WHERE email=?').get(String(email||'').trim().toLowerCase());
  if(!user||!bcrypt.compareSync(String(password||''),user.password_hash)) return res.status(401).json({error:'Invalid email or password'});
  const safe={id:user.id,name:user.name,email:user.email,role:user.role};
  res.json({user:safe,token:sign(safe)});
});
router.get('/me',authRequired,(req,res)=>res.json({user:req.user}));
module.exports=router;
