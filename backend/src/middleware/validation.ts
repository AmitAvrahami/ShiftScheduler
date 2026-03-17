import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const registerSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(["manager", "employee", "admin"]),
    isFixedMorning: z.boolean().optional() // for manager
});

export const loginSchema = z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
});

export const validateRequest = (schema: z.AnyZodObject) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    message: "Validation error",
                    errors: error.errors
                });
            }
            return res.status(500).json({ message: "Internal server error during validation" });
        }
    };
};
