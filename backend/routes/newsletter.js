const express=require('express'); const db=require('../db'); const {authRequired,adminRequired}=require('../auth'); const router=express.Router();
router.post('/',(req,res)=>{const email=String(req.body?.email||'').trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'Please enter a valid email'});try{db.prepare('INSERT INTO newsletter_subscribers(email) VALUES(?)').run(email);res.status(201).json({message:'Thanks for joining Sports Hub!'})}catch(e){if(String(e.message).includes('UNIQUE'))return res.json({message:'You are already subscribed!' });throw e}});
router.get('/',authRequired,adminRequired,(req,res)=>res.json({subscribers:db.prepare('SELECT id,email,created_at FROM newsletter_subscribers ORDER BY id DESC').all()}));
module.exports=router;
