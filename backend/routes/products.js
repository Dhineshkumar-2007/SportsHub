const express=require('express'); const db=require('../db'); const {authRequired,adminRequired}=require('../auth'); const router=express.Router();
router.get('/',(req,res)=>{
 const {category,search}=req.query; let sql='SELECT id,category,name,price,image,badge,stock FROM products WHERE 1=1'; const args=[];
 if(category&&category!=='All'){sql+=' AND category=?';args.push(category)}
 if(search){sql+=' AND (name LIKE ? OR category LIKE ?)';args.push(`%${search}%`,`%${search}%`)}
 sql+=' ORDER BY id'; res.json({products:db.prepare(sql).all(...args)});
});
router.get('/:id',(req,res)=>{const p=db.prepare('SELECT id,category,name,price,image,badge,stock FROM products WHERE id=?').get(req.params.id); if(!p)return res.status(404).json({error:'Product not found'});res.json(p)});
router.post('/',authRequired,adminRequired,(req,res)=>{const {id,category,name,price,image,badge,stock=100}=req.body||{};if(!id||!category||!name||!price||!image)return res.status(400).json({error:'id, category, name, price and image are required'});try{db.prepare('INSERT INTO products(id,category,name,price,image,badge,stock) VALUES(?,?,?,?,?,?,?)').run(id,category,name,price,image,badge||null,stock);res.status(201).json(db.prepare('SELECT * FROM products WHERE id=?').get(id));}catch(e){res.status(409).json({error:'Product ID already exists'})}});
router.put('/:id',authRequired,adminRequired,(req,res)=>{const {category,name,price,image,badge,stock}=req.body||{};const info=db.prepare('UPDATE products SET category=COALESCE(?,category),name=COALESCE(?,name),price=COALESCE(?,price),image=COALESCE(?,image),badge=?,stock=COALESCE(?,stock) WHERE id=?').run(category,name,price,image,badge??null,stock,req.params.id);if(!info.changes)return res.status(404).json({error:'Product not found'});res.json(db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id))});
router.delete('/:id',authRequired,adminRequired,(req,res)=>{const info=db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);if(!info.changes)return res.status(404).json({error:'Product not found'});res.json({message:'Product deleted'})});
module.exports=router;
