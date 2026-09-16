import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("DB connected");
  } catch (error) {
    // Don't crash the server if the DB isn't reachable yet — just log it.
    console.log("db error:", error.message);
  }
};

export default connectDB;
