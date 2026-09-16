import mongoose from "mongoose";

const connectDB = async (retries = 10) => {
  for (let i = 1; i <= retries; i++) {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("chat DB connected");
      return;
    } catch (error) {
      console.log(`chat db error (attempt ${i}/${retries}):`, error.message);
      if (i < retries) await new Promise((r) => setTimeout(r, 3000));
    }
  }
};

export default connectDB;
