require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Product = require('./models/Product');

const img = (seed) => `https://picsum.photos/seed/${seed}/600/450`;

const products = [
  { name: 'Aero 14 Ultrabook', brand: 'Aero', category: 'Laptops', price: 74999, stock: 14, rating: 4.6, image: img('aero14'), description: '14-inch, 16 GB RAM, 512 GB SSD, 12-hour battery.' },
  { name: 'Forge 15 Gaming Laptop', brand: 'Forge', category: 'Laptops', price: 99999, stock: 6, rating: 4.4, image: img('forge15'), description: '15.6-inch 144 Hz display, dedicated GPU, RGB keyboard.' },
  { name: 'Nimbus Student Notebook', brand: 'Nimbus', category: 'Laptops', price: 38999, stock: 25, rating: 4.1, image: img('nimbus'), description: 'Lightweight everyday laptop for classes and coding.' },
  { name: 'Pulse X Smartphone', brand: 'Pulse', category: 'Phones', price: 29999, stock: 40, rating: 4.5, image: img('pulsex'), description: '6.5-inch AMOLED, 128 GB, 50 MP camera.' },
  { name: 'Pulse Lite Smartphone', brand: 'Pulse', category: 'Phones', price: 13999, stock: 60, rating: 4.2, image: img('pulselite'), description: 'Budget phone with a 5000 mAh battery.' },
  { name: 'Orbit Pro Smartphone', brand: 'Orbit', category: 'Phones', price: 64999, stock: 9, rating: 4.7, image: img('orbitpro'), description: 'Flagship performance with a triple camera system.' },
  { name: 'Echo ANC Headphones', brand: 'Echo', category: 'Audio', price: 8999, stock: 35, rating: 4.5, image: img('echoanc'), description: 'Over-ear, active noise cancelling, 40-hour battery.' },
  { name: 'Echo Buds Mini', brand: 'Echo', category: 'Audio', price: 2499, stock: 80, rating: 4.0, image: img('echobuds'), description: 'True wireless earbuds with a compact charging case.' },
  { name: 'Boom 360 Speaker', brand: 'Boom', category: 'Audio', price: 4499, stock: 3, rating: 4.3, image: img('boom360'), description: 'Portable waterproof Bluetooth speaker.' },
  { name: 'Tempo Smartwatch', brand: 'Tempo', category: 'Wearables', price: 5999, stock: 30, rating: 4.2, image: img('tempo'), description: 'Heart-rate, sleep and workout tracking, 10-day battery.' },
  { name: 'Tempo Fit Band', brand: 'Tempo', category: 'Wearables', price: 1999, stock: 70, rating: 3.9, image: img('tempofit'), description: 'Slim fitness band with step and sleep tracking.' },
  { name: 'Keystone Mechanical Keyboard', brand: 'Keystone', category: 'Accessories', price: 3499, stock: 22, rating: 4.6, image: img('keystone'), description: 'Hot-swappable switches, aluminium frame.' },
  { name: 'Glide Wireless Mouse', brand: 'Glide', category: 'Accessories', price: 1299, stock: 55, rating: 4.3, image: img('glide'), description: 'Ergonomic mouse with silent clicks.' },
  { name: 'Hub 7-in-1 USB-C Dock', brand: 'Hub', category: 'Accessories', price: 2799, stock: 0, rating: 4.1, image: img('hub7'), description: 'HDMI, USB-A, SD card reader and 100 W pass-through charging.' },
  { name: 'Lumen 27" Monitor', brand: 'Lumen', category: 'Monitors', price: 15999, stock: 12, rating: 4.4, image: img('lumen27'), description: '27-inch QHD IPS, 75 Hz, thin bezels.' },
  { name: 'Lumen 24" Full HD Monitor', brand: 'Lumen', category: 'Monitors', price: 8999, stock: 18, rating: 4.2, image: img('lumen24'), description: '24-inch Full HD IPS monitor with eye-care mode.' },
];

(async () => {
  try {
    await connectDB(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartcart');

    await Product.deleteMany({});
    await Product.insertMany(products);
    console.log(`Seeded ${products.length} products`);

    const email = (process.env.ADMIN_EMAIL || 'admin@smartcart.dev').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'Admin@12345';
    let admin = await User.findOne({ email });
    if (!admin) {
      await User.create({ name: 'SmartCart Admin', email, password, role: 'admin', isVerified: true });
      console.log(`Created admin: ${email} / ${password}`);
    } else {
      console.log(`Admin already exists: ${email}`);
    }
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
