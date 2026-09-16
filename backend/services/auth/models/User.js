import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String },
    email: { type: String },
    // Google-only auth -> no password field. firebaseUID is the unique key.
    firebaseUID: { type: String, unique: true },
    avatar: { type: String }, // Google account image URL
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
