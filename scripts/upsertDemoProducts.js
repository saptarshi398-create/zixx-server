require('dotenv').config();
const { connection } = require('../config/db');
const { ProductModel } = require('../models/products.model');

(async () => {
  try {
    await connection;
    const docs = [
      { title:'Classic Tee', description:'Soft cotton t-shirt', brand:'Zixx', gender:'unisex', category:'Clothes', subcategory:'T-Shirts', price:19.99, discount:0, rating:4.2, theme:'casual', size:['S','M','L','XL'], color:['black','white','blue'], image:[], supply:120, featured:true },
      { title:'Athletic Tee', description:'Breathable sports tee', brand:'Zixx', gender:'men', category:'Clothes', subcategory:'T-Shirts', price:24.99, discount:10, rating:4.4, theme:'sports', size:['M','L'], color:['red','black'], image:[], supply:80 },
      { title:'Oversized Hoodie', description:'Cozy fleece hoodie', brand:'Zixx', gender:'women', category:'Clothes', subcategory:'Hoodies', price:59.0, discount:5, rating:4.6, theme:'winter', size:['S','M','L'], color:['navy','grey'], image:[], supply:60, featured:true },
      { title:'Denim Jacket', description:'Classic denim layer', brand:'Zixx', gender:'unisex', category:'Clothes', subcategory:'Jackets', price:79.99, discount:0, rating:4.5, theme:'street', size:['M','L','XL'], color:['blue','black'], image:[], supply:35 },
      { title:'Summer Dress', description:'Light floral dress', brand:'Zixx', gender:'women', category:'Clothes', subcategory:'Dresses', price:45.0, discount:0, rating:4.3, theme:'summer', size:['S','M'], color:['yellow','white'], image:[], supply:50 },

      { title:'Adjustable Cap', description:'Everyday cap', brand:'Zixx', gender:'unisex', category:'Accessories', subcategory:'Hats', price:14.5, discount:0, rating:4.0, theme:'sports', size:['One Size'], color:['red','black'], image:[], supply:200 },
      { title:'Leather Belt', description:'Genuine leather belt', brand:'Zixx', gender:'men', category:'Accessories', subcategory:'Belts', price:29.99, discount:0, rating:4.1, theme:'formal', size:['M','L'], color:['brown','black'], image:[], supply:150 },
      { title:'Silk Scarf', description:'Printed silk scarf', brand:'Zixx', gender:'women', category:'Accessories', subcategory:'Scarves', price:25.0, discount:0, rating:4.3, theme:'casual', size:['One Size'], color:['blue','green'], image:[], supply:90 },
      { title:'Aviator Sunglasses', description:'UV-protected shades', brand:'Zixx', gender:'unisex', category:'Accessories', subcategory:'Sunglasses', price:39.99, discount:0, rating:4.4, theme:'summer', size:['One Size'], color:['gold','black'], image:[], supply:110, featured:true },

      { title:'Winter Knit Set', description:'Beanie and gloves set', brand:'Zixx', gender:'unisex', category:'Collections', subcategory:'Winter', price:34.99, discount:0, rating:4.2, theme:'winter', size:['One Size'], color:['grey','black'], image:[], supply:75 },
      { title:'Sport Essentials', description:'Performance wear bundle', brand:'Zixx', gender:'unisex', category:'Collections', subcategory:'Sports', price:89.0, discount:15, rating:4.5, theme:'sports', size:['M','L'], color:['black','blue'], image:[], supply:40 },
    ];

    let inserted = 0, skipped = 0;
    for (const d of docs) {
      const res = await ProductModel.updateOne(
        { title: d.title, category: d.category },
        { $setOnInsert: d },
        { upsert: true }
      );
      if (res.upsertedCount && res.upsertedCount > 0) inserted++; else skipped++;
    }
    console.log({ inserted, skipped });
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
