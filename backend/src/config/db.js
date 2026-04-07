const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Create default admin user if none exists
    const Admin = require('../models/Admin');
    const bcrypt = require('bcryptjs');
    
    const count = await Admin.countDocuments();
    if (count === 0) {
      console.log('No admin users found. Creating default admin...');
      const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@example.com';
      const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);
      
      await Admin.create({
        email: adminEmail,
        password: hashedPassword,
        role: 'admin'
      });
      console.log(`Default admin created: ${adminEmail}`);
    }

  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
