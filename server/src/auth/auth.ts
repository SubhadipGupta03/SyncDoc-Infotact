import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import UserModel from "../models/user.js";

const JWT_SECRET =
  process.env.JWT_SECRET ?? "syncdoc-development-secret";

export const signup = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { name, email, password } = req.body as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!name?.trim() || !email?.trim() || !password) {
      res.status(400).json({
        message: "Name, email and password are required",
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        message: "Password must be at least 6 characters",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser =
      await UserModel.findOne({
        email: normalizedEmail,
      });

    if (existingUser) {
      res.status(409).json({
        message: "Email is already registered",
      });
      return;
    }

    const hashedPassword =
      await bcrypt.hash(password, 12);

    const user = await UserModel.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });
const token = jwt.sign(
  {
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
  },
  JWT_SECRET,
  {
    expiresIn: "7d",
  },
);

res.status(201).json({
  message: "Account created successfully",
  token,
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
  },
});
    
  } catch (error: unknown) {
    console.error("Signup failed:", error);

    res.status(500).json({
      message: "Unable to create account",
    });
  }
};

export const login = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email?.trim() || !password) {
      res.status(400).json({
        message: "Email and password are required",
      });
      return;
    }

    const user =
      await UserModel.findOne({
        email: email.trim().toLowerCase(),
      });

    if (!user) {
      res.status(401).json({
        message: "Invalid email or password",
      });
      return;
    }

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password,
      );

    if (!passwordMatches) {
      res.status(401).json({
        message: "Invalid email or password",
      });
      return;
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error: unknown) {
    console.error("Login failed:", error);

    res.status(500).json({
      message: "Unable to login",
    });
  }
};